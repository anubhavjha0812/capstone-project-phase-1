import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaHeartbeat, FaTint, FaLungs, FaTrashAlt } from "react-icons/fa";
import { useI18n } from "../i18n/I18nContext";
import { HEART_CHOICES, HEART_FIELDS, DIABETES_FIELDS, LUNG_QUESTIONS, pct } from "../predictors/fields";

const API = "http://localhost:8080/api/v1";

const ICONS = { heart: FaHeartbeat, diabetes: FaTint, lung: FaLungs };

// A lung check's CT scan and questionnaire are saved separately but share a session:
// show them as one card. Everything else is one card per prediction.
const groupEntries = (entries) => {
  const groups = [];
  const bySession = new Map();
  for (const e of entries) {
    const isLung = e.type === "lung_ct" || e.type === "lung_survey";
    if (isLung && e.session) {
      if (!bySession.has(e.session)) {
        const g = { key: e.session, kind: "lung", entries: [] };
        bySession.set(e.session, g);
        groups.push(g);
      }
      bySession.get(e.session).entries.push(e);
    } else {
      groups.push({ key: e.id, kind: isLung ? "lung" : e.type, entries: [e] });
    }
  }
  // Newest entry of the group decides its date; entries are already newest first
  return groups.map((g) => ({ ...g, createdAt: g.entries[0].createdAt }));
};

function HeartDetails({ inputs, t }) {
  return HEART_FIELDS.map((f) => {
    const raw = inputs[f.api];
    const choice = HEART_CHOICES[f.name]?.find((c) => c.value === String(raw));
    const value = choice ? (choice.key ? t(choice.key) : choice.label) : raw;
    return (
      <div key={f.api}>
        <dt>{t(f.label)}</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    );
  });
}

function DiabetesDetails({ inputs, t }) {
  return DIABETES_FIELDS.map((f) => (
    <div key={f.api}>
      <dt>{t(f.label)}</dt>
      <dd>{f.zeroOk && Number(inputs[f.api]) === 0 ? t("history.notMeasured") : inputs[f.api] ?? "—"}</dd>
    </div>
  ));
}

function SurveyDetails({ inputs, t }) {
  return (
    <>
      <div>
        <dt>{t("lung.gender")}</dt>
        <dd>{Number(inputs.gender) === 1 ? t("predict.male") : t("predict.female")}</dd>
      </div>
      <div>
        <dt>{t("lung.age")}</dt>
        <dd>{inputs.age}</dd>
      </div>
      {LUNG_QUESTIONS.map((q) => (
        <div key={q}>
          <dt>{t(`lung.${q}`)}</dt>
          <dd>{Number(inputs[q]) === 1 ? t("predict.yes") : t("predict.no")}</dd>
        </div>
      ))}
    </>
  );
}

const BREAST_LABELS = {
  high: "High-grade tumour tissue",
  low: "Low-grade tumour tissue",
  stroma: "Stroma (non-tumour tissue)",
};

// One result line (+ the CT image) for a single saved prediction
function EntryResult({ entry, t }) {
  const r = entry.result || {};
  let concern = false;
  let text = "";
  if (entry.type === "heart") {
    concern = r.prediction === "1";
    text = t(concern ? "heart.positive" : "heart.negative");
  } else if (entry.type === "diabetes") {
    concern = r.prediction === "1";
    text = t(concern ? "diabetes.positive" : "diabetes.negative");
  } else if (entry.type === "lung_survey") {
    concern = r.prediction === "1";
    text = `${t(concern ? "lung.positive" : "lung.negative")} · ${t("lung.probability", { percent: pct(r.probability) })}`;
  } else if (entry.type === "breast") {
    concern = r.grade === "high" || r.grade === "low";
    const top = r.probabilities?.[r.grade];
    text = `${BREAST_LABELS[r.grade] ?? r.grade}${top != null ? ` · ${pct(top)}%` : ""}`;
  } else if (entry.type === "lung_ct") {
    concern = r.prediction === "malignant";
    text = `${t(concern ? "lung.ctMalignant" : "lung.ctNotMalignant")} · ${t("lung.ctRisk")} ${pct(r.probability)}%`;
  }
  return (
    <div className="history-result">
      {entry.type === "lung_ct" && entry.image && (
        <img
          className="history-scan"
          src={`${API}/history/${entry.id}/image`}
          alt={t("history.scanImageAlt")}
          loading="lazy"
        />
      )}
      {(entry.type === "lung_ct" || entry.type === "lung_survey") && (
        <span className="history-part">
          {t(entry.type === "lung_ct" ? "history.ctPart" : "history.surveyPart")}
        </span>
      )}
      <span className={`history-badge ${concern ? "concern" : "clear"}`}>{text}</span>
    </div>
  );
}

