import React, { useState } from "react";
import "../App.css";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FiUpload } from "react-icons/fi";
import Loader from "react-loader-spinner";
import "react-loader-spinner/dist/loader/css/react-spinner-loader.css";
import { useI18n } from "../i18n/I18nContext";

// Allowed ranges (same as ML/Diabetes Prediction/diabetespredict.py);
// zeroOk: 0 means "not measured" and the model fills it in
const LIMITS = {
  pregnancies: { min: 0, max: 20 },
  glucose: { min: 40, max: 400, zeroOk: true },
  bloodPressure: { min: 30, max: 150, zeroOk: true },
  skinThickness: { min: 5, max: 100, zeroOk: true },
  insulin: { min: 5, max: 900, zeroOk: true },
  bmi: { min: 10, max: 80, zeroOk: true },
  diabetesPedigreeFunction: { min: 0, max: 3 },
  age: { min: 1, max: 120 },
};

const DiabetesPage = () => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    pregnancies: "",
    glucose: "",
    bloodPressure: "",
    skinThickness: "",
    insulin: "",
    bmi: "",
    diabetesPedigreeFunction: "",
    age: "",
  });
  const [predictionResult, setPredictionResult] = useState(""); // English text, used in the PDF report
  const [predictionCode, setPredictionCode] = useState(""); // "1" or "0"
  const [error, setError] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false); // State for loading spinner

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleUploadReport = async (e) => {
    setLoading(true); // Start loading spinner
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      console.log("PDF file uploaded:", file);

      const formData = new FormData();
      formData.append("pdfFile", file);

      try {
        const response = await fetch(
          "http://localhost:8080/api/pdf/diabetes-scraper",
          {
            method: "POST",
            body: formData,
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error("PDF upload request failed.");
        }
        const data = await response.json();
        console.log("Data from server:", data);

        setFormData({
          pregnancies: data.Pregnancies || "",
          glucose: data.Glucose || "",
          bloodPressure: data.BloodPressure || "",
          skinThickness: data.SkinThickness || "",
          insulin: data.Insulin || "",
          bmi: data.BMI || "",
          diabetesPedigreeFunction: data.DiabetesPedigreeFunction || "",
          age: data.Age || "",
        });
      } catch (error) {
        console.error("PDF upload failed:", error.message);
        setError("predict.pdfFailed");
      } finally {
        setLoading(false); // Stop loading spinner
      }
    } else {
      setError("predict.invalidPdf");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const entries = Object.entries(LIMITS).map(([name, lim]) => [String(formData[name] ?? "").trim(), lim]);
    if (entries.some(([v]) => v === "")) return setError("diabetes.fillAll");
    const invalid = entries.some(([v, { min, max, zeroOk }]) => {
      const n = Number(v);
      return !Number.isFinite(n) || (!(zeroOk && n === 0) && (n < min || n > max));
    });
    if (invalid) return setError("diabetes.outOfRange");

    setLoading(true); // Start loading spinner

    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/predict/diabetes-pred",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
          credentials: "include",
        }
      );
      if (response.status === 400) {
        setError("diabetes.outOfRange");
        return;
      }
      if (!response.ok) {
        throw new Error("Prediction request failed.");
      }
      const data = await response.json();
      setPredictionResult(data.result);
      setPredictionCode(data.prediction);
      setError("");
      setShowResult(true);
    } catch (error) {
      console.error("Prediction failed:", error.message);
      setError("predict.predictFailed");
      setPredictionResult("");
      setShowResult(false);
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  const handleRePredict = () => {
    setShowResult(false);
    setPredictionResult("");
    setFormData({
      pregnancies: "",
      glucose: "",
      bloodPressure: "",
      skinThickness: "",
      insulin: "",
      bmi: "",
      diabetesPedigreeFunction: "",
      age: "",
    });
    setPdfFile(null);
  };

  const generateDynamicPDF = async () => {
    try {
      setLoading(true); // Start loading spinner

      const existingPdfBytes = await fetch(
        "/Report.pdf"
      ).then((res) => res.arrayBuffer());

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      const fields = [
        { label: "Number of Pregnancies:", value: formData.pregnancies },
        { label: "Glucose Level:", value: formData.glucose },
        { label: "Blood Pressure:", value: formData.bloodPressure },
        { label: "Skin Thickness:", value: formData.skinThickness },
        { label: "Insulin:", value: formData.insulin },
        { label: "BMI (Body Index Mass):", value: formData.bmi },
        {
          label: "Diabetes Pedigree Function:",
          value: formData.diabetesPedigreeFunction,
        },
        { label: "Age:", value: formData.age },
        { label: "Prediction Result:", value: predictionResult },
      ];

      let yOffset = height - 250;
      const lineHeight = 20;

      fields.forEach(({ label, value }) => {
        firstPage.drawText(`${label} ${value}`, {
          x: 50,
          y: yOffset,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yOffset -= lineHeight;
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Diabetes_Pred_Result.pdf";
      link.click();

      setError("");
    } catch (error) {
      console.error("Failed to generate PDF:", error.message);
      setError("predict.reportFailed");
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  return (
    <div className="diabetes-page-container">
      <h1 className="diabetes-page-header">{t("diabetes.title")}</h1>
      <div
        className="loader-overlay"
        style={{ display: loading ? "flex" : "none" }}
      >
        <Loader type="TailSpin" color="#FFF" height={70} width={70} />
      </div>
      {!showResult ? (
        <form className="diabetes-page-form" onSubmit={handleSubmit}>
          <div className="diabetes-page-input-container">
            <input
              className="diabetes-page-input"
              type="text"
              name="pregnancies"
              placeholder={t("diabetes.pregnancies")}
              value={formData.pregnancies || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="glucose"
              placeholder={t("diabetes.glucose")}
              value={formData.glucose || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="bloodPressure"
              placeholder={t("diabetes.bloodPressure")}
              value={formData.bloodPressure || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="skinThickness"
              placeholder={t("diabetes.skinThickness")}
              value={formData.skinThickness || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="insulin"
              placeholder={t("diabetes.insulin")}
              value={formData.insulin || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="bmi"
              placeholder={t("diabetes.bmi")}
              value={formData.bmi || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="diabetesPedigreeFunction"
              placeholder={t("diabetes.pedigree")}
              value={formData.diabetesPedigreeFunction || ""}
              onChange={handleChange}
            />
            <input
              className="diabetes-page-input"
              type="text"
              name="age"
              placeholder={t("diabetes.age")}
              value={formData.age || ""}
              onChange={handleChange}
            />
          </div>
          <p className="lung-note">{t("diabetes.zeroHint")}</p>
          <div className="diabetes-page-upload-report-container">
            <p>{t("predict.uploadPrompt")}</p>
            <label
              htmlFor="upload-report"
              className="diabetes-page-upload-label"
            >
              <FiUpload className="diabetes-page-upload-icon" /> {t("predict.uploadReport")}
              <input
                id="upload-report"
                type="file"
                accept="application/pdf"
                onChange={handleUploadReport}
                className="diabetes-page-upload-input"
              />
            </label>
            <button type="submit" className="diabetes-page-button">
              {t("predict.predict")}
            </button>
          </div>
        </form>
      ) : (
        <div className="diabetes-page-result-container">
          <p style={{ fontWeight: "bolder", fontSize: "1.5rem" }}>
            {t("predict.resultTitle")}
          </p>
          <p>{t("diabetes.pregnancies")}: {formData.pregnancies}</p>
          <p>{t("diabetes.glucose")}: {formData.glucose}</p>
          <p>{t("diabetes.bloodPressure")}: {formData.bloodPressure}</p>
          <p>{t("diabetes.skinThickness")}: {formData.skinThickness}</p>
          <p>{t("diabetes.insulin")}: {formData.insulin}</p>
          <p>{t("diabetes.bmi")}: {formData.bmi}</p>
          <p>{t("diabetes.pedigree")}: {formData.diabetesPedigreeFunction}</p>
          <p>{t("diabetes.age")}: {formData.age}</p>
          <p
            className={`prediction-text ${
              predictionCode === "1" ? "diabetes" : "no-diabetes"
            }`}
          >
            {predictionCode === "1" ? t("diabetes.positive") : t("diabetes.negative")}
          </p>
          {/* Report text stays in English: the PDF font only supports Latin characters */}
          <button className="diabetes-page-button" onClick={generateDynamicPDF}>
            {t("predict.downloadReport")}
          </button>
          <button className="diabetes-page-button" onClick={handleRePredict}>
            {t("predict.rePredict")}
          </button>
        </div>
      )}
      {error && <p className="error-message" role="alert">{t(error)}</p>}
    </div>
  );
};

export default DiabetesPage;
