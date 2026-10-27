import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { runPython } from "../utils/runPython.js";
import { createWorker } from "../utils/breastWorker.js";
import { addHistoryEntry, newHistoryId, historyImagePath } from "../utils/historyStore.js";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import path from "path";
import fs from "fs";

// Get the directory path of the current ES module file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//------------------------------------
// Set up multer for file uploads

import multer from "multer";

const uploadsDir = path.join(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${path.basename(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

// CT scan uploads: images only, max 10 MB. Multer errors become 400s instead of 500s.
const ctMulter = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|bmp|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new ApiError(400, "Please upload a CT scan image (PNG, JPG, BMP or WEBP)"));
  },
});

const ctUpload = (req, res, next) =>
  ctMulter.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new ApiError(400, "The image is too large (max 10 MB)"));
    }
    return next(new ApiError(400, "Could not read the uploaded image"));
  });

export { upload, ctUpload };

// Define the relative path to the heartpredict.py script
const heartPath = resolve(
  __dirname,
  "../../../ML/Heart Disease Prediction/heartpredict.py"
);

// Define the relative path to the diabetespredict.py script
const diabetesPath = resolve(
  __dirname,
  "../../../ML/Diabetes Prediction/diabetespredict.py"
);

// Questionnaire-based lung cancer risk model (see ML/Lung Cancer Prediction/train_lung_model.py)
const lungPath = resolve(
  __dirname,
  "../../../ML/Lung Cancer Prediction/lungpredict.py"
);

// CT scan image model, PyTorch (see ML/Lung Cancer Prediction/train_lung_ct_model.py)
const lungCtPath = resolve(
  __dirname,
  "../../../ML/Lung Cancer Prediction/lungctpredict.py"
);

// Order expected by lungpredict.py after gender and age (each answer is 1 = yes, 0 = no)
const LUNG_ANSWERS = [
  "smoking",
  "yellowFingers",
  "anxiety",
  "peerPressure",
  "chronicDisease",
  "fatigue",
  "allergy",
  "wheezing",
  "alcohol",
  "coughing",
  "shortnessOfBreath",
  "swallowingDifficulty",
  "chestPain",
];

// Accepts 1/0, true/false, "yes"/"no"; returns 1, 0 or null if invalid
const toBinary = (value) => {
  const v = String(value ?? "").trim().toLowerCase();
  if (["1", "yes", "y", "true"].includes(v)) return 1;
  if (["0", "no", "n", "false"].includes(v)) return 0;
  return null;
};

const breastPath = resolve(
  __dirname,
  "../../../ML/Breast Cancer Prediction/breast_cancer_prediction.py"
);

// Logs a failed Python run and returns a 500 error for the client
const pythonFailure = (name, { code, stdout, stderr }) => {
  console.error(
    `[${name}] Python script failed (code ${code})\nstdout: ${stdout}\nstderr: ${stderr}`
  );
  return new ApiError(500, "Prediction failed. Please try again later.");
};

// The lung CT step and questionnaire step share a session id sent by the page,
// so the My account history can show them as one lung check
const sessionOf = (req) => {
  const s = String(req.body?.session ?? "");
  return /^[A-Za-z0-9-]{8,64}$/.test(s) ? s : null;
};

// Saves a finished prediction to the user's history; never makes the prediction itself fail
const recordPrediction = (req, entry) => {
  try {
    return addHistoryEntry(req.user._id, { ...entry, session: entry.session ?? sessionOf(req) }).id;
  } catch (err) {
    console.error("[history] could not save prediction:", err.message);
    return null;
  }
};

const HEART_FIELDS = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang",
  "oldpeak", "slope", "ca", "thal"];
const DIABETES_FIELDS = ["pregnancies", "glucose", "bloodPressure", "skinThickness", "insulin", "bmi",
  "diabetesPedigreeFunction", "age"];

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error("Error deleting file:", err);
    }
  });
};

