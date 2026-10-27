import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  loadLocalUsers,
  saveLocalUsers,
  loadLocalOtps,
  saveLocalOtps,
  loadLocalSubscribers,
  saveLocalSubscribers,
} from "../utils/localStore.js";
import { Subscriber } from "../models/subscriber.model.js";
import { deleteAllHistory } from "../utils/historyStore.js";
import { sendOtpEmail } from "../utils/sendEmail.js";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

const isMongoConnected = () => mongoose.connection.readyState === 1;

const normalize = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

// Helper: generate tokens
const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

// Helper: generate tokens for a user kept in the local JSON file (offline mode)
const generateLocalTokens = (user) => {
  const tokenPayload = {
    _id: user._id,
    email: user.email,
    username: user.username,
    fullname: user.fullname,
  };

  const accessToken = jwt.sign(
    tokenPayload,
    process.env.ACCESS_TOKEN_SECRET || "default_access_secret",
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "10d" }
  );
  const refreshToken = jwt.sign(
    tokenPayload,
    process.env.REFRESH_TOKEN_SECRET || "default_refresh_secret",
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "10d" }
  );

  return { accessToken, refreshToken };
};

// Registration date. Older local-file users have no createdAt, but their id is
// "user_<milliseconds when created>", so the date can be recovered from it.
const createdAtOf = (user) => {
  if (user.createdAt) return user.createdAt;
  const ms = Number(String(user._id).replace(/^user_/, ""));
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
};

const toSafeUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  fullname: user.fullname,
  createdAt: createdAtOf(user),
});

const findLocalUser = (users, { email, username, _id }) =>
  users.find(
    (u) =>
      (_id && u._id === _id) ||
      (email && u.email.toLowerCase() === email) ||
      (username && u.username.toLowerCase() === username)
  );

// OTPs are persisted to Backend/data/otpStore.json so a server restart
// (e.g. nodemon reload) between "send OTP" and "reset password" does not lose them
const otpStore = loadLocalOtps();

// Remove expired OTPs so they are not kept on disk longer than their validity
const purgeExpiredOtps = () => {
  const now = Date.now();
  for (const [email, entry] of otpStore) {
    if (now > entry.expiresAt) otpStore.delete(email);
  }
};

purgeExpiredOtps();
saveLocalOtps(otpStore);
setInterval(() => {
  const before = otpStore.size;
  purgeExpiredOtps();
  if (otpStore.size !== before) saveLocalOtps(otpStore);
}, 60 * 1000).unref();

