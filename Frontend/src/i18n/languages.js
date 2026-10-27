// Languages offered in the language switcher.
// The first 10 match DxGPT's languages; Tamil and other widely spoken languages follow.
// `name` is the language's own name, so people can find their language.
export const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "pt", name: "Português" },
  { code: "ru", name: "Русский" },
  { code: "uk", name: "Українська" },
  { code: "pl", name: "Polski" },
  { code: "ca", name: "Català" },
  { code: "hi", name: "हिन्दी" },
  { code: "ta", name: "தமிழ்" },
  { code: "zh", name: "中文（简体）" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "bn", name: "বাংলা" },
  { code: "ur", name: "اردو", dir: "rtl" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ja", name: "日本語" },
  { code: "tr", name: "Türkçe" },
  { code: "ko", name: "한국어" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "it", name: "Italiano" },
];

export const DEFAULT_LANGUAGE = "en";

export const getLanguage = (code) =>
  LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];
