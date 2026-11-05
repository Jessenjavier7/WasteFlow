import { API_URL } from "@/constants/config";

import {
  saveAuthData,
  clearAuthData,
  type AuthUser,
} from "@/services/auth-storage";

type AuthResponse = {
  success: boolean;
  message: string;
  accessToken?: string;
  user?: AuthUser;
  errors?: Record<string, string[] | undefined>;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

async function authenticate(
  endpoint: "login" | "register",
  payload: LoginPayload | RegisterPayload,
): Promise<AuthUser> {
  if (!API_URL) {
    throw new Error("API URL belum dikonfigurasi.");
  }

  const response = await fetch(`${API_URL}/api/mobile/auth/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result: AuthResponse = await response.json();

  if (!response.ok || !result.success) {
    const validationErrors = result.errors
      ? Object.values(result.errors).flat().filter(Boolean).join("\n")
      : "";

    throw new Error(
      validationErrors || result.message || "Authentication failed.",
    );
  }

  if (!result.accessToken || !result.user) {
    throw new Error("Invalid authentication response.");
  }

  // Simpan JWT dan informasi user ke SecureStore.
  await saveAuthData(result.accessToken, result.user);

  return result.user;
}

/**
 * Register menggunakan email dan password.
 */
export async function registerWithEmail(
  payload: RegisterPayload,
): Promise<AuthUser> {
  return authenticate("register", payload);
}

/**
 * Login menggunakan email dan password.
 */
export async function loginWithEmail(payload: LoginPayload): Promise<AuthUser> {
  return authenticate("login", payload);
}

/**
 * Logout dari aplikasi mobile.
 */
export async function logout() {
  await clearAuthData();
}
