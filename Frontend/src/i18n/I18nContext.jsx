import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "./locales/en";
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage } from "./languages";

const STORAGE_KEY = "language";

// Each language file is loaded only when it is chosen, to keep the site fast
// (English is imported directly above, so it is excluded here)
const loaders = import.meta.glob(["./locales/*.js", "!./locales/en.js"]);

const I18nContext = createContext(null);

const lookup = (dict, key) =>
  key.split(".").reduce((obj, part) => (obj == null ? undefined : obj[part]), dict);

const interpolate = (text, vars) =>
  vars
    ? text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
        vars[name] !== undefined ? String(vars[name]) : match
      )
    : text;

const initialLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    // Storage unavailable: fall through
  }
  // First visit: use the browser's language if we support it
  const browser = (navigator.language || "").toLowerCase().split("-")[0];
  return LANGUAGES.some((l) => l.code === browser) ? browser : DEFAULT_LANGUAGE;
};

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [messages, setMessages] = useState(language === "en" ? en : null);

  useEffect(() => {
    let cancelled = false;
    if (language === "en") {
      setMessages(en);
    } else {
      const load = loaders[`./locales/${language}.js`];
      if (load) {
        load()
          .then((mod) => !cancelled && setMessages(mod.default))
          .catch(() => !cancelled && setMessages(en));
      } else {
        setMessages(en);
      }
    }

    const { dir = "ltr" } = getLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = dir;

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((code) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Ignore: the choice just won't be remembered
    }
  }, []);

  // Translate a key; falls back to English if a translation is missing
  const t = useCallback(
    (key, vars) => {
      const value = lookup(messages || en, key) ?? lookup(en, key);
      if (typeof value !== "string") return value ?? key;
      return interpolate(value, vars);
    },
    [messages]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, dir: getLanguage(language).dir || "ltr" }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/**
 * Renders a translation that contains simple tags, e.g.
 *   "See our <link>Privacy Policy</link>."
 * with components={{ link: <Link to="/privacy-policy" /> }}
 */
export function Trans({ k, vars, components = {} }) {
  const { t } = useI18n();
  const text = t(k, vars);
  const parts = [];
  const regex = /<(\w+)>(.*?)<\/\1>/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const [, tag, inner] = match;
    const component = components[tag];
    parts.push(
      component
        ? React.cloneElement(component, { key: i++ }, inner)
        : inner
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
