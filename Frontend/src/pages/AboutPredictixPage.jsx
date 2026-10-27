import React from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { Trans, useI18n } from "../i18n/I18nContext";

const predictors = ["heart", "diabetes", "breast", "lung"];
const features = ["Autofill", "Image", "Report", "Account"];
const steps = ["step1", "step2", "step3", "step4"];

function AboutPredictixPage() {
  const { t } = useI18n();

  return (
    <section className="info-page">
      <div className="info-page__inner">
        <div className="info-page__header">
          <h6 className="info-page__subtitle">{t("aboutPredictix.welcome")}</h6>
          <h2>
            <Trans
              k="aboutPredictix.title"
              components={{ highlight: <span className="highlight" /> }}
            />
          </h2>
          <p className="info-page__lead">{t("aboutPredictix.lead")}</p>
        </div>

        <h3 className="info-page__section-title">
          {t("aboutPredictix.predictsTitle")}
        </h3>
        <div className="info-page__grid">
          {predictors.map((id) => (
            <div className="info-card" key={id}>
              <h4>{t(`aboutPredictix.${id}Title`)}</h4>
              <p className="info-card__tag">{t(`aboutPredictix.${id}Model`)}</p>
              <p>{t(`aboutPredictix.${id}Input`)}</p>
            </div>
          ))}
        </div>

        <h3 className="info-page__section-title">
          {t("aboutPredictix.featuresTitle")}
        </h3>
        <div className="info-page__grid">
          {features.map((id) => (
            <div className="info-card" key={id}>
              <h4>{t(`aboutPredictix.feature${id}Title`)}</h4>
              <p>{t(`aboutPredictix.feature${id}Text`)}</p>
            </div>
          ))}
        </div>

        <h3 className="info-page__section-title">
          {t("aboutPredictix.howTitle")}
        </h3>
        <ol className="info-page__steps">
          {steps.map((id) => (
            <li key={id}>{t(`aboutPredictix.${id}`)}</li>
          ))}
        </ol>

        <div className="info-page__note">
          <Trans
            k="aboutPredictix.disclaimer"
            components={{ strong: <strong /> }}
          />
        </div>

        <div className="info-page__cta">
          <Link to="/predictors" className="btn btn-primary">
            {t("aboutPredictix.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default AboutPredictixPage;
