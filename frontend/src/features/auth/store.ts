import type { TokenPair, UserProfile, UserRole } from "@/types/auth";

const AUTH_ROLES: UserRole[] = ["admin", "staff"];

const ACTIVE_AUTH_ROLE_KEY = "eye_boutique_active_auth_role";

function accessTokenKey(role: UserRole): string {
  return "eye_boutique_access_token_" + role;
}

function refreshTokenKey(role: UserRole): string {
  return "eye_boutique_refresh_token_" + role;
}

function userProfileKey(role: UserRole): string {
  return "eye_boutique_user_profile_" + role;
}

function isUserRole(value: string | null): value is UserRole {
  return value === "admin" || value === "staff";
}

function firstRoleWithSession(excludeRole?: UserRole): UserRole | null {
  for (const role of AUTH_ROLES) {
    if (excludeRole && role === excludeRole) {
      continue;
    }

    const token = localStorage.getItem(accessTokenKey(role));
    if (token) {
      return role;
    }
  }

  return null;
}

function resolveRole(role?: UserRole): UserRole | null {
  if (role) {
    return role;
  }

  const activeRole = getActiveAuthRole();
  if (activeRole) {
    return activeRole;
  }

  return firstRoleWithSession();
}

export function setActiveAuthRole(role: UserRole) {
  localStorage.setItem(ACTIVE_AUTH_ROLE_KEY, role);
}

export function getActiveAuthRole(): UserRole | null {
  const raw = localStorage.getItem(ACTIVE_AUTH_ROLE_KEY);
  if (isUserRole(raw)) {
    return raw;
  }
  return null;
}

export function setAuthTokens(tokens: TokenPair, role: UserRole) {
  setActiveAuthRole(role);
  localStorage.setItem(accessTokenKey(role), tokens.access_token);
  localStorage.setItem(refreshTokenKey(role), tokens.refresh_token);
}

export function setCurrentUser(user: UserProfile, role: UserRole) {
  localStorage.setItem(userProfileKey(role), JSON.stringify(user));
}

export function getAccessToken(role?: UserRole) {
  const resolvedRole = resolveRole(role);
  if (!resolvedRole) {
    return null;
  }
  return localStorage.getItem(accessTokenKey(resolvedRole));
}

export function getRefreshToken(role?: UserRole) {
  const resolvedRole = resolveRole(role);
  if (!resolvedRole) {
    return null;
  }
  return localStorage.getItem(refreshTokenKey(resolvedRole));
}

export function getCurrentUser(role?: UserRole): UserProfile | null {
  const resolvedRole = resolveRole(role);
  if (!resolvedRole) {
    return null;
  }

  const raw = localStorage.getItem(userProfileKey(resolvedRole));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    localStorage.removeItem(userProfileKey(resolvedRole));
    return null;
  }
}

export function clearCurrentUser(role?: UserRole) {
  const resolvedRole = resolveRole(role);
  if (!resolvedRole) {
    return;
  }

  localStorage.removeItem(userProfileKey(resolvedRole));
}

export function clearAuthTokens(role?: UserRole) {
  const resolvedRole = resolveRole(role);
  if (!resolvedRole) {
    return;
  }

  localStorage.removeItem(accessTokenKey(resolvedRole));
  localStorage.removeItem(refreshTokenKey(resolvedRole));
  localStorage.removeItem(userProfileKey(resolvedRole));

  const activeRole = getActiveAuthRole();
  if (activeRole === resolvedRole) {
    const fallbackRole = firstRoleWithSession(resolvedRole);
    if (fallbackRole) {
      setActiveAuthRole(fallbackRole);
    } else {
      localStorage.removeItem(ACTIVE_AUTH_ROLE_KEY);
    }
  }
}

export function clearAllAuthSessions() {
  for (const role of AUTH_ROLES) {
    localStorage.removeItem(accessTokenKey(role));
    localStorage.removeItem(refreshTokenKey(role));
    localStorage.removeItem(userProfileKey(role));
  }
  localStorage.removeItem(ACTIVE_AUTH_ROLE_KEY);
}
