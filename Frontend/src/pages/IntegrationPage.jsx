import React from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { useI18n } from "../i18n/I18nContext";

const sections = [
  { title: "userTypesTitle", items: ["individuals", "doctors", "students"] },
  {
    title: "privacyTitle",
    items: ["passwords", "sessions", "uploads", "results", "browserReport", "otp"],
  },
  { title: "useCasesTitle", items: ["screening", "autofill", "image", "sharing"] },
];

function IntegrationPage() {
  const { t } = useI18n();

  return (
    <section className="info-page">
      <div className="info-page__inner">
        <div className="info-page__header">
          <h2>
            <span className="highlight">{t("integration.title")}</span>
          </h2>
          <p className="info-page__lead">{t("integration.lead")}</p>
        </div>

        {sections.map((section) => (
          <React.Fragment key={section.title}>
            <h3 className="info-page__section-title">
              {t(`integration.${section.title}`)}
            </h3>
            <div className="info-page__grid">
              {section.items.map((id) => (
                <div className="info-card" key={id}>
                  <h4>{t(`integration.${id}Title`)}</h4>
                  <p>{t(`integration.${id}Text`)}</p>
                </div>
              ))}
            </div>
            {section.title === "privacyTitle" && (
              <p className="policy-link">
                <Link to="/privacy-policy">{t("integration.policyLink")}</Link>
              </p>
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

export default IntegrationPage;
