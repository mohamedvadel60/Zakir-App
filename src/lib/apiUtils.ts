import { auth } from "../firebase.js";

/**
 * Ensures Firebase Auth state is initialized and returns the authenticated user if present.
 */
export async function getAuthenticatedFirebaseUser(): Promise<typeof auth.currentUser> {
  if (!auth.currentUser && typeof auth.authStateReady === "function") {
    try {
      await auth.authStateReady();
    } catch (err) {
      console.warn("[apiUtils] authStateReady wait warning:", err);
    }
  }
  return auth.currentUser;
}

/**
 * Retrieves a fresh, valid Firebase ID Token directly from the client session.
 * If forceRefresh is true, forcibly requests a new token from Google identity backend.
 */
export async function getFreshAuthToken(forceRefresh = false): Promise<string | null> {
  const user = await getAuthenticatedFirebaseUser();
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (err) {
    console.warn("[getFreshAuthToken] Failed to retrieve Firebase ID token:", err);
    return null;
  }
}

/**
 * Standardized authenticated fetch helper that automatically retrieves
 * the current Firebase ID Token, attaches it in the Authorization header,
 * and seamlessly performs a single token refresh & retry on 401 errors.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const user = await getAuthenticatedFirebaseUser();

  if (user) {
    try {
      const token = await user.getIdToken(false);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch (err) {
      console.warn("[authenticatedFetch] Failed to retrieve Firebase auth token:", err);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Handle 401: If token expired, refresh token once and retry request
  if (response.status === 401 && user) {
    try {
      console.info("[authenticatedFetch] 401 Unauthorized received. Refreshing Firebase ID Token and retrying once...");
      const freshToken = await user.getIdToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(options.headers || {});
        retryHeaders.set("Authorization", `Bearer ${freshToken}`);
        return await fetch(url, {
          ...options,
          headers: retryHeaders
        });
      }
    } catch (retryErr) {
      console.warn("[authenticatedFetch] Single retry with fresh token failed:", retryErr);
    }
  }

  return response;
}

/**
 * Returns an object containing the Authorization Bearer header if a user is logged in.
 */
export async function getAuthHeader(forceRefresh = false): Promise<Record<string, string>> {
  const token = await getFreshAuthToken(forceRefresh);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
