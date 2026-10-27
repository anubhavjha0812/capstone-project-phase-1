import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaUserCircle, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "../App.css";
import { Trans, useI18n } from "../i18n/I18nContext";
import { UserContext } from "../context/UserContext";
import PredictionHistory from "../components/PredictionHistory";

const API = "http://localhost:8080/api/v1";

// Maps a failed server response to a translated message
const errorKey = (status, field) => {
  if (status === 401) return "account.wrongPassword";
  if (status === 409) return field === "email" ? "account.emailTaken" : "account.usernameTaken";
  if (status === 400) return field === "email" ? "account.invalidEmail" : "account.invalidUsername";
  return "account.failed";
};

// Inline form used by "Change email" and "Change username"
function ChangeForm({ field, onDone, onCancel }) {
  const { t } = useI18n();
  const { setUserInfo } = useContext(UserContext);
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const clean = value.trim().toLowerCase();
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("account.invalidEmail");
      return;
    }
    if (field === "username" && !/^[a-z0-9]{3,20}$/.test(clean)) {
      setError("account.invalidUsername");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/users/${field}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          field === "email"
            ? { newEmail: clean, password }
            : { newUsername: clean, password }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorKey(res.status, field));
        return;
      }
      setUserInfo(data.data);
      onDone(field === "email" ? "account.emailUpdated" : "account.usernameUpdated");
    } catch {
      setError("common.serverDown");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="account-form" onSubmit={submit} noValidate>
      <label>
        {field === "email" ? t("account.newEmail") : t("account.newUsername")}
        <input
          type={field === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </label>
      <label>
        {t("account.currentPassword")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="account-msg error">{t(error)}</p>}
      <div className="account-form__actions">
        <button type="submit" className="account-btn primary" disabled={saving || !password}>
          {saving ? t("account.saving") : t("account.save")}
        </button>
        <button type="button" className="account-btn" onClick={onCancel}>
          {t("account.cancel")}
        </button>
      </div>
    </form>
  );
}

