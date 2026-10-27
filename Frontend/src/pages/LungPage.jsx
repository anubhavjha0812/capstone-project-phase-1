import React, { useEffect, useState } from "react";
import "../App.css";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Loader from "react-loader-spinner";
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";
import { FiUpload } from "react-icons/fi";
import { useI18n } from "../i18n/I18nContext";
import { LUNG_QUESTIONS as QUESTIONS, pct } from "../predictors/fields";

const API = "http://localhost:8080/api/v1/predict";

// English labels for the downloadable PDF (its built-in font only supports Latin characters)
const PDF_LABELS = {
  gender: "Gender",
  age: "Age",
  smoking: "Smoking",
  yellowFingers: "Yellow fingers",
  anxiety: "Anxiety",
  peerPressure: "Peer pressure",
  chronicDisease: "Chronic disease",
  fatigue: "Fatigue",
  allergy: "Allergy",
  wheezing: "Wheezing",
  alcohol: "Alcohol consumption",
  coughing: "Coughing",
  shortnessOfBreath: "Shortness of breath",
  swallowingDifficulty: "Swallowing difficulty",
  chestPain: "Chest pain",
};
const PDF_CT = {
  malignant: "Signs that look like lung cancer were found",
  not_malignant: "No signs of lung cancer were found",
};
const CT_KEYS = { malignant: "lung.ctMalignant", not_malignant: "lung.ctNotMalignant" };
const CT_ERRORS = { not_ct: "lung.notCt", unusual: "lung.unusualImage" };
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/bmp", "image/webp"];

const newSession = () =>
  window.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const emptyForm = () => ({
  gender: "",
  age: "",
  ...Object.fromEntries(QUESTIONS.map((q) => [q, ""])),
});

