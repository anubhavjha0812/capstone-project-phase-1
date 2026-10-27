import { Router } from "express";
import {
  heartpred,
  diabetespred,
  lungpred,
  lungctpred,
  upload,
  ctUpload,
  breastpred,
} from "../controllers/pred.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Predictions are only for logged-in users (verifyJWT runs before any upload is saved)
router.route("/heart-pred").post(verifyJWT, heartpred);
router.route("/diabetes-pred").post(verifyJWT, diabetespred);
router.route("/lung-ct-pred").post(verifyJWT, ctUpload, lungctpred); // step 1: CT scan image
router.route("/lung-pred").post(verifyJWT, lungpred); // step 2: questionnaire, no file upload
router
  .route("/breast-pred")
  .post(verifyJWT, upload.single("image"), breastpred);

export default router;