function AccountPage() {
  const { t, language } = useI18n();
  const { userInfo, setUserInfo } = useContext(UserContext);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(null); // "email" | "username" | null
  const [notice, setNotice] = useState(null);
  const [subscription, setSubscription] = useState(null); // { subscribed, email, subscribedAt }
  const [subError, setSubError] = useState(false); // newsletter status could not be loaded
  const [subBusy, setSubBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState(null);

  // Newsletter status; on failure show a message with "Try again" instead of loading forever
  const loadSubscription = () => {
    setSubError(false);
    setSubscription(null);
    fetch(`${API}/newsletter/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setSubscription(data.data))
      .catch(() => setSubError(true));
  };

  // Load account details and newsletter status
  useEffect(() => {
    fetch(`${API}/users/profile`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setProfile(data.data))
      .catch(() => {});
    loadSubscription();
  }, [userInfo?.email, userInfo?.username]);

  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date(value))
      : "—";

  const user = profile || userInfo || {};
  const memberSince = formatDate(user.createdAt);

  const toggleSubscription = async () => {
    setSubBusy(true);
    try {
      const res = await fetch(`${API}/newsletter/me`, {
        method: subscription?.subscribed ? "DELETE" : "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSubscription(data.data);
      else setNotice({ type: "error", key: "account.failed" });
    } catch {
      setNotice({ type: "error", key: "common.serverDown" });
    } finally {
      setSubBusy(false);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError(null);
    try {
      const res = await fetch(`${API}/users/me`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        setDeleteError(res.status === 401 ? "account.wrongPassword" : "account.failed");
        return;
      }
      setUserInfo(null);
      navigate("/", { replace: true });
    } catch {
      setDeleteError("common.serverDown");
    }
  };

  const rows = [
    { label: "account.fullName", value: user.fullname },
    { label: "account.username", value: user.username, field: "username", action: "account.changeUsername" },
    { label: "account.email", value: user.email, field: "email", action: "account.changeEmail" },
    { label: "account.memberSince", value: memberSince },
  ];

  return (
    <section className="info-page">
      <div className="info-page__inner account-page">
        <div className="info-page__header">
          <FaUserCircle className="account-avatar" aria-hidden="true" />
          <h2>
            <Trans k="account.title" components={{ highlight: <span className="highlight" /> }} />
          </h2>
        </div>

        {notice && (
          <p className={`account-msg ${notice.type}`} role="status">
            {t(notice.key)}
          </p>
        )}

        <div className="account-card">
          <h3>{t("account.detailsTitle")}</h3>
          <dl className="account-details">
            {rows.map((row) => (
              <div className="account-row" key={row.label}>
                <dt>{t(row.label)}</dt>
                <dd>
                  <span>{row.value || "—"}</span>
                  {row.field && editing !== row.field && (
                    <button
                      type="button"
                      className="account-btn"
                      onClick={() => {
                        setEditing(row.field);
                        setNotice(null);
                      }}
                    >
                      {t(row.action)}
                    </button>
                  )}
                </dd>
                {editing === row.field && (
                  <ChangeForm
                    field={row.field}
                    onCancel={() => setEditing(null)}
                    onDone={(key) => {
                      setEditing(null);
                      setNotice({ type: "success", key });
                    }}
                  />
                )}
              </div>
            ))}
          </dl>
        </div>

        <div className="account-card">
          <h3>{t("account.subscriptionTitle")}</h3>
          <p className="account-note">{t("account.newsletterAbout")}</p>
          {subError ? (
            <div className="account-row-inline">
              <p className="account-msg error">{t("account.loadFailed")}</p>
              <button type="button" className="account-btn" onClick={loadSubscription}>
                {t("account.retry")}
              </button>
            </div>
          ) : !subscription ? (
            <p>{t("account.loading")}</p>
          ) : (
            <>
              <dl className="account-details">
                <div className="account-row">
                  <dt>{t("account.status")}</dt>
                  <dd>
                    <span
                      className={`account-status ${subscription.subscribed ? "on" : "off"}`}
                    >
                      {subscription.subscribed ? (
                        <FaCheckCircle aria-hidden="true" />
                      ) : (
                        <FaTimesCircle aria-hidden="true" />
                      )}
                      {subscription.subscribed ? t("account.statusOn") : t("account.statusOff")}
                    </span>
                    <button
                      type="button"
                      className={`account-btn ${subscription.subscribed ? "" : "primary"}`}
                      onClick={toggleSubscription}
                      disabled={subBusy}
                    >
                      {subscription.subscribed ? t("account.unsubscribe") : t("account.subscribe")}
                    </button>
                  </dd>
                </div>
                <div className="account-row">
                  <dt>{t("account.sentTo")}</dt>
                  <dd>
                    <span>{subscription.email}</span>
                  </dd>
                </div>
                {subscription.subscribed && (
                  <div className="account-row">
                    <dt>{t("account.subscribedSince")}</dt>
                    <dd>
                      <span>{formatDate(subscription.subscribedAt)}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>

        <PredictionHistory />

        <div className="account-card danger">
          <h3>{t("account.deleteTitle")}</h3>
          <p>{t("account.deleteWarning")}</p>
          {!deleting ? (
            <button type="button" className="account-btn danger" onClick={() => setDeleting(true)}>
              {t("account.deleteButton")}
            </button>
          ) : (
            <form className="account-form" onSubmit={deleteAccount} noValidate>
              <label>
                {t("account.deleteConfirm")}
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </label>
              {deleteError && <p className="account-msg error">{t(deleteError)}</p>}
              <div className="account-form__actions">
                <button type="submit" className="account-btn danger" disabled={!deletePassword}>
                  {t("account.deleteFinal")}
                </button>
                <button
                  type="button"
                  className="account-btn"
                  onClick={() => {
                    setDeleting(false);
                    setDeletePassword("");
                    setDeleteError(null);
                  }}
                >
                  {t("account.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default AccountPage;