const cookieOptions = {
  httpOnly: true,
  secure: false, // Set to false for localhost http compatibility
  sameSite: "lax",
  path: "/",
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some(
      (field) => typeof field !== "string" || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  if (password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  const cleanEmail = normalize(email);
  const cleanUsername = normalize(username);
  const cleanFullname = fullname.trim();

  // Offline / Local file storage fallback when MongoDB is not connected
  if (!isMongoConnected()) {
    // Always reload so we never overwrite changes made since the last read
    const users = loadLocalUsers();

    if (findLocalUser(users, { email: cleanEmail, username: cleanUsername })) {
      throw new ApiError(409, "User with email or username already exists");
    }

    const localUser = {
      _id: "user_" + Date.now(),
      fullname: cleanFullname,
      email: cleanEmail,
      username: cleanUsername,
      password: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
    };

    users.push(localUser);
    saveLocalUsers(users);

    const { accessToken, refreshToken } = generateLocalTokens(localUser);

    return res
      .status(201)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          201,
          { user: toSafeUser(localUser) },
          "User registered successfully"
        )
      );
  }

  const existedUser = await User.findOne({
    $or: [{ username: cleanUsername }, { email: cleanEmail }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const user = await User.create({
    username: cleanUsername,
    email: cleanEmail,
    fullname: cleanFullname,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        201,
        { user: createdUser },
        "User registered successfully"
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  const cleanEmail = normalize(email);
  const cleanUsername = normalize(username);

  if (!cleanUsername && !cleanEmail) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  // Offline / Local storage fallback when MongoDB is not connected
  if (!isMongoConnected()) {
    const user = findLocalUser(loadLocalUsers(), {
      email: cleanEmail,
      username: cleanUsername,
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new ApiError(401, "Email or password does not match");
    }

    const { accessToken, refreshToken } = generateLocalTokens(user);

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { user: toSafeUser(user) },
          "User logged In Successfully"
        )
      );
  }

  // MongoDB mode: only query by the identifiers that were actually provided
  const conditions = [];
  if (cleanUsername) conditions.push({ username: cleanUsername });
  if (cleanEmail) conditions.push({ email: cleanEmail });

  const user = await User.findOne({ $or: conditions });

  if (!user) {
    throw new ApiError(401, "Email or password does not match");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Email or password does not match");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // If MongoDB is connected and user is a valid Mongo ObjectId, remove refreshToken
  if (
    isMongoConnected() &&
    req.user?._id &&
    mongoose.isValidObjectId(req.user._id)
  ) {
    try {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $unset: {
            refreshToken: 1,
          },
        },
        { new: true }
      );
    } catch (err) {
      console.log("Logout warning:", err.message);
    }
  }

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

// Send OTP to email for password reset
const sendOtp = asyncHandler(async (req, res) => {
  const cleanEmail = normalize(req.body.email);

  if (!cleanEmail) {
    throw new ApiError(400, "Email is required");
  }

  // Check if user exists (MongoDB or local file users)
  const userExists = isMongoConnected()
    ? Boolean(await User.findOne({ email: cleanEmail }))
    : Boolean(findLocalUser(loadLocalUsers(), { email: cleanEmail }));

  if (!userExists) {
    throw new ApiError(404, "No account found with this email address");
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + OTP_TTL_MS;

  otpStore.set(cleanEmail, { otp, expiresAt, attempts: 0 });
  saveLocalOtps(otpStore);

  // Send email (via nodemailer and terminal console)
  const result = await sendOtpEmail(cleanEmail, otp);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { email: cleanEmail, simulated: result.simulated },
        result.simulated
          ? "OTP generated! (Check terminal console if EMAIL_USER not configured in .env)"
          : "OTP sent directly to your email!"
      )
    );
});

// Reset password using OTP
const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, OTP, and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  const cleanEmail = normalize(email);
  const cleanOtp = otp.toString().trim();

  const storedOtp = otpStore.get(cleanEmail);

  if (!storedOtp) {
    throw new ApiError(
      400,
      "No OTP request found for this email. Please click 'Change email or resend OTP' to request a new code."
    );
  }

  if (Date.now() > storedOtp.expiresAt) {
    otpStore.delete(cleanEmail);
    saveLocalOtps(otpStore);
    throw new ApiError(400, "OTP has expired. Please request a new code.");
  }

  if (storedOtp.otp !== cleanOtp) {
    storedOtp.attempts = (storedOtp.attempts || 0) + 1;
    if (storedOtp.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(cleanEmail);
      saveLocalOtps(otpStore);
      throw new ApiError(
        429,
        "Too many incorrect attempts. Please request a new OTP."
      );
    }
    saveLocalOtps(otpStore);
    throw new ApiError(400, "Invalid OTP code. Please check the code and try again.");
  }

  // OTP verified! Update password
  if (isMongoConnected()) {
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
  } else {
    // Offline mode: update in local storage file
    const users = loadLocalUsers();
    const user = findLocalUser(users, { email: cleanEmail });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    saveLocalUsers(users);
  }

  // Clear OTP from storage
  otpStore.delete(cleanEmail);
  saveLocalOtps(otpStore);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password has been successfully reset!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET || "default_refresh_secret"
    );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }

  if (!isMongoConnected()) {
    const user = findLocalUser(loadLocalUsers(), { _id: decodedToken._id });

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const { accessToken, refreshToken } = generateLocalTokens(user);

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(new ApiResponse(200, {}, "Access token refreshed"));
  }

  const user = await User.findById(decodedToken?._id);

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, {}, "Access token refreshed"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  if (!isMongoConnected()) {
    const users = loadLocalUsers();
    const user = findLocalUser(users, { _id: req.user._id });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (!(await bcrypt.compare(oldPassword, user.password))) {
      throw new ApiError(400, "Invalid old password");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    saveLocalUsers(users);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, toSafeUser(req.user), "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName?.trim() || !email?.trim()) {
    throw new ApiError(400, "All fields are required");
  }

  const cleanEmail = normalize(email);

  if (!isMongoConnected()) {
    const users = loadLocalUsers();
    const user = findLocalUser(users, { _id: req.user._id });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (users.some((u) => u !== user && u.email.toLowerCase() === cleanEmail)) {
      throw new ApiError(409, "Email is already in use");
    }

    user.fullname = fullName.trim();
    user.email = cleanEmail;
    saveLocalUsers(users);

    return res
      .status(200)
      .json(
        new ApiResponse(200, toSafeUser(user), "Account details updated successfully")
      );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullname: fullName.trim(),
        email: cleanEmail,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// verifyJWT has already validated the token and set req.user
const getProfile = asyncHandler(async (req, res) => {
  if (!isMongoConnected()) {
    const user = findLocalUser(loadLocalUsers(), { _id: req.user._id });

    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, toSafeUser(user), "Profile fetched successfully"));
  }

  if (!mongoose.isValidObjectId(req.user._id)) {
    throw new ApiError(401, "Invalid token");
  }

  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(401, "User no longer exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Profile fetched successfully"));
});

