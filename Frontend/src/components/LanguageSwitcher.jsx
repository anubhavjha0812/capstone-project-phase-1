import React, { useEffect, useRef, useState } from "react";
import { FaGlobe, FaCheck } from "react-icons/fa";
import { useI18n } from "../i18n/I18nContext";
import { LANGUAGES, getLanguage } from "../i18n/languages";

function LanguageSwitcher({ floating = false }) {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  return (
    <div
      ref={ref}
      className={`language-switcher ${floating ? "language-switcher--floating" : ""}`}
    >
      <button
        type="button"
        className="language-switcher__button"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("language.label")}
        title={t("language.label")}
      >
        <FaGlobe aria-hidden="true" />
        <span className="language-switcher__current">
          {getLanguage(language).name}
        </span>
      </button>

      {open && (
        <ul className="language-switcher__menu" role="menu">
          {LANGUAGES.map((lang) => (
            <li key={lang.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={lang.code === language}
                lang={lang.code}
                dir={lang.dir || "ltr"}
                className={lang.code === language ? "selected" : ""}
                onClick={() => choose(lang.code)}
              >
                <span>{lang.name}</span>
                {lang.code === language && <FaCheck aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LanguageSwitcher;
