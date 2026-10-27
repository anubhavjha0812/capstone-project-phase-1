import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { Trans, useI18n } from "../i18n/I18nContext";

const MAX_MESSAGE = 2000;

function ContactPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState(null); // { type: "success" | "error", key }
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const message = form.message.trim();

    if (!name) {
      setStatus({ type: "error", key: "contact.errName" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ type: "error", key: "contact.errEmail" });
      return;
    }
    if (message.length < 10) {
      setStatus({ type: "error", key: "contact.errMessage" });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch("http://localhost:8080/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      if (!response.ok) {
        // Map the server's status to a translated message
        const key =
          response.status === 429
            ? "contact.tooMany"
            : response.status === 503
            ? "contact.notSent"
            : "contact.failed";
        setStatus({ type: "error", key });
        return;
      }

      setStatus({ type: "success", key: "contact.sent" });
      setForm({ name: "", email: "", message: "" });
    } catch {
      setStatus({ type: "error", key: "common.serverDown" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="info-page">
      <div className="info-page__inner">
        <div className="info-page__header">
          <h2>
            <Trans
              k="contact.title"
              components={{ highlight: <span className="highlight" /> }}
            />
          </h2>
          <p className="info-page__lead">{t("contact.lead")}</p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="contact-name">{t("contact.name")}</label>
          <input
            id="contact-name"
            name="name"
            type="text"
            maxLength={100}
            value={form.name}
            onChange={handleChange}
          />

          <label htmlFor="contact-email">{t("contact.email")}</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
          />

          <label htmlFor="contact-message">{t("contact.message")}</label>
          <textarea
            id="contact-message"
            name="message"
            rows={6}
            maxLength={MAX_MESSAGE}
            value={form.message}
            onChange={handleChange}
          />
          <p className="contact-form__count">
            {form.message.length}/{MAX_MESSAGE}
          </p>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t("contact.sending") : t("contact.send")}
          </button>

          <p
            className={`contact-form__status ${status ? status.type : ""}`}
            role="status"
          >
            {status && t(status.key)}
          </p>

          <p className="contact-form__note">
            <Trans
              k="contact.note"
              components={{ link: <Link to="/privacy-policy" /> }}
            />
          </p>
        </form>
      </div>
    </section>
  );
}

export default ContactPage;
