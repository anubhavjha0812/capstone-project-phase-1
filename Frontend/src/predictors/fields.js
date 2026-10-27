// Field definitions shared by the predictor pages and the prediction history (My account page).

// ---- Heart disease ----
// Coded fields use the same codes as the model (ML/Heart Disease Prediction/heartpredict.py)
// and the lab reports read by the PDF auto-fill. `pdf` holds the English label for the report.
export const HEART_CHOICES = {
  sex: [
    { value: "1", key: "predict.male", pdf: "Male" },
    { value: "0", key: "predict.female", pdf: "Female" },
  ],
  chestPainType: [
    { value: "3", key: "heart.cp3", pdf: "Typical angina" },
    { value: "1", key: "heart.cp1", pdf: "Atypical angina" },
    { value: "2", key: "heart.cp2", pdf: "Non-anginal pain" },
    { value: "0", key: "heart.cp0", pdf: "Asymptomatic" },
  ],
  fastingBloodSugar: [
    { value: "1", key: "predict.yes", pdf: "Yes" },
    { value: "0", key: "predict.no", pdf: "No" },
  ],
  restingECG: [
    { value: "1", key: "heart.ecg1", pdf: "Normal" },
    { value: "2", key: "heart.ecg2", pdf: "ST-T wave abnormality" },
    { value: "0", key: "heart.ecg0", pdf: "Left ventricular hypertrophy" },
  ],
  exerciseInducedAngina: [
    { value: "1", key: "predict.yes", pdf: "Yes" },
    { value: "0", key: "predict.no", pdf: "No" },
  ],
  slope: [
    { value: "2", key: "heart.slope2", pdf: "Upsloping" },
    { value: "1", key: "heart.slope1", pdf: "Flat" },
    { value: "0", key: "heart.slope0", pdf: "Downsloping" },
  ],
  numMajorVessels: ["0", "1", "2", "3"].map((v) => ({ value: v, label: v, pdf: v })),
  thal: [
    { value: "2", key: "heart.thal2", pdf: "Normal" },
    { value: "1", key: "heart.thal1", pdf: "Fixed defect" },
    { value: "3", key: "heart.thal3", pdf: "Reversible defect" },
  ],
};

// Form order. `label` is the translation key; `api` is the name the server stores in the history.
export const HEART_FIELDS = [
  { name: "age", api: "age", label: "heart.age", type: "number", min: 1, max: 120 },
  { name: "sex", api: "sex", label: "heart.sex" },
  { name: "chestPainType", api: "cp", label: "heart.chestPainType" },
  { name: "restingBloodPressure", api: "trestbps", label: "heart.restingBloodPressure", type: "number", min: 50, max: 250 },
  { name: "serumCholesterol", api: "chol", label: "heart.serumCholesterol", type: "number", min: 80, max: 700 },
  { name: "fastingBloodSugar", api: "fbs", label: "heart.fbsQuestion" },
  { name: "restingECG", api: "restecg", label: "heart.restingECG" },
  { name: "maxHeartRate", api: "thalach", label: "heart.maxHeartRate", type: "number", min: 50, max: 250 },
  { name: "exerciseInducedAngina", api: "exang", label: "heart.exerciseInducedAngina" },
  { name: "oldPeak", api: "oldpeak", label: "heart.oldPeak", type: "number", min: 0, max: 10, step: "0.1" },
  { name: "slope", api: "slope", label: "heart.slope" },
  { name: "numMajorVessels", api: "ca", label: "heart.numMajorVessels" },
  { name: "thal", api: "thal", label: "heart.thal" },
];

// ---- Diabetes ----
// `api` is the name the server stores; zeroOk: 0 means "not measured"
export const DIABETES_FIELDS = [
  { api: "pregnancies", label: "diabetes.pregnancies" },
  { api: "glucose", label: "diabetes.glucose", zeroOk: true },
  { api: "bloodPressure", label: "diabetes.bloodPressure", zeroOk: true },
  { api: "skinThickness", label: "diabetes.skinThickness", zeroOk: true },
  { api: "insulin", label: "diabetes.insulin", zeroOk: true },
  { api: "bmi", label: "diabetes.bmi", zeroOk: true },
  { api: "diabetesPedigreeFunction", label: "diabetes.pedigree" },
  { api: "age", label: "diabetes.age" },
];

// ---- Lung cancer questionnaire ----
// Yes/no questions, in the order the survey model expects (after gender and age)
export const LUNG_QUESTIONS = [
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

// Shown percentages are kept within 1-99%: models trained on small datasets are never certain
export const pct = (p) => Math.min(99, Math.max(1, Math.round(p * 100)));
