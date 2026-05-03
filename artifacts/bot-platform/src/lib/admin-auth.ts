import { useEffect, useState } from "react";

const KEY = "wabot.adminPassword";
const EVT = "wabot:admin-auth-changed";

export function getAdminPassword(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminPassword(pw: string) {
  try {
    localStorage.setItem(KEY, pw);
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}

export function clearAdminPassword() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}

export function adminAuthHeaders(): Record<string, string> {
  const pw = getAdminPassword();
  return pw ? { Authorization: `Bearer ${pw}` } : {};
}

/**
 * Reactive hook that returns true if the user has admin credentials stored
 * locally. Updates immediately on login/logout, and across browser tabs via
 * the native `storage` event.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => !!getAdminPassword());
  useEffect(() => {
    const sync = () => setIsAdmin(!!getAdminPassword());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return isAdmin;
}
