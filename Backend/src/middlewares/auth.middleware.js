import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";

const getToken = (req) =>
  req.cookies?.accessToken ||
  req.header("Authorization")?.replace("Bearer ", "");

const decodeToken = (token) =>
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "default_access_secret");

// Rejects the request with 401 unless it carries a valid access token
export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token = getToken(req);

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    req.user = decodeToken(token);
  } catch (error) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  return next();
});

// Sets req.user when a valid token is present, but never blocks the request
export const optionalJWT = asyncHandler(async (req, _, next) => {
  const token = getToken(req);

  if (token) {
    try {
      req.user = decodeToken(token);
    } catch (error) {
      // Ignore invalid/expired tokens
    }
  }

  return next();
});
