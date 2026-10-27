import React from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { Trans, useI18n } from "../i18n/I18nContext";

// Tags that may appear inside privacy policy translations
const rich = {
  strong: <strong />,
  code: <code />,
  link: <Link to="/contact" />,
  account: <Link to="/account" />,
};

const P = ({ k }) => <Trans k={`privacy.${k}`} components={rich} />;

function PrivacyPolicyPage() {
  const { t, language } = useI18n();
  const p = (k) => t(`privacy.${k}`);

  const storageRows = [
    ["rowAccount", "rowAccountStored", "rowAccountLong"],
    ["rowHealth", "rowHealthStored", "rowHistoryLong"],
    ["rowUploads", "rowUploadsStored", "rowUploadsLong"],
    ["rowCtCopy", "rowCtCopyStored", "rowHistoryLong"],
    ["rowResults", "rowResultsStored", "rowHistoryLong"],
    ["rowOtp", "rowOtpStored", "rowOtpLong"],
    ["rowContact", "rowContactStored", "rowContactLong"],
    ["rowNewsletter", "rowAccountStored", "rowNewsletterLong"],
  ];

  return (
    <section className="info-page">
      <div className="info-page__inner policy">
        <div className="info-page__header">
          <h2>
            <Trans
              k="privacy.title"
              components={{ highlight: <span className="highlight" /> }}
            />
          </h2>
          <p className="info-page__lead">
            {t("privacy.effective", { date: p("effectiveDate") })}
          </p>
        </div>

        {language !== "en" && (
          <p className="policy-translation-note">{p("translationNote")}</p>
        )}

        <p>{p("intro")}</p>

        <h3 className="info-page__section-title">{p("s1")}</h3>
        <h4>{p("accountHeading")}</h4>
        <p>{p("accountIntro")}</p>
        <ul>
          <li>{p("fullName")}</li>
          <li>{p("username")}</li>
          <li>{p("email")}</li>
          <li>{p("password")}</li>
        </ul>

        <h4>{p("healthHeading")}</h4>
        <ul>
          <li><P k="healthHeart" /></li>
          <li><P k="healthDiabetes" /></li>
          <li><P k="healthLung" /></li>
        </ul>
        <p>{p("healthComingSoon")}</p>

        <h4>{p("filesHeading")}</h4>
        <ul>
          <li>{p("filesPdf")}</li>
          <li>{p("filesCt")}</li>
        </ul>

        <h4>{p("resetHeading")}</h4>
        <p>{p("resetText")}</p>

        <h4>{p("contactHeading")}</h4>
        <p><P k="contactText" /></p>

        <h4>{p("newsletterHeading")}</h4>
        <p>{p("newsletterText")}</p>

        <h4>{p("languageHeading")}</h4>
        <p>{p("languageText")}</p>

        <h3 className="info-page__section-title">{p("s2")}</h3>
        <ul>
          {["use1", "use2", "use3", "use4", "use5", "use6", "use7"].map((k) => (
            <li key={k}>{p(k)}</li>
          ))}
        </ul>
        <p>{p("noSell")}</p>

        <h3 className="info-page__section-title">{p("s3")}</h3>
        <div className="policy-table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>{p("thInfo")}</th>
                <th>{p("thStored")}</th>
                <th>{p("thHowLong")}</th>
              </tr>
            </thead>
            <tbody>
              {storageRows.map(([info, stored, howLong]) => (
                <tr key={info}>
                  <td>{p(info)}</td>
                  <td>{p(stored)}</td>
                  <td>{p(howLong)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="info-page__section-title" id="cookies">
          {p("s4")}
        </h3>
        <ul>
          <li><P k="cookiesLogin" /></li>
          <li><P k="cookiesLocal" /></li>
          <li>{p("cookiesNone")}</li>
        </ul>

        <h3 className="info-page__section-title">{p("s5")}</h3>
        <p>{p("reportText")}</p>

        <h3 className="info-page__section-title">{p("s6")}</h3>
        <ul>
          <li><P k="tpGmail" /></li>
          <li><P k="tpMongo" /></li>
          <li><P k="tpFonts" /></li>
        </ul>
        <p>{p("tpHealth")}</p>

        <h3 className="info-page__section-title">{p("s7")}</h3>
        <ul>
          {["sec1", "sec2", "sec3", "sec4"].map((k) => (
            <li key={k}>{p(k)}</li>
          ))}
        </ul>
        <p>{p("secNote")}</p>

        <h3 className="info-page__section-title">{p("s8")}</h3>
        <p>{p("logsText")}</p>

        <h3 className="info-page__section-title">{p("s9")}</h3>
        <ul>
          <li>{p("choice1")}</li>
          <li>{p("choice2")}</li>
          <li><P k="choice3" /></li>
          <li>{p("choice4")}</li>
          <li><P k="choice5" /></li>
          <li><P k="choice6" /></li>
          <li><P k="choice7" /></li>
        </ul>

        <h3 className="info-page__section-title">{p("s10")}</h3>
        <p>{p("medicalText")}</p>

        <h3 className="info-page__section-title">{p("s11")}</h3>
        <p>{p("changesText")}</p>
      </div>
    </section>
  );
}

export default PrivacyPolicyPage;
