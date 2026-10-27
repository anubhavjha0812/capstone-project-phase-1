import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Kept in Backend/data like the other local stores (outside src so nodemon does not restart)
const DATA_DIR = path.resolve(__dirname, "../../data");
const HISTORY_FILE = path.join(DATA_DIR, "predictionHistory.json");
export const HISTORY_IMAGES_DIR = path.join(DATA_DIR, "history-images");

// Oldest entries (and their images) are removed beyond this many per user
const MAX_PER_USER = 200;

for (const dir of [DATA_DIR, HISTORY_IMAGES_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error("Error creating history directory:", err.message);
  }
}

const load = () => {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8")) || [];
    }
  } catch (err) {
    console.error("Error reading predictionHistory.json:", err.message);
  }
  return [];
};

// Write to a temp file first, then rename, so a crash mid-write cannot corrupt the store
const save = (entries) => {
  const tmp = `${HISTORY_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), "utf-8");
  fs.renameSync(tmp, HISTORY_FILE);
};

export const newHistoryId = () => crypto.randomUUID();

// Only ids we created are ever turned into file paths
const isValidId = (id) => /^[0-9a-f-]{36}$/.test(String(id));

export const historyImagePath = (id) =>
  isValidId(id) ? path.join(HISTORY_IMAGES_DIR, `${id}.jpg`) : null;

const removeImage = (entry) => {
  if (!entry.image) return;
  const file = historyImagePath(entry.id);
  if (file) fs.rm(file, { force: true }, () => {});
};

// entry: { id?, type, session?, inputs, result, image? }
export const addHistoryEntry = (userId, entry) => {
  const record = {
    id: entry.id || newHistoryId(),
    userId: String(userId),
    type: entry.type,
    session: entry.session || null,
    createdAt: new Date().toISOString(),
    inputs: entry.inputs || {},
    result: entry.result || {},
    image: Boolean(entry.image),
  };
  const all = load();
  all.push(record);

  // Trim this user's oldest entries beyond the limit
  const mine = all.filter((e) => e.userId === record.userId);
  const excess = new Set(
    mine
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, Math.max(0, mine.length - MAX_PER_USER))
      .map((e) => e.id)
  );
  all.filter((e) => excess.has(e.id)).forEach(removeImage);
  save(all.filter((e) => !excess.has(e.id)));
  return record;
};

// Newest first; userId is not returned to the browser
export const listHistory = (userId) =>
  load()
    .filter((e) => e.userId === String(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ userId: _owner, ...rest }) => rest);

export const getHistoryEntry = (userId, id) =>
  load().find((e) => e.userId === String(userId) && e.id === id) || null;

// Deletes the given ids (only those owned by userId); returns how many were removed
export const deleteHistoryEntries = (userId, ids) => {
  const wanted = new Set(ids);
  const all = load();
  const gone = all.filter((e) => e.userId === String(userId) && wanted.has(e.id));
  if (gone.length === 0) return 0;
  gone.forEach(removeImage);
  const goneIds = new Set(gone.map((e) => e.id));
  save(all.filter((e) => !goneIds.has(e.id)));
  return gone.length;
};

export const deleteAllHistory = (userId) => {
  const all = load();
  const mine = all.filter((e) => e.userId === String(userId));
  if (mine.length === 0) return 0;
  mine.forEach(removeImage);
  save(all.filter((e) => e.userId !== String(userId)));
  return mine.length;
};
