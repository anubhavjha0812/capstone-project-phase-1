import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  getProfile,
  sendOtp,
  resetPasswordWithOtp,
  updateEmail,
  updateUsername,
  deleteAccount,
} from "../controllers/user.controller.js";
import { verifyJWT, optionalJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

// OTP Password recovery
router.route("/send-otp").post(sendOtp);
router.route("/reset-password-otp").post(resetPasswordWithOtp);

// Secured routes
// Logout must still clear cookies when the access token has already expired
router.route("/logout").post(optionalJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router.route("/profile").get(verifyJWT, getProfile);

// My account page
router.route("/email").patch(verifyJWT, updateEmail);
router.route("/username").patch(verifyJWT, updateUsername);
router.route("/me").delete(verifyJWT, deleteAccount);

export default router;
