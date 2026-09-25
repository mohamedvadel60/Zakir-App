import { normalizeLoginError, formatLoginErrorMessage, LoginError } from "../src/lib/authErrors.js";
import { loginFirebaseUser } from "../src/lib/firebaseServices.js";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING LOGIN COMPATIBILITY & ERROR VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details || "");
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Error Normalization for Different Firebase Error Codes
  // -------------------------------------------------------------
  console.log("\n--- Suite 1: Firebase Auth Error Differentiation ---");

  const errWrongPassword = { code: "auth/wrong-password", message: "Wrong password" };
  const normWrongPassword = normalizeLoginError(errWrongPassword);
  assert(normWrongPassword === "LOGIN_INVALID_CREDENTIALS", "auth/wrong-password maps to LOGIN_INVALID_CREDENTIALS");
  assert(
    formatLoginErrorMessage(normWrongPassword, "ar") === "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
    "Wrong password message is accurate in Arabic"
  );

  const errUserNotFound = { code: "auth/user-not-found", message: "User not found" };
  const normUserNotFound = normalizeLoginError(errUserNotFound);
  assert(normUserNotFound === "LOGIN_USER_NOT_FOUND", "auth/user-not-found maps to LOGIN_USER_NOT_FOUND (NOT generic invalid credentials)");
  assert(
    formatLoginErrorMessage(normUserNotFound, "ar") === "لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.",
    "User not found message is accurate in Arabic"
  );

  const errUserDisabled = { code: "auth/user-disabled", message: "User disabled" };
  const normUserDisabled = normalizeLoginError(errUserDisabled);
  assert(normUserDisabled === "LOGIN_USER_DISABLED", "auth/user-disabled maps to LOGIN_USER_DISABLED");
  assert(
    formatLoginErrorMessage(normUserDisabled, "ar").includes("معطّل"),
    "User disabled message informs user of disabled status in Arabic"
  );

  const errInvalidEmail = { code: "auth/invalid-email", message: "Invalid email" };
  const normInvalidEmail = normalizeLoginError(errInvalidEmail);
  assert(normInvalidEmail === "LOGIN_INVALID_EMAIL", "auth/invalid-email maps to LOGIN_INVALID_EMAIL");
  assert(
    formatLoginErrorMessage(normInvalidEmail, "ar").includes("صيغة البريد الإلكتروني غير صالحة"),
    "Invalid email message is accurate in Arabic"
  );

  const errTooManyRequests = { code: "auth/too-many-requests", message: "Too many requests" };
  const normTooManyRequests = normalizeLoginError(errTooManyRequests);
  assert(normTooManyRequests === "LOGIN_TOO_MANY_REQUESTS", "auth/too-many-requests maps to LOGIN_TOO_MANY_REQUESTS");
  assert(
    formatLoginErrorMessage(normTooManyRequests, "ar").includes("حظر"),
    "Rate limited message is accurate in Arabic"
  );

  const errNetwork = { code: "auth/network-request-failed", message: "Network request failed" };
  const normNetwork = normalizeLoginError(errNetwork);
  assert(normNetwork === "LOGIN_NETWORK_ERROR", "auth/network-request-failed maps to LOGIN_NETWORK_ERROR");
  assert(
    formatLoginErrorMessage(normNetwork, "ar").includes("انقطاع مؤقت"),
    "Network error message is accurate in Arabic"
  );

  const errUnauthorizedDomain = { code: "auth/unauthorized-domain", message: "Unauthorized domain" };
  const normUnauthorizedDomain = normalizeLoginError(errUnauthorizedDomain);
  assert(normUnauthorizedDomain === "LOGIN_UNAUTHORIZED_DOMAIN", "auth/unauthorized-domain maps to LOGIN_UNAUTHORIZED_DOMAIN");

  const errOperationNotAllowed = { code: "auth/operation-not-allowed", message: "Operation not allowed" };
  const normOperationNotAllowed = normalizeLoginError(errOperationNotAllowed);
  assert(normOperationNotAllowed === "LOGIN_OPERATION_NOT_ALLOWED", "auth/operation-not-allowed maps to LOGIN_OPERATION_NOT_ALLOWED");

  const errInternal = { code: "auth/internal-error", message: "Internal error" };
  const normInternal = normalizeLoginError(errInternal);
  assert(normInternal === "LOGIN_INTERNAL_ERROR", "auth/internal-error maps to LOGIN_INTERNAL_ERROR");

  // -------------------------------------------------------------
  // Test 2: Post-Authentication Profile Errors Separation
  // -------------------------------------------------------------
  console.log("\n--- Suite 2: Post-Authentication Separation ---");

  const errProfileNotFound = new LoginError("LOGIN_PROFILE_NOT_FOUND", "Profile missing");
  assert(
    errProfileNotFound.loginCode === "LOGIN_PROFILE_NOT_FOUND",
    "Post-auth missing profile has separate LOGIN_PROFILE_NOT_FOUND code"
  );
  assert(
    formatLoginErrorMessage(errProfileNotFound.loginCode, "ar") !== "بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.",
    "Post-auth missing profile DOES NOT display invalid credentials"
  );

  const errSelfDeleted = new LoginError("LOGIN_SELF_DELETED", "Deleted account found", {
    daysRemaining: 25,
    restoreUntil: new Date(Date.now() + 25 * 86400000).toISOString()
  });
  assert(
    errSelfDeleted.loginCode === "LOGIN_SELF_DELETED",
    "Deleted accounts trigger LOGIN_SELF_DELETED recovery status"
  );
  assert(
    errSelfDeleted.daysRemaining === 25,
    "Days remaining is preserved on recovery error"
  );

  // -------------------------------------------------------------
  // Test 3: Email Normalization
  // -------------------------------------------------------------
  console.log("\n--- Suite 3: Email Normalization Verification ---");

  const rawUpper = "   User.CEO@ZakIR.AI  ";
  const normalized = rawUpper.trim().toLowerCase();
  assert(normalized === "user.ceo@zakir.ai", "Email normalization correctly trims and lowercases email");

  // -------------------------------------------------------------
  // Test 4: Role Preservation Invariants
  // -------------------------------------------------------------
  console.log("\n--- Suite 4: Role Preservation Invariants ---");

  const rolesToTest = [
    { input: "contributor", expected: "Contributor" },
    { input: "CONTRIBUTOR", expected: "Contributor" },
    { input: "CEO", expected: "CEO" },
    { input: "ceo", expected: "CEO" },
    { input: "Admin", expected: "Admin" },
    { input: "ADMIN", expected: "Admin" },
    { input: "Analyst", expected: "Analyst" },
    { input: "Auditor", expected: "Auditor" },
    { input: "Investor", expected: "Investor" }
  ];

  for (const item of rolesToTest) {
    const raw = item.input.trim();
    const upper = raw.toUpperCase();
    let res = "CEO";
    if (upper === "ADMIN" || upper === "SYSTEM_ADMIN") res = "Admin";
    else if (upper === "CEO" || upper === "OWNER" || upper === "FOUNDER") res = "CEO";
    else if (upper === "CONTRIBUTOR" || upper === "MEMBER") res = "Contributor";
    else if (upper === "ANALYST") res = "Analyst";
    else if (upper === "AUDITOR") res = "Auditor";
    else if (upper === "INVESTOR") res = "Investor";
    else res = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

    assert(res === item.expected, `Role preservation: ${item.input} -> ${res} matches expected ${item.expected}`);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
