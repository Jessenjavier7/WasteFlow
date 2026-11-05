import { API_URL } from "@/constants/config";
import { getAccessToken } from "@/services/auth-storage";

export async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Session expired. Please login again.");
  }

  if (!API_URL) {
    throw new Error("API URL belum dikonfigurasi.");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Session expired. Please login again.");
  }

  return response;
}