function PredictionHistory() {
  const { t, language } = useI18n();
  const [entries, setEntries] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(null); // group key, or "all"
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError(false);
    setEntries(null);
    fetch(`${API}/history`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setEntries(data.data || []))
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  const formatDateTime = (value) =>
    new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const remove = async (group) => {
    setBusy(true);
    setNotice(null);
    try {
      const target = group === "all" ? `${API}/history` : `${API}/history/${group.entries[0].id}?session=1`;
      // Groups without a session hold a single entry, so ?session=1 only matters for lung checks
      const res = await fetch(target, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (group === "all") {
        setEntries([]);
        setNotice({ type: "success", key: "history.allDeleted" });
      } else {
        const ids = new Set(group.entries.map((e) => e.id));
        setEntries((prev) => prev.filter((e) => !ids.has(e.id)));
        setNotice({ type: "success", key: "history.deleted" });
      }
    } catch {
      setNotice({ type: "error", key: "account.failed" });
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const groups = entries ? groupEntries(entries) : [];

  return (
    <div className="account-card">
      <div className="history-header">
        <h3>{t("history.title")}</h3>
        {groups.length > 0 && confirming !== "all" && (
          <button type="button" className="account-btn danger" onClick={() => setConfirming("all")} disabled={busy}>
            {t("history.deleteAll")}
          </button>
        )}
      </div>
      <p className="account-note">{t("history.intro")}</p>

      {confirming === "all" && (
        <div className="history-confirm" role="alert">
          <p>{t("history.confirmDeleteAll", { count: groups.length })}</p>
          <div className="account-form__actions">
            <button type="button" className="account-btn danger" onClick={() => remove("all")} disabled={busy}>
              {t("history.yesDelete")}
            </button>
            <button type="button" className="account-btn" onClick={() => setConfirming(null)}>
              {t("account.cancel")}
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className={`account-msg ${notice.type}`} role="status">
          {t(notice.key)}
        </p>
      )}

      {loadError ? (
        <div className="account-row-inline">
          <p className="account-msg error">{t("history.loadFailed")}</p>
          <button type="button" className="account-btn" onClick={load}>
            {t("account.retry")}
          </button>
        </div>
      ) : entries === null ? (
        <p>{t("account.loading")}</p>
      ) : groups.length === 0 ? (
        <p className="history-empty">
          {t("history.empty")} <Link to="/predictors">{t("history.tryPredictor")}</Link>
        </p>
      ) : (
        <ul className="history-list">
          {groups.map((g) => {
            const Icon = ICONS[g.kind] || FaLungs;
            const survey = g.entries.find((e) => e.type === "lung_survey");
            const main = g.kind === "lung" ? null : g.entries[0];
            return (
              <li key={g.key} className="history-item">
                <div className="history-item__top">
                  <Icon className={`history-icon ${g.kind}`} aria-hidden="true" />
                  <div className="history-item__title">
                    <strong>{t(`history.${g.kind}`)}</strong>
                    <time dateTime={g.createdAt}>{formatDateTime(g.createdAt)}</time>
                  </div>
                  {confirming === g.key ? (
                    <div className="history-item__confirm">
                      <span>{t("history.confirmDelete")}</span>
                      <button type="button" className="account-btn danger" onClick={() => remove(g)} disabled={busy}>
                        {t("history.yesDelete")}
                      </button>
                      <button type="button" className="account-btn" onClick={() => setConfirming(null)}>
                        {t("account.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="account-btn history-delete"
                      onClick={() => setConfirming(g.key)}
                      aria-label={`${t("history.delete")}: ${t(`history.${g.kind}`)}, ${formatDateTime(g.createdAt)}`}
                    >
                      <FaTrashAlt aria-hidden="true" /> {t("history.delete")}
                    </button>
                  )}
                </div>

                {[...g.entries].reverse().map((e) => (
                  <EntryResult key={e.id} entry={e} t={t} />
                ))}

                {(main || survey) && (
                  <details className="history-details">
                    <summary>{t("history.details")}</summary>
                    <dl>
                      {main?.type === "heart" && <HeartDetails inputs={main.inputs} t={t} />}
                      {main?.type === "diabetes" && <DiabetesDetails inputs={main.inputs} t={t} />}
                      {survey && <SurveyDetails inputs={survey.inputs} t={t} />}
                    </dl>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PredictionHistory;
