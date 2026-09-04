/**
 * Authoritative Login Error Normalization and Localization Pipeline
 * Provides deterministic error classification, consistent localization,
 * and structured dev logging across client and server auth flows.
 */

export type LoginErrorCode =
  | "LOGIN_INVALID_CREDENTIALS"
  | "LOGIN_USER_NOT_FOUND"
  | "LOGIN_USER_DISABLED"
  | "LOGIN_SELF_DELETED"
  | "LOGIN_TOO_MANY_REQUESTS"
  | "LOGIN_NETWORK_ERROR"
  | "LOGIN_UNAUTHORIZED_DOMAIN"
  | "LOGIN_OPERATION_NOT_ALLOWED"
  | "LOGIN_WEAK_PASSWORD"
  | "LOGIN_SERVER_ERROR"
  | "LOGIN_UNKNOWN";

export class LoginError extends Error {
  public readonly loginCode: LoginErrorCode;
  public readonly originalCode?: string;
  public readonly statusCode?: number;
  public readonly attemptId?: string;
  public readonly email?: string;
  public readonly daysRemaining?: number;
  public readonly restoreUntil?: string;

  constructor(
    loginCode: LoginErrorCode,
    message: string,
    options?: {
      originalCode?: string;
      statusCode?: number;
      attemptId?: string;
      email?: string;
      daysRemaining?: number;
      restoreUntil?: string;
    }
  ) {
    super(message);
    this.name = "LoginError";
    this.loginCode = loginCode;
    this.originalCode = options?.originalCode;
    this.statusCode = options?.statusCode;
    this.attemptId = options?.attemptId;
    this.email = options?.email;
    this.daysRemaining = options?.daysRemaining;
    this.restoreUntil = options?.restoreUntil;
  }
}

/**
 * Anonymizes email for development logs (e.g. "mo***@example.com")
 */
