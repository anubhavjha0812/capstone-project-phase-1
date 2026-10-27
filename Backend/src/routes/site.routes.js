import { Router } from "express";
import {
  sendContactMessage,
  subscribe,
  unsubscribe,
  mySubscription,
  subscribeMe,
  unsubscribeMe,
} from "../controllers/site.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/contact").post(sendContactMessage);
router.route("/newsletter/subscribe").post(subscribe);
router.route("/newsletter/unsubscribe").get(unsubscribe);

// Newsletter status for the logged-in user (My account page)
router
  .route("/newsletter/me")
  .get(verifyJWT, mySubscription)
  .post(verifyJWT, subscribeMe)
  .delete(verifyJWT, unsubscribeMe);

export default router;
