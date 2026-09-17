import { useEffect, useState } from "react";

/**
 * Reveals `text` progressively, standing in for real token streaming (the
 * server returns each reply as one complete string — see interview.server.ts).
 * Disabled instantly (full text shown) when `enabled` is false or the user
 * prefers reduced motion.
 */
export function useTypewriter(text: string, enabled: boolean): string {
  const [shown, setShown] = useState(enabled ? "" : text);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setShown(text);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }

    setShown("");
    const tokens = text.match(/\S+\s*/g) ?? [text];
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(tokens.slice(0, i).join(""));
      if (i >= tokens.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [text, enabled]);

  return shown;
}
