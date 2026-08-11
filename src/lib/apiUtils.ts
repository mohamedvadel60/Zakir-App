import { auth } from "../firebase.js";

/**
 * Standardized authenticated fetch helper that automatically retrieves
 * the current Firebase ID Token and attaches it in the Authorization header.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const currentUser = auth.currentUser;
  const headers = new Headers(options.headers || {});

  let tokenAttached = false;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        tokenAttached = true;
      }
    } catch (err) {
      console.warn("[authenticatedFetch] Failed to retrieve Firebase auth token:", err);
    }
  }

  if (!tokenAttached) {
    try {
      const raw = localStorage.getItem("currentUser");
      if (raw) {
        const u = JSON.parse(raw);
        if (u && (u.id || u.uid)) {
          headers.set("Authorization", `Bearer ${u.id || u.uid}`);
        }
      }
    } catch (e) {}
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Returns an object containing the Authorization Bearer header if a user is logged in.
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) return { Authorization: `Bearer ${token}` };
    } catch (err) {
      console.warn("[getAuthHeader] Failed to retrieve Firebase ID token:", err);
    }
  }

  try {
    const raw = localStorage.getItem("currentUser");
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.id || u.uid)) {
        return { Authorization: `Bearer ${u.id || u.uid}` };
      }
    }
  } catch (e) {}

  return {};
}