const heartpred = asyncHandler(async (req, res) => {
  const { p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13 } = req.body;

  // Condition check for p2: If male (assuming 1 for male and 0 for female)
  let transformedP2 = p2;
  if (typeof p2 === "string") {
    const lower = p2.trim().toLowerCase();
    if (lower === "male" || lower === "m" || lower === "1") {
      transformedP2 = "1";
    } else if (lower === "female" || lower === "f" || lower === "0") {
      transformedP2 = "0";
    }
  }

  // Condition check for p6: If yes (assuming 1 for yes and 0 for no)
  let transformedP6 = p6;
  if (typeof p6 === "string") {
    const lower = p6.trim().toLowerCase();
    if (lower === "yes" || lower === "y" || lower === "1") {
      transformedP6 = "1";
    } else if (lower === "no" || lower === "n" || lower === "0") {
      transformedP6 = "0";
    }
  }

  // Every value is required: guessing defaults would silently change the prediction
  const values = [p1, transformedP2, p3, p4, p5, transformedP6, p7, p8, p9, p10, p11, p12, p13];
  if (values.some((v) => v === undefined || v === null || String(v).trim() === "" || !Number.isFinite(Number(v)))) {
    throw new ApiError(400, "Please fill in all 13 heart values with numbers");
  }

  const result = await runPython(heartPath, values.map((v) => String(Number(v))));
  const predictionVal = result.lastLine;

  // heartpredict.py exits with 2 when a value is outside its allowed range
  if (result.code === 2) {
    throw new ApiError(400, "One or more heart values are out of range");
  }
  if (result.code !== 0 || (predictionVal !== "0" && predictionVal !== "1")) {
    throw pythonFailure("heart", result);
  }

  const historyId = recordPrediction(req, {
    type: "heart",
    inputs: Object.fromEntries(HEART_FIELDS.map((k, i) => [k, Number(values[i])])),
    result: { prediction: predictionVal },
  });

  return res.json({
    prediction: predictionVal,
    result:
      predictionVal === "1"
        ? "The person is suffering from Heart Disease"
        : "The person is not suffering from Heart Disease",
    historyId,
  });
});

const diabetespred = asyncHandler(async (req, res) => {
  const {
    pregnancies,
    glucose,
    bloodPressure,
    skinThickness,
    insulin,
    bmi,
    diabetesPedigreeFunction,
    age,
  } = req.body;

  // Every value is required: guessing defaults would silently change the prediction.
  // (0 is a valid entry for glucose/blood pressure/skin thickness/insulin/BMI and means "not measured".)
  const values = [pregnancies, glucose, bloodPressure, skinThickness, insulin, bmi, diabetesPedigreeFunction, age];
  if (values.some((v) => v === undefined || v === null || String(v).trim() === "" || !Number.isFinite(Number(v)))) {
    throw new ApiError(400, "Please fill in all 8 diabetes values with numbers");
  }

  const result = await runPython(diabetesPath, values.map((v) => String(Number(v))));
  const predictionVal = result.lastLine;

  // diabetespredict.py exits with 2 when a value is outside its allowed range
  if (result.code === 2) {
    throw new ApiError(400, "One or more diabetes values are out of range");
  }
  if (result.code !== 0 || (predictionVal !== "0" && predictionVal !== "1")) {
    throw pythonFailure("diabetes", result);
  }

  const historyId = recordPrediction(req, {
    type: "diabetes",
    inputs: Object.fromEntries(DIABETES_FIELDS.map((k, i) => [k, Number(values[i])])),
    result: { prediction: predictionVal },
  });

  return res.json({
    prediction: predictionVal,
    result:
      predictionVal === "1"
        ? "The person is suffering from Diabetes"
        : "The person is not suffering from Diabetes",
    historyId,
  });
});

// POST /api/v1/predict/lung-pred  (JSON body, like the heart disease predictor)
const lungpred = asyncHandler(async (req, res) => {
  const body = req.body || {};

  const genderText = String(body.gender ?? "").trim().toLowerCase();
  const gender = ["1", "m", "male"].includes(genderText)
    ? 1
    : ["0", "f", "female"].includes(genderText)
    ? 0
    : null;
  const age = Number(body.age);
  const answers = LUNG_ANSWERS.map((key) => toBinary(body[key]));

  if (gender === null || !Number.isFinite(age) || age < 1 || age > 120 || answers.includes(null)) {
    throw new ApiError(
      400,
      "Please provide gender, an age between 1 and 120, and a yes/no answer for every question"
    );
  }

  const result = await runPython(lungPath, [gender, age, ...answers].map(String));

  let output = null;
  try {
    output = JSON.parse(result.lastLine);
  } catch {
    output = null;
  }

  if (result.code !== 0 || !output || (output.prediction !== 0 && output.prediction !== 1)) {
    throw pythonFailure("lung", result);
  }

  const historyId = recordPrediction(req, {
    type: "lung_survey",
    inputs: { gender, age, ...Object.fromEntries(LUNG_ANSWERS.map((k, i) => [k, answers[i]])) },
    result: { prediction: String(output.prediction), probability: output.probability },
  });

  return res.json({
    prediction: String(output.prediction),
    probability: output.probability,
    result:
      output.prediction === 1
        ? "The person is likely to have lung cancer"
        : "The person is unlikely to have lung cancer",
    historyId,
  });
});

