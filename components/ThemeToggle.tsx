"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const KEY = "pm-theme";

// The <html data-theme> attribute is the single source of truth; the inline script in layout sets it before paint.
function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Sun/moon switch. The choice is remembered in this browser only; storage may be blocked, so every access is guarded. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice just won't persist */ }
  }

  return (
    <button onClick={toggle} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 transition hover:border-ink-300 hover:text-ink-900">
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
