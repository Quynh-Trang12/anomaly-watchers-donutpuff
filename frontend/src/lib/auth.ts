export type UserRole = "guest" | "user" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  role: "user" | "admin";
  displayName?: string | null;
  email?: string | null;
}

const AUTH_TOKEN_KEY = "aw_auth_token";
const AUTH_USER_KEY = "aw_auth_user";

function parseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (
      typeof parsed?.id === "string" &&
      typeof parsed?.username === "string" &&
      (parsed?.role === "user" || parsed?.role === "admin")
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  return parseUser(localStorage.getItem(AUTH_USER_KEY));
}

export function setAuthSession(token: string, user: AuthUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken() && !!getCurrentUser();
}

export function getCurrentRole(): UserRole {
  const user = getCurrentUser();
  return user?.role ?? "guest";
}
