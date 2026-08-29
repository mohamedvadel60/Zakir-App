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
  if (user) {
    try {
      return await user.getIdToken(forceRefresh);
    } catch (err) {
      console.warn("[getFreshAuthToken] Failed to retrieve Firebase ID token:", err);
    }
  }

  if (typeof window !== "undefined") {
    const localToken = localStorage.getItem("zakir_auth_token");
    if (localToken) return localToken;

    try {
      const storedUser = localStorage.getItem("zakir_current_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.id || parsed?.uid) return parsed.id || parsed.uid;
      }
    } catch (e) {}
  }

  return null;
}

/**
 * Helper to ensure endpoint URL formatted with correct origin or relative path.
 */
function resolveEndpointUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const formattedEndpoint = url.startsWith('/') ? url : `/${url}`;
  
  if (typeof window !== "undefined") {
    const customBase = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_BACKEND_URL;
    if (customBase && typeof customBase === "string" && customBase.trim()) {
      const cleanBase = customBase.trim().replace(/\/$/, '');
      if (window.location.origin && !window.location.origin.includes(cleanBase)) {
        return `${cleanBase}${formattedEndpoint}`;
      }
    }
  }
  return formattedEndpoint;
}

/**
 * Standardized authenticated fetch helper that automatically retrieves
 * the current Firebase ID Token or local session token, attaches it in the Authorization header,
 * and seamlessly performs token refresh & retry on 401 errors.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  let token: string | null = null;

  const user = await getAuthenticatedFirebaseUser();
  if (user) {
    try {
      token = await user.getIdToken(false);
    } catch (err) {
      console.warn("[authenticatedFetch] Failed to retrieve Firebase auth token:", err);
    }
  }

  if (!token && typeof window !== "undefined") {
    token = localStorage.getItem("zakir_auth_token");
    if (!token) {
      try {
        const storedUser = localStorage.getItem("zakir_current_user");
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          token = parsed?.id || parsed?.uid || null;
        }
      } catch (e) {}
    }
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const targetUrl = resolveEndpointUrl(url);

  const executeFetch = async (retryCount = 0): Promise<Response> => {
    try {
      const response = await fetch(targetUrl, {
        ...options,
        headers
      });

      // Handle 401: If token expired, refresh token once and retry request
      if (response.status === 401 && user && retryCount === 0) {
        try {
          console.info("[authenticatedFetch] 401 Unauthorized received. Refreshing Firebase ID Token and retrying once...");
          const freshToken = await user.getIdToken(true);
          if (freshToken) {
            headers.set("Authorization", `Bearer ${freshToken}`);
            return await fetch(targetUrl, {
              ...options,
              headers
            });
          }
        } catch (retryErr) {
          console.warn("[authenticatedFetch] Single retry with fresh token failed:", retryErr);
        }
      }

      return response;
    } catch (netErr: any) {
      // Retry once on transient network error (e.g. initial server boot/reconnect)
      if (retryCount < 1) {
        console.warn(`[authenticatedFetch] Transient network warning for ${targetUrl}, retrying once in 300ms...`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        return executeFetch(retryCount + 1);
      }

      console.warn(`[authenticatedFetch] Network error for ${targetUrl}:`, netErr?.message || netErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: netErr?.message || "فشل الاتصال بخادم الحسابات (Failed to fetch). يرجى التحقق من الاتصال بالإنترنت."
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  };

  return executeFetch(0);
}

/**
 * Returns an object containing the Authorization Bearer header if a user is logged in.
 */
export async function getAuthHeader(forceRefresh = false): Promise<Record<string, string>> {
  const token = await getFreshAuthToken(forceRefresh);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
