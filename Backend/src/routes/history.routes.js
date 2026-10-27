import { Router } from "express";
import {
  getHistory,
  getHistoryImage,
  deleteHistoryItem,
  clearHistory,
} from "../controllers/history.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Prediction history of the logged-in user (My account page)
router.use(verifyJWT);
router.route("/").get(getHistory).delete(clearHistory);
router.route("/:id").delete(deleteHistoryItem);
router.route("/:id/image").get(getHistoryImage);

export default router;
