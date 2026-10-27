import React, { useState } from "react";
import "../App.css";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"; // Ensure correct import
import { FiUpload } from "react-icons/fi"; // Importing React Icons
import Loader from "react-loader-spinner";
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";
import { useI18n } from "../i18n/I18nContext";
import { HEART_CHOICES as CHOICES, HEART_FIELDS as FIELDS } from "../predictors/fields";

const PDF_LABELS = {
  age: "Age",
  sex: "Sex",
  chestPainType: "Chest Pain Type",
  restingBloodPressure: "Resting Blood Pressure",
  serumCholesterol: "Serum Cholesterol",
  fastingBloodSugar: "Fasting Blood Sugar > 120 mg/dl",
  restingECG: "Resting ECG",
  maxHeartRate: "Maximum Heart Rate Achieved",
  exerciseInducedAngina: "Exercise Induced Angina",
  oldPeak: "Old Peak",
  slope: "Slope",
  numMajorVessels: "Number of Major Vessels (0-3)",
  thal: "Thal",
};

const emptyForm = () => Object.fromEntries(FIELDS.map((f) => [f.name, ""]));

// Values from the PDF auto-fill; anything that is not a valid choice is left empty for the user
const fromReport = (name, raw) => {
  const value = raw === undefined || raw === null ? "" : String(raw).trim();
  if (!CHOICES[name]) return value;
  return CHOICES[name].some((c) => c.value === value) ? value : "";
};