// ---------------------------------------------------------------------------
// My account: change email / username, delete account.
// Each action requires the current password, so someone using an unlocked
// browser cannot take over or delete the account.
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9]{3,20}$/;

// Loads the logged-in user and checks their password.
// Returns { user, users } in local-file mode or { user } in MongoDB mode.
const loadUserWithPassword = async (req, password) => {
  if (typeof password !== "string" || !password) {
    throw new ApiError(400, "Current password is required");
  }

  if (!isMongoConnected()) {
    const users = loadLocalUsers();
    const user = findLocalUser(users, { _id: req.user._id });
    if (!user) throw new ApiError(404, "User not found");
    if (!(await bcrypt.compare(password, user.password))) {
      throw new ApiError(401, "Password is incorrect");
    }
    return { user, users };
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, "User not found");
  if (!(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "Password is incorrect");
  }
  return { user };
};

// Keeps a newsletter subscription when the account's email changes
const moveSubscription = async (oldEmail, newEmail) => {
  if (isMongoConnected()) {
    await Subscriber.updateOne({ email: oldEmail }, { $set: { email: newEmail } });
  } else {
    const subscribers = loadLocalSubscribers();
    const entry = subscribers.find((s) => s.email === oldEmail);
    if (entry) {
      entry.email = newEmail;
      saveLocalSubscribers(subscribers);
    }
  }
};

const removeSubscription = async (email) => {
  if (isMongoConnected()) {
    await Subscriber.deleteOne({ email });
  } else {
    saveLocalSubscribers(loadLocalSubscribers().filter((s) => s.email !== email));
  }
};

// After a change, issue fresh tokens (they contain the email and username)
const sendUpdatedUser = async (res, user, message) => {
  const { accessToken, refreshToken } = isMongoConnected()
    ? await generateAccessAndRefereshTokens(user._id)
    : generateLocalTokens(user);

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, toSafeUser(user), message));
};

// PATCH /api/v1/users/email   { newEmail, password }
const updateEmail = asyncHandler(async (req, res) => {
  const newEmail = normalize(req.body.newEmail);
  if (!EMAIL_REGEX.test(newEmail) || newEmail.length > 254) {
    throw new ApiError(400, "Please enter a valid email address");
  }

  const { user, users } = await loadUserWithPassword(req, req.body.password);
  const oldEmail = user.email;
  if (newEmail === oldEmail) {
    throw new ApiError(400, "This is already your email address");
  }

  if (users) {
    if (findLocalUser(users, { email: newEmail })) {
      throw new ApiError(409, "Email is already in use");
    }
    user.email = newEmail;
    saveLocalUsers(users);
  } else {
    if (await User.findOne({ email: newEmail })) {
      throw new ApiError(409, "Email is already in use");
    }
    user.email = newEmail;
    await user.save({ validateBeforeSave: false });
  }

  await moveSubscription(oldEmail, newEmail);
  return sendUpdatedUser(res, user, "Email updated");
});

// PATCH /api/v1/users/username   { newUsername, password }
const updateUsername = asyncHandler(async (req, res) => {
  const newUsername = normalize(req.body.newUsername);
  if (!USERNAME_REGEX.test(newUsername)) {
    throw new ApiError(400, "Username must be 3-20 letters or numbers");
  }

  const { user, users } = await loadUserWithPassword(req, req.body.password);
  if (newUsername === user.username) {
    throw new ApiError(400, "This is already your username");
  }

  if (users) {
    if (findLocalUser(users, { username: newUsername })) {
      throw new ApiError(409, "Username is already in use");
    }
    user.username = newUsername;
    saveLocalUsers(users);
  } else {
    if (await User.findOne({ username: newUsername })) {
      throw new ApiError(409, "Username is already in use");
    }
    user.username = newUsername;
    await user.save({ validateBeforeSave: false });
  }

  return sendUpdatedUser(res, user, "Username updated");
});

// DELETE /api/v1/users/me   { password }
// Permanently removes the account and its newsletter subscription.
const deleteAccount = asyncHandler(async (req, res) => {
  const { user, users } = await loadUserWithPassword(req, req.body.password);

  if (users) {
    saveLocalUsers(users.filter((u) => u._id !== user._id));
  } else {
    await User.deleteOne({ _id: user._id });
  }
  await removeSubscription(user.email);
  deleteAllHistory(user._id); // saved predictions and their CT scan copies

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "Account deleted"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  sendOtp,
  resetPasswordWithOtp,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  getProfile,
  updateEmail,
  updateUsername,
  deleteAccount,
};
