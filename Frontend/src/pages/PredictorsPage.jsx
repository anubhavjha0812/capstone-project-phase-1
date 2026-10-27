import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Card from "../components/Card";
import heartImage from "../assets/heart.png";
import lungImage from "../assets/lung.png";
import diabetesImage from "../assets/diabetes.png";
import breastImage from "../assets/breast.png";
import { UserContext } from "../context/UserContext";
import { useI18n } from "../i18n/I18nContext";
import "../App.css";

function PredictorsPage() {
  const { userInfo } = useContext(UserContext);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleLinkClick = (path) => {
    navigate(path);
  };

  return (
    <div className="predictor-container">
      <ToastContainer />
      <p className="description">{t("predictors.description")}</p>
      <div className="card-container">
        <div
          onClick={() => handleLinkClick("/predictors/heart")}
          className="card"
          style={{ textDecoration: "none" }}
        >
          <Card
            image={heartImage}
            title={t("predictors.heartTitle")}
            description={t("predictors.heartText")}
          />
        </div>
        <div
          onClick={() => handleLinkClick("/predictors/lung")}
          className="card"
          style={{ textDecoration: "none" }}
        >
          <Card
            image={lungImage}
            title={t("predictors.lungTitle")}
            description={t("predictors.lungText")}
          />
        </div>
        <div
          onClick={() => handleLinkClick("/predictors/breast")}
          className="card"
          style={{ textDecoration: "none" }}
        >
          <Card
            image={breastImage}
            title={t("predictors.breastTitle")}
            description={t("predictors.breastText")}
          />
        </div>
        <div
          onClick={() => handleLinkClick("/predictors/diabetes")}
          className="card"
          style={{ textDecoration: "none" }}
        >
          <Card
            image={diabetesImage}
            title={t("predictors.diabetesTitle")}
            description={t("predictors.diabetesText")}
          />
        </div>
      </div>
    </div>
  );
}

export default PredictorsPage;
