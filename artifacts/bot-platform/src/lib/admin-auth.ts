const KEY = "wabot.adminPassword";

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
  } catch {
    /* ignore */
  }
}

export function clearAdminPassword() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function adminAuthHeaders(): Record<string, string> {
  const pw = getAdminPassword();
  return pw ? { Authorization: `Bearer ${pw}` } : {};
}
