import crypto from "crypto";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscriber } from "../models/subscriber.model.js";
import { User } from "../models/user.model.js";
import {
  loadLocalSubscribers,
  saveLocalSubscribers,
  loadLocalUsers,
} from "../utils/localStore.js";
import {
  sendContactEmail,
  sendSubscriptionEmail,
  escapeHtml,
} from "../utils/sendEmail.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Simple in-memory limiter: at most `limit` requests per IP per window
const createRateLimiter = (limit, windowMs) => {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    hits.set(ip, recent);
    return true;
  };
};

const contactLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5 per hour
const subscribeLimiter = createRateLimiter(10, 60 * 60 * 1000); // 10 per hour

// Token that proves an unsubscribe link was issued by this server for this email
const unsubscribeToken = (email) =>
  crypto
    .createHmac(
      "sha256",
      process.env.ACCESS_TOKEN_SECRET || "default_access_secret"
    )
    .update(`unsubscribe:${email}`)
    .digest("hex");

const unsubscribeUrl = (email) => {
  const base =
    process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8080}`;
  return `${base}/api/v1/newsletter/unsubscribe?email=${encodeURIComponent(
    email
  )}&token=${unsubscribeToken(email)}`;
};

// POST /api/v1/contact — emails the message to the Predictix team (not stored)
const sendContactMessage = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const message =
    typeof req.body.message === "string" ? req.body.message.trim() : "";

  if (!name || name.length > 100 || /[\r\n]/.test(name)) {
    throw new ApiError(400, "Please enter your name (up to 100 characters)");
  }
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    throw new ApiError(400, "Please enter a valid email address");
  }
  if (message.length < 10 || message.length > 2000) {
    throw new ApiError(400, "Message must be between 10 and 2000 characters");
  }

  if (!contactLimiter(req.ip)) {
    throw new ApiError(429, "Too many messages. Please try again later.");
  }

  const result = await sendContactEmail({ name, email, message });

  if (result.simulated) {
    // The message could not be delivered, so tell the user instead of pretending it was sent
    console.log(`[CONTACT] Not delivered. From ${email}: ${message}`);
    throw new ApiError(
      503,
      "Your message could not be sent right now. Please try again later."
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Thanks! Your message has been sent."));
});

// POST /api/v1/newsletter/subscribe
const subscribe = asyncHandler(async (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";

  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    throw new ApiError(400, "Please enter a valid email address");
  }

  if (!subscribeLimiter(req.ip)) {
    throw new ApiError(429, "Too many requests. Please try again later.");
  }

  let alreadySubscribed;
  if (isMongoConnected()) {
    alreadySubscribed = Boolean(await Subscriber.findOne({ email }));
    if (!alreadySubscribed) await Subscriber.create({ email });
  } else {
    const subscribers = loadLocalSubscribers();
    alreadySubscribed = subscribers.some((s) => s.email === email);
    if (!alreadySubscribed) {
      subscribers.push({ email, subscribedAt: new Date().toISOString() });
      saveLocalSubscribers(subscribers);
    }
  }

  if (alreadySubscribed) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "You're already subscribed to updates."));
  }

  // Best effort, in the background: the subscription is saved even if the email fails
  sendSubscriptionEmail(email, unsubscribeUrl(email)).catch(() => {});

  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Subscribed! You'll receive Predictix updates."));
});

// GET /api/v1/newsletter/unsubscribe?email=...&token=... (link from the confirmation email)
const unsubscribe = asyncHandler(async (req, res) => {
  const email =
    typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const token = typeof req.query.token === "string" ? req.query.token : "";

  const expected = unsubscribeToken(email);
  const valid =
    email &&
    token.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

  const page = (title, text) =>
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Predictix</title></head>
    <body style="font-family: Arial, sans-serif; background: #f7fbff; display: flex; justify-content: center; padding: 48px 16px;">
      <div style="max-width: 460px; background: #fff; padding: 28px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); text-align: center;">
        <h2 style="color: #212b5c;">${escapeHtml(title)}</h2>
        <p style="color: #4a5568; line-height: 1.5;">${escapeHtml(text)}</p>
      </div>
    </body></html>`;

  if (!valid) {
    return res
      .status(400)
      .send(page("Invalid link", "This unsubscribe link is not valid."));
  }

  if (isMongoConnected()) {
    await Subscriber.deleteOne({ email });
  } else {
    saveLocalSubscribers(
      loadLocalSubscribers().filter((s) => s.email !== email)
    );
  }

  return res
    .status(200)
    .send(
      page(
        "You're unsubscribed",
        `${email} will no longer receive Predictix updates.`
      )
    );
});

// ---- Newsletter on the My account page (logged-in user) ----

// The account's current email (read from the store, not the token, so it is up to date)
const accountEmail = async (req) => {
  if (isMongoConnected()) {
    const user = await User.findById(req.user._id);
    return user?.email;
  }
  return loadLocalUsers().find((u) => u._id === req.user._id)?.email;
};

// The subscription record for an email, as { subscribedAt } or null
const findSubscription = async (email) => {
  if (isMongoConnected()) {
    const doc = await Subscriber.findOne({ email });
    return doc ? { subscribedAt: doc.createdAt } : null;
  }
  const entry = loadLocalSubscribers().find((s) => s.email === email);
  return entry ? { subscribedAt: entry.subscribedAt || null } : null;
};

const isSubscribed = async (email) => Boolean(await findSubscription(email));

// Shape returned to the My account page
const subscriptionStatus = async (email) => {
  const sub = await findSubscription(email);
  return { email, subscribed: Boolean(sub), subscribedAt: sub?.subscribedAt || null };
};

// GET /api/v1/newsletter/me
const mySubscription = asyncHandler(async (req, res) => {
  const email = await accountEmail(req);
  if (!email) throw new ApiError(404, "User not found");
  return res.status(200).json(new ApiResponse(200, await subscriptionStatus(email), "OK"));
});

// POST /api/v1/newsletter/me
const subscribeMe = asyncHandler(async (req, res) => {
  const email = await accountEmail(req);
  if (!email) throw new ApiError(404, "User not found");

  if (!(await isSubscribed(email))) {
    if (isMongoConnected()) {
      await Subscriber.create({ email });
    } else {
      const subscribers = loadLocalSubscribers();
      subscribers.push({ email, subscribedAt: new Date().toISOString() });
      saveLocalSubscribers(subscribers);
    }
    // Send the confirmation in the background so the page updates immediately
    sendSubscriptionEmail(email, unsubscribeUrl(email)).catch(() => {});
  }

  return res
    .status(200)
    .json(new ApiResponse(200, await subscriptionStatus(email), "Subscribed"));
});

// DELETE /api/v1/newsletter/me
const unsubscribeMe = asyncHandler(async (req, res) => {
  const email = await accountEmail(req);
  if (!email) throw new ApiError(404, "User not found");

  if (isMongoConnected()) {
    await Subscriber.deleteOne({ email });
  } else {
    saveLocalSubscribers(loadLocalSubscribers().filter((s) => s.email !== email));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, await subscriptionStatus(email), "Unsubscribed"));
});

export {
  sendContactMessage,
  subscribe,
  unsubscribe,
  mySubscription,
  subscribeMe,
  unsubscribeMe,
};
