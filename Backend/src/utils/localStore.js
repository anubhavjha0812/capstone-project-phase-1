import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Place data files in Backend/data (outside src to avoid triggering nodemon watch)
const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "mockUsers.json");
const OTPS_FILE = path.join(DATA_DIR, "otpStore.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");
// Older versions stored users in src/data, which the app no longer reads
const LEGACY_USERS_FILE = path.resolve(__dirname, "../data/mockUsers.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("Error creating data directory:", err.message);
  }
}

// Write to a temp file first, then rename, so a crash mid-write cannot corrupt the store
const writeJsonAtomic = (file, value) => {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmp, file);
};

export const loadLocalUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(raw) || [];
    }
  } catch (err) {
    console.error("Error reading mockUsers.json:", err.message);
  }
  return [];
};

export const saveLocalUsers = (users) => {
  try {
    writeJsonAtomic(USERS_FILE, users);
  } catch (err) {
    console.error("Error saving mockUsers.json:", err.message);
  }
};

// Copy users from the legacy src/data file into the current store.
// Users whose email or username already exists in the current store are skipped.
const migrateLegacyUsers = () => {
  try {
    if (!fs.existsSync(LEGACY_USERS_FILE)) return;
    const legacy = JSON.parse(fs.readFileSync(LEGACY_USERS_FILE, "utf-8")) || [];
    const users = loadLocalUsers();
    const toAdd = legacy.filter(
      (l) =>
        !users.some(
          (u) =>
            u.email.toLowerCase() === l.email.toLowerCase() ||
            u.username.toLowerCase() === l.username.toLowerCase()
        )
    );
    if (toAdd.length > 0) {
      saveLocalUsers([...users, ...toAdd]);
      console.log(`[localStore] Migrated ${toAdd.length} user(s) from src/data/mockUsers.json`);
    }
  } catch (err) {
    console.error("Error migrating legacy users:", err.message);
  }
};

migrateLegacyUsers();

export const loadLocalOtps = () => {
  try {
    if (fs.existsSync(OTPS_FILE)) {
      const raw = fs.readFileSync(OTPS_FILE, "utf-8");
      const list = JSON.parse(raw) || [];
      return new Map(list);
    }
  } catch (err) {
    console.error("Error reading otpStore.json:", err.message);
  }
  return new Map();
};

export const saveLocalOtps = (otpMap) => {
  try {
    const list = Array.from(otpMap.entries());
    writeJsonAtomic(OTPS_FILE, list);
  } catch (err) {
    console.error("Error saving otpStore.json:", err.message);
  }
};

// Newsletter subscribers: [{ email, subscribedAt }]
export const loadLocalSubscribers = () => {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf-8")) || [];
    }
  } catch (err) {
    console.error("Error reading subscribers.json:", err.message);
  }
  return [];
};

export const saveLocalSubscribers = (subscribers) => {
  try {
    writeJsonAtomic(SUBSCRIBERS_FILE, subscribers);
  } catch (err) {
    console.error("Error saving subscribers.json:", err.message);
  }
};
