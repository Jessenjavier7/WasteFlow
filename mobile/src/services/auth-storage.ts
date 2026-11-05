import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "wasteflow_mobile_access_token";
const USER_KEY = "wasteflow_mobile_user";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
};

export async function saveAuthData(accessToken: string, user: AuthUser) {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);

  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const value = await SecureStore.getItemAsync(USER_KEY);

  if (!value) return null;

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    return null;
  }
}

export async function clearAuthData() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}