export function maskEmailForLogs(email?: string): string {
  if (!email) return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "invalid_email";
  const [local, domain] = parts;
  const maskedLocal = local.length > 2 ? `${local.substring(0, 2)}***` : `${local}***`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Dev-only structured logger for authentication events
 * NEVER logs passwords, tokens, or credentials.
 */
export function logLoginTrace(
  step:
    | "LOGIN_ATTEMPT_START"
    | "LOGIN_FIREBASE_RESULT"
    | "LOGIN_SERVER_RESULT"
    | "LOGIN_ERROR_NORMALIZED"
    | "LOGIN_UI_ERROR_SET"
    | "LOGIN_ATTEMPT_END",
  data: {
    attemptId: string;
    email?: string;
    firebaseErrorCode?: string;
    serverHttpStatus?: number;
    serverErrorCode?: string;
    normalizedErrorCode?: LoginErrorCode;
    [key: string]: any;
  }
): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH_TRACE] ${step}`, {
      attemptId: data.attemptId,
      email: maskEmailForLogs(data.email),
      firebaseErrorCode: data.firebaseErrorCode || null,
      serverHttpStatus: data.serverHttpStatus || null,
      serverErrorCode: data.serverErrorCode || null,
      normalizedErrorCode: data.normalizedErrorCode || null,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Checks whether an error or string represents a network failure
 */
export function isNetworkException(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message || String(err) || "").toLowerCase();
  const code = (err?.code || "").toLowerCase();

  return (
    code === "auth/network-request-failed" ||
    code === "network_error" ||
    code === "failed_to_fetch" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("net::err_") ||
    msg.includes("the client is offline") ||
    msg.includes("network timeout") ||
    msg.includes("<!doctype") ||
    msg.includes("<html") ||
    msg.includes("unexpected token") ||
    msg.includes("not valid json") ||
    msg.includes("json.parse") ||
    msg.includes("syntaxerror")
  );
}

/**
 * Single source of truth for normalizing errors into stable LoginErrorCode.
 * Priority hierarchy:
 * 1. Firebase error.code
 * 2. API structured error code
 * 3. HTTP status code
 * 4. Network exception
 * 5. Raw string inspection (as absolute last fallback)
 */
export function normalizeLoginError(source: any): LoginErrorCode {
  if (!source) {
    return "LOGIN_INVALID_CREDENTIALS";
  }

  // Already a typed LoginError
  if (source instanceof LoginError || source?.name === "LoginError") {
    return source.loginCode;
  }

  // 1. Firebase error code inspection (Highest Priority)
  const fbCode = String(source?.code || source?.firebaseErrorCode || "").toLowerCase().trim();
  if (fbCode) {
    if (
      fbCode === "auth/invalid-credential" ||
      fbCode === "auth/invalid-login-credentials" ||
      fbCode === "auth/wrong-password"
    ) {
      return "LOGIN_INVALID_CREDENTIALS";
    }
    if (fbCode === "auth/user-not-found") {
      return "LOGIN_USER_NOT_FOUND";
    }
    if (fbCode === "auth/user-disabled") {
      return "LOGIN_USER_DISABLED";
    }
    if (fbCode === "auth/too-many-requests") {
      return "LOGIN_TOO_MANY_REQUESTS";
    }
    if (fbCode === "auth/network-request-failed") {
      return "LOGIN_NETWORK_ERROR";
    }
    if (fbCode === "auth/unauthorized-domain") {
      return "LOGIN_UNAUTHORIZED_DOMAIN";
    }
    if (fbCode === "auth/operation-not-allowed") {
      return "LOGIN_OPERATION_NOT_ALLOWED";
    }
    if (fbCode === "auth/weak-password") {
      return "LOGIN_WEAK_PASSWORD";
    }
  }

  // 2. API structured error code inspection
  const apiCode = String(
    source?.serverErrorCode ||
    source?.errorCode ||
    source?.error ||
    source?.data?.code ||
    source?.data?.error ||
    ""
  ).toUpperCase().trim();

  if (apiCode) {
    if (
      apiCode === "INVALID_CREDENTIALS" ||
      apiCode === "AUTH/INVALID-CREDENTIAL" ||
      apiCode === "AUTH/INVALID-LOGIN-CREDENTIALS" ||
      apiCode === "WRONG_PASSWORD"
    ) {
      return "LOGIN_INVALID_CREDENTIALS";
    }
    if (
      apiCode === "EMAIL_NOT_FOUND" ||
      apiCode === "USER_NOT_FOUND" ||
      apiCode === "AUTH/USER-NOT-FOUND"
    ) {
      return "LOGIN_USER_NOT_FOUND";
    }
    if (
      apiCode === "USER_DISABLED" ||
      apiCode === "ADMIN_DELETED_BLOCKED" ||
      apiCode === "ACCOUNT_DISABLED" ||
      apiCode === "AUTH/USER-DISABLED"
    ) {
      return "LOGIN_USER_DISABLED";
    }
    if (
      apiCode === "TOO_MANY_REQUESTS" ||
      apiCode === "RATE_LIMITED" ||
      apiCode === "AUTH/TOO-MANY-REQUESTS"
    ) {
      return "LOGIN_TOO_MANY_REQUESTS";
    }
    if (apiCode === "NETWORK_ERROR" || apiCode === "AUTH/NETWORK-REQUEST-FAILED") {
      return "LOGIN_NETWORK_ERROR";
    }
    if (apiCode === "UNAUTHORIZED_DOMAIN" || apiCode === "AUTH/UNAUTHORIZED-DOMAIN") {
      return "LOGIN_UNAUTHORIZED_DOMAIN";
    }
    if (apiCode === "INTERNAL_SERVER_ERROR" || apiCode === "SERVER_ERROR") {
      return "LOGIN_SERVER_ERROR";
    }
  }

  // 3. HTTP status code inspection
  const statusCode = Number(source?.statusCode || source?.status || source?.serverHttpStatus || 0);
  if (statusCode === 429) {
    return "LOGIN_TOO_MANY_REQUESTS";
  }
  if (statusCode === 403) {
    return "LOGIN_USER_DISABLED";
  }
  if (statusCode >= 500) {
    return "LOGIN_SERVER_ERROR";
  }

  // 4. Network exception check
  if (isNetworkException(source)) {
    return "LOGIN_NETWORK_ERROR";
  }

  // 5. Raw string inspection (Last Fallback)
  const rawMsg = String(source?.message || source || "").toLowerCase();
  if (
    rawMsg.includes("unauthorized-domain") ||
    rawMsg.includes("domain is not authorized")
  ) {
    return "LOGIN_UNAUTHORIZED_DOMAIN";
  }
  if (
    rawMsg.includes("user-disabled") ||
    rawMsg.includes("admin_deleted_blocked") ||
    rawMsg.includes("حساب معطّل") ||
    rawMsg.includes("تعطيل هذا الحساب")
  ) {
    return "LOGIN_USER_DISABLED";
  }
  if (
    rawMsg.includes("too-many-requests") ||
    rawMsg.includes("too many login") ||
    rawMsg.includes("too many requests") ||
    rawMsg.includes("تم تجاوز عدد المحاولات") ||
    rawMsg.includes("حظر الطلبات مؤقتاً")
  ) {
    return "LOGIN_TOO_MANY_REQUESTS";
  }
  if (
    rawMsg.includes("network-request-failed") ||
    rawMsg.includes("failed to fetch") ||
    rawMsg.includes("networkerror") ||
    rawMsg.includes("انقطاع مؤقت")
  ) {
    return "LOGIN_NETWORK_ERROR";
  }
  if (
    rawMsg.includes("user-not-found") ||
    rawMsg.includes("email_not_found") ||
    rawMsg.includes("لم يتم العثور على حساب")
  ) {
    return "LOGIN_USER_NOT_FOUND";
  }
  if (
    rawMsg.includes("invalid-credential") ||
    rawMsg.includes("invalid-login-credentials") ||
    rawMsg.includes("wrong-password") ||
    rawMsg.includes("بيانات الدخول غير صحيحة") ||
    rawMsg.includes("identifiants invalides")
  ) {
    return "LOGIN_INVALID_CREDENTIALS";
  }

  // For 401 status without specific code, standard is invalid credentials
  if (statusCode === 401) {
    return "LOGIN_INVALID_CREDENTIALS";
  }

  return "LOGIN_INVALID_CREDENTIALS";
}

/**
 * Localized messages for each normalized LoginErrorCode.
 * Clean, consistent, and identical across all attempts.
 */
export function formatLoginErrorMessage(code: LoginErrorCode, lang: string = "ar"): string {
  switch (code) {
    case "LOGIN_INVALID_CREDENTIALS":
      return lang === "ar"
        ? "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور."
        : lang === "fr"
        ? "Identifiants invalides. Veuillez vérifier votre e-mail et votre mot de passe."
        : "Invalid login credentials. Please check your email and password.";

    case "LOGIN_USER_NOT_FOUND":
      return lang === "ar"
        ? "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني."
        : lang === "fr"
        ? "Aucun compte trouvé avec cette adresse e-mail."
        : "No registered account found for this email.";

    case "LOGIN_USER_DISABLED":
      return lang === "ar"
        ? "هذا الحساب معطّل حالياً. يرجى تقديم طلب استعادة الحساب أو التواصل مع الإدارة."
        : lang === "fr"
        ? "Ce compte est actuellement désactivé. Veuillez soumettre une demande de réactivation."
        : "This account is currently disabled. Please submit an account recovery request.";

    case "LOGIN_SELF_DELETED":
      return lang === "ar"
        ? "تم العثور على حسابك المحذوف سابقاً، ولا يزال متاحاً للاستعادة."
        : lang === "fr"
        ? "Votre compte précédemment supprimé a été retrouvé et peut être restauré."
        : "Your previously deleted account was found and is available for restoration.";

    case "LOGIN_TOO_MANY_REQUESTS":
      return lang === "ar"
        ? "تم حظر الطلبات مؤقتاً لكثرة المحاولات. يرجى الانتظار دقيقة والمحاولة لاحقاً."
        : lang === "fr"
        ? "Trop de tentatives infructueuses. Veuillez patienter une minute et réessayer."
        : "Too many failed attempts. Please wait a minute and try again.";

    case "LOGIN_NETWORK_ERROR":
      return lang === "ar"
        ? "تعذر إتمام العملية بسبب انقطاع مؤقت في الاتصال. يرجى التحقق من اتصال الإنترنت والمحاولة مجدداً."
        : lang === "fr"
        ? "Impossible de se connecter en raison d'une interruption réseau temporaire. Veuillez vérifier votre connexion."
        : "Unable to sign in due to a temporary connection issue. Please check your internet connection and try again.";

    case "LOGIN_UNAUTHORIZED_DOMAIN":
      return lang === "ar"
        ? "النطاق الحالي غير مصرح له بتسجيل الدخول في إعدادات Firebase."
        : lang === "fr"
        ? "Ce domaine n'est pas autorisé dans les paramètres d'authentification."
        : "This domain is not authorized for authentication in Firebase.";

    case "LOGIN_OPERATION_NOT_ALLOWED":
      return lang === "ar"
        ? "طريقة تسجيل الدخول غير مفعّلة في النظام."
        : lang === "fr"
        ? "Cette méthode de connexion n'est pas activée."
        : "This sign-in provider is not enabled.";

    case "LOGIN_WEAK_PASSWORD":
      return lang === "ar"
        ? "كلمة المرور ضعيفة جداً (يجب أن لا تقل عن 6 أحرف)."
        : lang === "fr"
        ? "Le mot de passe est trop faible (6 caractères minimum)."
        : "The password is too weak (minimum 6 characters).";

    case "LOGIN_SERVER_ERROR":
      return lang === "ar"
        ? "تعذر إتمام الطلب من الخادم حالياً. يرجى المحاولة بعد قليل."
        : lang === "fr"
        ? "Le serveur n'a pas pu traiter votre demande. Veuillez réessayer dans un instant."
        : "Server error processing your request. Please try again shortly.";

    case "LOGIN_UNKNOWN":
    default:
      return lang === "ar"
        ? "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور."
        : lang === "fr"
        ? "Identifiants invalides. Veuillez vérifier votre e-mail et votre mot de passe."
        : "Invalid login credentials. Please check your email and password.";
  }
}