const HeartPage = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState(emptyForm);
  const [predictionResult, setPredictionResult] = useState(""); // English text, used in the PDF report
  const [predictionCode, setPredictionCode] = useState(""); // "1" or "0"
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false); // State for loading spinner

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleUploadReport = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // allow uploading the same file again
    if (!file || file.type !== "application/pdf") {
      setError("predict.invalidPdf");
      return;
    }
    setLoading(true); // Start loading spinner

    const body = new FormData();
    body.append("pdfFile", file);

    try {
      const response = await fetch("http://localhost:8080/api/pdf/heart-scraper", {
        method: "POST",
        body,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("PDF upload request failed.");
      }
      const data = await response.json();

      // Map the response data to the form state
      const fbs = String(data["Fasting blood sugar > 120 mg/dl"] ?? "").toLowerCase();
      setFormData({
        age: fromReport("age", data.Age),
        sex: fromReport("sex", data.Sex),
        chestPainType: fromReport("chestPainType", data["Chest pain type"]),
        restingBloodPressure: fromReport("restingBloodPressure", data["Resting blood pressure"]),
        serumCholesterol: fromReport("serumCholesterol", data["Serum cholesterol in mg/dl"]),
        fastingBloodSugar: ["yes", "1", "true"].includes(fbs) ? "1" : ["no", "0", "false"].includes(fbs) ? "0" : "",
        restingECG: fromReport("restingECG", data["Resting Electrocardiographic Results"]),
        maxHeartRate: fromReport("maxHeartRate", data["Maximum Heart Rate Achieved"]),
        exerciseInducedAngina: fromReport("exerciseInducedAngina", data["Exercise Induced Angina"]),
        oldPeak: fromReport("oldPeak", data["Old peak"]),
        slope: fromReport("slope", data["Slope of the peak exercise ST Segment"]),
        numMajorVessels: fromReport(
          "numMajorVessels",
          data["Number of major vessels (0-3) colored by fluoroscopy"]
        ),
        thal: fromReport("thal", data["Thal (Thallium Stress Test Result)"]),
      });
      setError("");
    } catch (err) {
      console.error("PDF upload failed:", err.message);
      setError("predict.pdfFailed");
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = FIELDS.some((f) => formData[f.name] === "");
    const outOfRange = FIELDS.some((f) => {
      if (f.type !== "number") return false;
      const v = Number(formData[f.name]);
      return !Number.isFinite(v) || v < f.min || v > f.max;
    });
    if (missing) return setError("heart.fillAll");
    if (outOfRange) return setError("heart.outOfRange");

    setLoading(true); // Start loading spinner
    try {
      const response = await fetch("http://localhost:8080/api/v1/predict/heart-pred", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p1: formData.age,
          p2: formData.sex,
          p3: formData.chestPainType,
          p4: formData.restingBloodPressure,
          p5: formData.serumCholesterol,
          p6: formData.fastingBloodSugar,
          p7: formData.restingECG,
          p8: formData.maxHeartRate,
          p9: formData.exerciseInducedAngina,
          p10: formData.oldPeak,
          p11: formData.slope,
          p12: formData.numMajorVessels,
          p13: formData.thal,
        }),
        credentials: "include", // Ensure cookies are sent
      });
      if (response.status === 400) {
        setError("heart.outOfRange");
        return;
      }
      if (!response.ok) {
        throw new Error("Prediction request failed.");
      }
      const data = await response.json();
      setPredictionResult(data.result);
      setPredictionCode(data.prediction);
      setError(""); // Clear any previous errors
      setShowResult(true); // Show the result section
    } catch (err) {
      console.error("Prediction failed:", err.message);
      setError("predict.predictFailed");
      setPredictionResult(""); // Reset prediction result on error
      setShowResult(false); // Hide the result section
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  const handleRePredict = () => {
    setShowResult(false); // Hide the result section to show the form again
    setPredictionResult(""); // Clear the prediction result
    setPredictionCode("");
    setFormData(emptyForm()); // Reset form fields
    setError("");
  };

  const choiceOf = (name) => CHOICES[name]?.find((c) => c.value === formData[name]);
  const displayValue = (name) => {
    const c = choiceOf(name);
    if (!c) return formData[name];
    return c.key ? t(c.key) : c.label;
  };

  // Function to generate and download PDF with dynamic data
  // (report text stays in English: the PDF font only supports Latin characters)
  const generateDynamicPDF = async () => {
    setLoading(true); // Start loading spinner
    try {
      const existingPdfBytes = await fetch("/Report.pdf").then((res) =>
        res.arrayBuffer()
      );

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const firstPage = pdfDoc.getPages()[0];
      const { height } = firstPage.getSize();

      const fields = [
        ...FIELDS.map((f) => ({
          label: `${PDF_LABELS[f.name]}:`,
          value: choiceOf(f.name)?.pdf ?? formData[f.name],
        })),
        { label: "Prediction Result:", value: predictionResult },
      ];

      let yOffset = height - 250; // Starting Y position with more spacing
      const lineHeight = 20; // Line height between fields

      fields.forEach(({ label, value }) => {
        firstPage.drawText(`${label} ${value}`, {
          x: 50,
          y: yOffset,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yOffset -= lineHeight; // Move Y position up for the next line
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Heart_Disease_Pred_Result.pdf";
      link.click();

      setError("");
    } catch (err) {
      console.error("Failed to generate PDF:", err.message);
      setError("predict.reportFailed");
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  return (
    <div className="heart-page-container">
      <h1 className="heart-page-header">{t("heart.title")}</h1>
      <div className="loader-overlay" style={{ display: loading ? "flex" : "none" }}>
        <Loader type="TailSpin" color="#FFF" height={70} width={70} />
      </div>
      {!showResult ? (
        <form className="heart-page-form lung-form" onSubmit={handleSubmit} noValidate>
          <div className="lung-grid">
            {FIELDS.map((f) => (
              <label className="lung-field" key={f.name}>
                <span>{t(f.label)}</span>
                {CHOICES[f.name] ? (
                  <select name={f.name} value={formData[f.name]} onChange={handleChange}>
                    <option value="">{t("lung.select")}</option>
                    {CHOICES[f.name].map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.key ? t(c.key) : c.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    name={f.name}
                    min={f.min}
                    max={f.max}
                    step={f.step || "1"}
                    value={formData[f.name]}
                    onChange={handleChange}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="heart-page-upload-report-container">
            <p>{t("predict.uploadPrompt")}</p>
            <label htmlFor="upload-report" className="heart-page-upload-label">
              <FiUpload className="heart-page-upload-icon" /> {t("predict.uploadReport")}
              <input
                id="upload-report"
                type="file"
                accept="application/pdf"
                onChange={handleUploadReport}
                className="heart-page-upload-input"
              />
            </label>
            <button type="submit" className="heart-page-button">
              {t("predict.predict")}
            </button>
          </div>
        </form>
      ) : (
        <div className="heart-page-result-container">
          <p style={{ fontWeight: "bolder", fontSize: "1.5rem" }}>{t("predict.resultTitle")}</p>
          {FIELDS.map((f) => (
            <p key={f.name}>
              {t(f.label)}: {displayValue(f.name)}
            </p>
          ))}
          <p
            className={`prediction-text ${
              predictionCode === "1" ? "heart-disease" : "no-heart-disease"
            }`}
          >
            {predictionCode === "1" ? t("heart.positive") : t("heart.negative")}
          </p>
          <button className="heart-page-button" onClick={generateDynamicPDF}>
            {t("predict.downloadReport")}
          </button>
          <button className="heart-page-button" onClick={handleRePredict}>
            {t("predict.rePredict")}
          </button>
        </div>
      )}
      {error && <p className="error-message" role="alert">{t(error)}</p>}
    </div>
  );
};

export default HeartPage;