const LungPage = () => {
  const { t } = useI18n();
  const [step, setStep] = useState(1); // 1 = CT scan, 2 = questions, 3 = results
  // Sent with both steps so the saved history shows the scan and questionnaire as one lung check
  const [session, setSession] = useState(newSession);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [ctResult, setCtResult] = useState(null); // { prediction, probability } or null if skipped
  const [formData, setFormData] = useState(emptyForm);
  const [surveyResult, setSurveyResult] = useState(null); // { prediction, probability, result }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Free the preview URL when the image changes or the page closes
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const goTo = (next) => {
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------- step 1: CT scan ----------
  const handleFile = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!chosen) return;
    if (!IMAGE_TYPES.includes(chosen.type)) return setError("lung.wrongType");
    if (chosen.size > MAX_BYTES) return setError("lung.fileTooLarge");
    setError("");
    setCtResult(null);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const analyseScan = async () => {
    if (!file) return setError("lung.chooseFirst");
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("session", session);
      body.append("image", file);
      const response = await fetch(`${API}/lung-ct-pred`, {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 400) return setError(CT_ERRORS[data.code] || "lung.invalidImage");
      if (!response.ok) throw new Error(data.message || "Scan analysis failed.");
      setCtResult(data);
    } catch (err) {
      console.error("CT analysis failed:", err.message);
      setError("lung.scanFailed");
    } finally {
      setLoading(false);
    }
  };

  const skipScan = () => {
    setFile(null);
    setPreview("");
    setCtResult(null);
    goTo(2);
  };

  // ---------- step 2: questions ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const age = Number(formData.age);
    const unanswered = Object.values(formData).some((v) => v === "");
    if (unanswered || !Number.isFinite(age) || age < 1 || age > 120) {
      setError("lung.fillAll");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/lung-pred`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, age, session }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Prediction request failed.");
      }
      setSurveyResult(await response.json());
      goTo(3);
    } catch (err) {
      console.error("Prediction failed:", err.message);
      setError("predict.predictFailed");
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setSession(newSession());
    setFile(null);
    setPreview("");
    setCtResult(null);
    setSurveyResult(null);
    setFormData(emptyForm());
    goTo(1);
  };

  const yesNo = (v) => (v === "1" ? t("predict.yes") : t("predict.no"));
  const ctConcern = ctResult?.prediction === "malignant";
  const surveyConcern = surveyResult?.prediction === "1";

  // Report text stays in English: the PDF font only supports Latin characters
  const generateDynamicPDF = async () => {
    setLoading(true);
    try {
      const existingPdfBytes = await fetch("/Report.pdf").then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const page = pdfDoc.getPages()[0];
      const { height } = page.getSize();

      const lines = [
        { text: "1. CT scan", font: bold },
        ...(ctResult
          ? [
              { text: `Result: ${PDF_CT[ctResult.prediction]}` },
              { text: `Estimated chance of cancer from the scan: ${pct(ctResult.probability)}%` },
            ]
          : [{ text: "Skipped (no CT scan uploaded)" }]),
        { text: "2. Questionnaire", font: bold },
        { text: `${PDF_LABELS.gender}: ${formData.gender === "1" ? "Male" : "Female"}` },
        { text: `${PDF_LABELS.age}: ${formData.age}` },
        ...QUESTIONS.map((q) => ({
          text: `${PDF_LABELS[q]}: ${formData[q] === "1" ? "Yes" : "No"}`,
        })),
        { text: `Estimated risk: ${pct(surveyResult.probability)}%` },
        { text: `Prediction Result: ${surveyResult.result}` },
      ];

      let y = height - 230;
      lines.forEach(({ text, font: f = font }) => {
        page.drawText(text, { x: 50, y, size: 11, font: f, color: rgb(0, 0, 0) });
        y -= 18;
      });

      const blob = new Blob([await pdfDoc.save()], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Lung_Cancer_Pred_Result.pdf";
      link.click();
      setError("");
    } catch (err) {
      console.error("Failed to generate PDF:", err.message);
      setError("predict.reportFailed");
    } finally {
      setLoading(false);
    }
  };

  const ctProbabilities = (result) => (
    <ul className="lung-probs">
      <li>
        <span>{t("lung.ctRisk")}</span>
        <span className="lung-probs__bar">
          <span style={{ width: `${pct(result.probability)}%` }} />
        </span>
        <span>{pct(result.probability)}%</span>
      </li>
    </ul>
  );

  return (
    <div className="heart-page-container">
      <h1 className="heart-page-header">{t("lung.title")}</h1>
      <div className="loader-overlay" style={{ display: loading ? "flex" : "none" }}>
        <Loader type="TailSpin" color="#FFF" height={70} width={70} />
      </div>

      <ol className="lung-steps" aria-label={t("lung.title")}>
        {["stepScan", "stepQuestions", "stepResults"].map((key, i) => (
          <li
            key={key}
            className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span className="lung-steps__num">{i + 1}</span>
            {t(`lung.${key}`)}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="heart-page-form lung-form">
          <p className="lung-intro">{t("lung.scanIntro")}</p>

          <label htmlFor="ct-image" className="heart-page-upload-label lung-upload">
            <FiUpload className="heart-page-upload-icon" />
            {file ? t("lung.changeImage") : t("lung.chooseImage")}
          </label>
          <input
            id="ct-image"
            type="file"
            accept="image/png,image/jpeg,image/bmp,image/webp"
            className="heart-page-upload-input"
            onChange={handleFile}
          />
          {preview && <img className="lung-preview" src={preview} alt={file?.name || ""} />}

          {ctResult ? (
            <div className="lung-ct-result">
              <p className={`prediction-text ${ctConcern ? "heart-disease" : "no-heart-disease"}`}>
                {t(CT_KEYS[ctResult.prediction])}
              </p>
              {ctProbabilities(ctResult)}
              <button type="button" className="heart-page-button" onClick={() => goTo(2)}>
                {t("lung.continue")}
              </button>
            </div>
          ) : (
            file && (
              <button type="button" className="heart-page-button" onClick={analyseScan}>
                {t("lung.analyse")}
              </button>
            )
          )}

          <button type="button" className="lung-link-button" onClick={skipScan}>
            {t("lung.skipScan")}
          </button>
          <p className="lung-note">{t("lung.scanNote")}</p>
        </div>
      )}

      {step === 2 && (
        <form className="heart-page-form lung-form" onSubmit={handleSubmit} noValidate>
          <p className="lung-intro">{t("lung.intro")}</p>
          <div className="lung-grid">
            <label className="lung-field">
              <span>{t("lung.gender")}</span>
              <select name="gender" value={formData.gender} onChange={handleChange}>
                <option value="">{t("lung.select")}</option>
                <option value="1">{t("predict.male")}</option>
                <option value="0">{t("predict.female")}</option>
              </select>
            </label>
            <label className="lung-field">
              <span>{t("lung.age")}</span>
              <input
                type="number"
                name="age"
                min="1"
                max="120"
                value={formData.age}
                onChange={handleChange}
              />
            </label>
            {QUESTIONS.map((q) => (
              <label className="lung-field" key={q}>
                <span>{t(`lung.${q}`)}</span>
                <select name={q} value={formData[q]} onChange={handleChange}>
                  <option value="">{t("lung.select")}</option>
                  <option value="1">{t("predict.yes")}</option>
                  <option value="0">{t("predict.no")}</option>
                </select>
              </label>
            ))}
          </div>
          <button type="submit" className="heart-page-button">
            {t("predict.predict")}
          </button>
          <button type="button" className="lung-link-button" onClick={() => goTo(1)}>
            {t("lung.back")}
          </button>
          <p className="lung-note">{t("lung.note")}</p>
        </form>
      )}

      {step === 3 && surveyResult && (
        <div className="heart-page-result-container">
          <p style={{ fontWeight: "bolder", fontSize: "1.5rem" }}>{t("predict.resultTitle")}</p>

          {ctResult && (
            <p className={`lung-summary ${ctConcern || surveyConcern ? "concern" : "clear"}`}>
              {t(ctConcern || surveyConcern ? "lung.summaryConcern" : "lung.summaryClear")}
            </p>
          )}

          <h3 className="lung-result-heading">1. {t("lung.scanResultTitle")}</h3>
          {ctResult ? (
            <>
              {preview && <img className="lung-preview small" src={preview} alt="" />}
              <p className={`prediction-text ${ctConcern ? "heart-disease" : "no-heart-disease"}`}>
                {t(CT_KEYS[ctResult.prediction])}
              </p>
              {ctProbabilities(ctResult)}
            </>
          ) : (
            <p className="lung-note">{t("lung.scanSkipped")}</p>
          )}

          <h3 className="lung-result-heading">2. {t("lung.surveyResultTitle")}</h3>
          <p>
            {t("lung.gender")}: {formData.gender === "1" ? t("predict.male") : t("predict.female")}
          </p>
          <p>
            {t("lung.age")}: {formData.age}
          </p>
          {QUESTIONS.map((q) => (
            <p key={q}>
              {t(`lung.${q}`)} {yesNo(formData[q])}
            </p>
          ))}
          <p className="lung-risk">{t("lung.probability", { percent: pct(surveyResult.probability) })}</p>
          <p className={`prediction-text ${surveyConcern ? "heart-disease" : "no-heart-disease"}`}>
            {surveyConcern ? t("lung.positive") : t("lung.negative")}
          </p>

          <p className="lung-note">{t("lung.resultNote")}</p>
          <button className="heart-page-button" onClick={generateDynamicPDF}>
            {t("predict.downloadReport")}
          </button>
          <button className="heart-page-button" onClick={startOver}>
            {t("lung.startOver")}
          </button>
        </div>
      )}
      {error && <p className="error-message" role="alert">{t(error)}</p>}
    </div>
  );
};

export default LungPage;
