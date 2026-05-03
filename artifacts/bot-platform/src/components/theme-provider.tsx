import { useEffect } from "react";
import { useGetPlatformConfig } from "@workspace/api-client-react";

const VALID_THEMES = ["green", "blue", "purple", "black"] as const;
type ThemeName = (typeof VALID_THEMES)[number];

function isValidTheme(t: unknown): t is ThemeName {
  return typeof t === "string" && (VALID_THEMES as readonly string[]).includes(t);
}

/**
 * Reads the theme set in the bot's app.json (`theme` field) and applies it to
 * the root <html> element via a data-theme attribute. CSS variables in
 * index.css drive the visual swap.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const cfg = useGetPlatformConfig();
  const themeRaw = cfg.data?.botAppJson?.theme;
  const theme: ThemeName = isValidTheme(themeRaw) ? themeRaw : "green";

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    return () => {
      // Don't strip on unmount — the provider lives at the app root.
    };
  }, [theme]);

  return <>{children}</>;
}
