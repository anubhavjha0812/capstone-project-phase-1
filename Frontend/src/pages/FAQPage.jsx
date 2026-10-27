import React, { useState } from "react";
import "../App.css";
import { Trans, useI18n } from "../i18n/I18nContext";

const faqIds = [1, 2, 3, 4, 5, 6, 7, 8];

function FAQPage() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="info-page">
      <div className="info-page__inner">
        <div className="info-page__header">
          <h2>
            <Trans
              k="faq.title"
              components={{ highlight: <span className="highlight" /> }}
            />
          </h2>
        </div>

        <div className="faq-list">
          {faqIds.map((id, index) => (
            <div
              className={`faq-item ${openIndex === index ? "open" : ""}`}
              key={id}
            >
              <button
                type="button"
                className="faq-question"
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
              >
                <span>{t(`faq.q${id}`)}</span>
                <span className="faq-icon">
                  {openIndex === index ? "−" : "+"}
                </span>
              </button>
              {openIndex === index && (
                <p className="faq-answer">{t(`faq.a${id}`)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FAQPage;
