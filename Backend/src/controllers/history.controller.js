import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
  listHistory,
  getHistoryEntry,
  deleteHistoryEntries,
  deleteAllHistory,
  historyImagePath,
} from "../utils/historyStore.js";

// GET /api/v1/history  -> the logged-in user's predictions, newest first
const getHistory = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ data: listHistory(req.user._id) });
});

// GET /api/v1/history/:id/image  -> the saved CT scan copy (owner only)
const getHistoryImage = asyncHandler(async (req, res) => {
  const entry = getHistoryEntry(req.user._id, req.params.id);
  const file = entry?.image ? historyImagePath(entry.id) : null;
  if (!file || !fs.existsSync(file)) {
    throw new ApiError(404, "Image not found");
  }
  res.set("Cache-Control", "private, no-store");
  return res.sendFile(file);
});

// DELETE /api/v1/history/:id  -> one prediction; a lung check's CT and questionnaire share a
// session, so ?session=1 deletes every entry of that session
const deleteHistoryItem = asyncHandler(async (req, res) => {
  const entry = getHistoryEntry(req.user._id, req.params.id);
  if (!entry) {
    throw new ApiError(404, "Prediction not found");
  }
  const ids =
    req.query.session === "1" && entry.session
      ? listHistory(req.user._id).filter((e) => e.session === entry.session).map((e) => e.id)
      : [entry.id];
  const deleted = deleteHistoryEntries(req.user._id, ids);
  return res.json({ data: { deleted } });
});

// DELETE /api/v1/history  -> everything
const clearHistory = asyncHandler(async (req, res) => {
  const deleted = deleteAllHistory(req.user._id);
  return res.json({ data: { deleted } });
});

export { getHistory, getHistoryImage, deleteHistoryItem, clearHistory };
