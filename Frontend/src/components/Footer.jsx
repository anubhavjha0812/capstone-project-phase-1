import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaEnvelope, FaBell } from "react-icons/fa";
import logoIcon from "../assets/LogoIcon.png";
import { useI18n } from "../i18n/I18nContext";

const columns = [
  {
    title: "footer.colPredictix",
    links: [
      { to: "/about-predictix", key: "nav.aboutPredictix" },
      { to: "/integration", key: "nav.integration" },
      { to: "/faqs", key: "nav.faqs" },
      { to: "/about", key: "nav.aboutUs" },
    ],
  },
  {
    title: "footer.colPredictors",
    links: [
      { to: "/predictors/heart", key: "footer.heart" },
      { to: "/predictors/diabetes", key: "footer.diabetes" },
      { to: "/predictors/lung", key: "footer.lung" },
      { to: "/predictors/breast", key: "predictors.breastTitle" },
    ],
  },
  {
    title: "footer.colCompliance",
    links: [
      { to: "/privacy-policy", key: "nav.privacyPolicy" },
      { to: "/privacy-policy#cookies", key: "footer.cookies" },
    ],
  },
];

function Footer() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { type: "success" | "error", text }
  const [loading, setLoading] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setStatus({ type: "error", text: t("footer.invalidEmail") });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/newsletter/subscribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        }
      );

      if (!response.ok) {
        setStatus({
          type: "error",
          text:
            response.status === 400
              ? t("footer.invalidEmail")
              : t("footer.subscribeFailed"),
        });
        return;
      }

      // 201 = new subscription, 200 = this email was already subscribed
      setStatus({
        type: "success",
        text:
          response.status === 201
            ? t("footer.subscribed")
            : t("footer.alreadySubscribed"),
      });
      setEmail("");
    } catch {
      setStatus({
        type: "error",
        text: t("footer.serverDown"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__columns">
          {columns.map((column) => (
            <div className="site-footer__column" key={column.title}>
              <h4 className="site-footer__heading">{t(column.title)}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to}>{t(link.key)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="site-footer__actions">
          <Link to="/contact" className="site-footer__contact">
            <FaEnvelope aria-hidden="true" /> {t("footer.contact")}
          </Link>

          <form className="site-footer__updates" onSubmit={subscribe}>
            <label htmlFor="footer-newsletter" className="site-footer__updates-label">
              <FaBell aria-hidden="true" /> {t("footer.updates")}
            </label>
            <div className="site-footer__updates-row">
              <input
                id="footer-newsletter"
                type="email"
                placeholder={t("footer.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby="footer-newsletter-status"
              />
              <button type="submit" disabled={loading}>
                {loading ? "..." : t("footer.subscribe")}
              </button>
            </div>
            <p
              id="footer-newsletter-status"
              className={`site-footer__status ${status ? status.type : ""}`}
              role="status"
            >
              {status?.text}
            </p>
          </form>

          <Link to="/" className="site-footer__brand">
            <img src={logoIcon} alt="" />
            <span>Predictix</span>
          </Link>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Predictix</p>
        <p>{t("footer.disclaimer")}</p>
      </div>
    </footer>
  );
}

export default Footer;
