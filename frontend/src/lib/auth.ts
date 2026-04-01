export type UserRole = "guest" | "user" | "admin";

const AUTH_ROLE_KEY = "aw_demo_role";

function isValidRole(value: string | null): value is UserRole {
  return value === "guest" || value === "user" || value === "admin";
}

export function getCurrentRole(): UserRole {
  const raw = localStorage.getItem(AUTH_ROLE_KEY);
  return isValidRole(raw) ? raw : "guest";
}

export function setCurrentRole(role: UserRole): void {
  localStorage.setItem(AUTH_ROLE_KEY, role);
}

export function clearCurrentRole(): void {
  localStorage.removeItem(AUTH_ROLE_KEY);
}

