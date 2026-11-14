/**
 * Языки интерфейса: RU / EN. Без внешних библиотек — контекст + словари рядом с экранами.
 *
 *   const { lang, setLang } = useLang();
 *   const t = useT(DICT);          // DICT = { ru: {...}, en: {...} } — одинаковые ключи
 *   t.title
 *
 * Выбор хранится в localStorage; при первом визите язык берётся из браузера
 * (русский → ru, любой другой → en — для международного жюри).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ru" | "en";
export const LANGS: Lang[] = ["ru", "en"];
const KEY = "astrohealth.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch { /* приватный режим */ }
  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "ru", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* приватный режим */ }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Словарь текущего языка. Типы проверяют, что в en есть все ключи из ru. */
export function useT<T>(dict: { ru: T; en: T }): T {
  return dict[useLang().lang];
}

/** Переключатель RU | EN (сегментированная кнопка). */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div role="group" aria-label={lang === "ru" ? "Язык интерфейса" : "Interface language"}
      className={`inline-flex h-11 items-center rounded-xl border border-white/20 bg-black/30 p-1 backdrop-blur ${className}`}>
      {LANGS.map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} lang={l}
          className={`h-full min-w-10 rounded-lg px-2 font-mono text-xs font-semibold uppercase tracking-wider transition-colors ${lang === l
            ? "bg-accent-strong text-white"
            : "text-muted hover:text-fg"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}
