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
  const botName = cfg.data?.botName;
  const botLogo = cfg.data?.botLogo ?? cfg.data?.botAppJson?.logo ?? null;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Sync browser tab title with the configured bot name.
  useEffect(() => {
    if (botName && botName.trim().length > 0) {
      document.title = botName;
    }
  }, [botName]);

  // Swap the favicon to the bot's logo when one is provided in app.json.
  // Falls back to the default themed favicon.svg shipped in /public.
  useEffect(() => {
    const link = document.getElementById("app-favicon") as HTMLLinkElement | null;
    if (!link) return;
    if (botLogo && /^https?:\/\//i.test(botLogo)) {
      link.setAttribute("type", "image/png");
      link.href = botLogo;
    } else {
      link.setAttribute("type", "image/svg+xml");
      link.href = "/favicon.svg";
    }
  }, [botLogo]);

  return <>{children}</>;
}