const CT_INPUT_ERRORS = {
  invalid_image: "The file could not be read as an image. Please upload a CT scan image.",
  not_ct: "This doesn't look like a CT scan. Please upload a grayscale lung CT scan image.",
  unusual:
    "This image doesn't look like the lung CT slices the model was trained on. Please upload an axial (cross-section) lung CT slice.",
};

// POST /api/v1/predict/lung-ct-pred  (multipart form, field "image")
const lungctpred = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image file uploaded");
  }

  const filePath = req.file.path;
  // lungctpredict.py saves a small JPEG copy here when the scan is analysed (for the history)
  const historyId = newHistoryId();
  const thumbnail = historyImagePath(historyId);

  try {
    const result = await runPython(lungCtPath, [filePath, "--thumbnail", thumbnail]);

    let output = null;
    try {
      output = JSON.parse(result.lastLine);
    } catch {
      output = null;
    }

    if (result.code === 0 && output && CT_INPUT_ERRORS[output.error]) {
      return res.status(400).json({ code: output.error, message: CT_INPUT_ERRORS[output.error] });
    }
    if (
      result.code !== 0 ||
      !output ||
      !["malignant", "not_malignant"].includes(output.prediction) ||
      typeof output.probability !== "number"
    ) {
      fs.rm(thumbnail, { force: true }, () => {});
      throw pythonFailure("lung-ct", result);
    }

    const saved = recordPrediction(req, {
      id: historyId,
      type: "lung_ct",
      inputs: {},
      result: { prediction: output.prediction, probability: output.probability },
      image: fs.existsSync(thumbnail),
    });
    if (!saved) fs.rm(thumbnail, { force: true }, () => {});

    return res.json({
      prediction: output.prediction, // "malignant" or "not_malignant"
      probability: output.probability, // chance of malignancy, 0-1
      historyId: saved,
    });
  } finally {
    // The original upload is never kept; only the small copy in the user's history
    deleteFile(filePath);
  }
});

const predictBreast = createWorker(breastPath);
predictBreast.warmUp(); // download/load the model now, not on the first upload

// Tissue grade -> short English label stored in the history
const BREAST_LABELS = {
  high: "High-grade tumour tissue",
  low: "Low-grade tumour tissue",
  stroma: "Stroma (non-tumour tissue)",
};

const breastpred = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image file uploaded");
  }

  const filePath = req.file.path;

  try {
    const result = await predictBreast(filePath);

    if (result.error === "invalid_image") {
      throw new ApiError(400, "Please upload a valid image (PNG or JPG)");
    }
    if (result.error === "model_loading") {
      throw new ApiError(503, "The breast model is still loading (the first start downloads about 320 MB). Please try again in a few minutes");
    }
    if (result.error === "model_unavailable") {
      throw new ApiError(503, "The breast model is not installed on this server yet");
    }
    if (!result.grade) {
      throw pythonFailure("breast", { code: 1, stdout: "", stderr: result.detail ?? result.error ?? "" });
    }

    const historyId = recordPrediction(req, {
      type: "breast",
      inputs: {},
      result: { grade: result.grade, probabilities: result.probabilities },
    });

    return res.status(200).json({
      grade: result.grade,
      label: BREAST_LABELS[result.grade],
      probabilities: result.probabilities,
      historyId,
    });
  } finally {
    // Always delete the file after the prediction process
    deleteFile(filePath);
  }
});

export { heartpred, diabetespred, lungpred, lungctpred, breastpred };
