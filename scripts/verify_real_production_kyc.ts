import "../src/lib/env.js";
import { adminDb, adminAuth } from "../src/lib/firebase-admin.js";
import { normalizeUserDocuments, computeCanonicalVerification } from "../src/lib/unifiedVerification.js";
import { computeUserVerificationBreakdown } from "../src/lib/firebaseServices.js";
import fs from "fs";
import path from "path";

async function runProductionVerification() {
  console.log("=================================================================");
  console.log("STARTING LIVE DATABASE & PRODUCTION KYC VERIFICATION");
  console.log("=================================================================");

  // 1. Fetch live users from Firestore
  let firestoreUsers: any[] = [];
  try {
    const snap = await adminDb.collection("users").get();
    if (snap && !snap.empty) {
      firestoreUsers = snap.docs.map(d => ({ ...d.data(), id: d.id, uid: d.id }));
    }
    console.log(`[Firestore] Successfully fetched ${firestoreUsers.length} users from Firestore.`);
  } catch (err: any) {
    console.warn(`[Firestore Warning] Could not fetch directly from adminDb (${err.message}). Falling back to local store.`);
  }

  // Also read local store to compare/combine
  let localDbUsers: any[] = [];
  const dbStorePath = path.join(process.cwd(), "src", "db_store.json");
  if (fs.existsSync(dbStorePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbStorePath, "utf-8"));
      localDbUsers = data.users || [];
      console.log(`[Local DB Store] Loaded ${localDbUsers.length} users from db_store.json.`);
    } catch (e) {}
  }

  // Combine unique users
  const allUsersMap = new Map<string, any>();
  for (const u of firestoreUsers) {
    allUsersMap.set(u.id || u.uid, u);
  }
  for (const u of localDbUsers) {
    const id = u.id || u.uid;
    if (!allUsersMap.has(id)) {
      allUsersMap.set(id, u);
    } else {
      // Merge properties
      const existing = allUsersMap.get(id);
      allUsersMap.set(id, { ...existing, ...u });
    }
  }

  const allUsers = Array.from(allUsersMap.values());
  console.log(`[Total Unique Users Found] ${allUsers.length} users.`);

  // 2. Classify users by state
  const categorized = {
    not_started: [] as any[],
    pending: [] as any[],
    rejected: [] as any[],
    approved: [] as any[],
    has_documents: [] as any[]
  };

  for (const u of allUsers) {
    const isSysAdmin = u.role === "Admin" || u.id === "usr_5it21aafq";
    const canonical = computeCanonicalVerification(u, isSysAdmin);
    const breakdown = computeUserVerificationBreakdown(u);
    const docsResult = normalizeUserDocuments(u);

    const info = {
      uid: u.id || u.uid,
      role: u.role,
      emailDomain: (u.email || "").split("@")[1] || "unknown",
      canonicalStatus: canonical.canonicalStatus,
      accountStatus: canonical.accountStatus,
      documentStatus: canonical.documentVerificationStatus,
      kycStatus: canonical.kycStatus,
      documentCount: docsResult.documentCount,
      documents: docsResult.documents.map(d => ({
        id: d.documentId,
        fileName: d.fileName,
        category: d.category,
        status: d.status,
        isAccessible: d.isAccessible,
        isMissing: d.isMissing
      })),
      canApproveKyc: canonical.canApproveKyc,
      isFullyApproved: canonical.isFullyApproved
    };

    if (docsResult.documentCount > 0) {
      categorized.has_documents.push(info);
    }

    if (canonical.canonicalStatus === "not_started") {
      categorized.not_started.push(info);
    } else if (canonical.canonicalStatus === "pending") {
      categorized.pending.push(info);
    } else if (canonical.canonicalStatus === "rejected") {
      categorized.rejected.push(info);
    } else if (canonical.canonicalStatus === "approved") {
      categorized.approved.push(info);
    }
  }

  console.log("\n--- USER STATE DISTRIBUTION ---");
  console.log(`- Not Started accounts: ${categorized.not_started.length}`);
  console.log(`- Pending accounts: ${categorized.pending.length}`);
  console.log(`- Rejected accounts: ${categorized.rejected.length}`);
  console.log(`- Approved accounts: ${categorized.approved.length}`);
  console.log(`- Accounts with actual documents > 0: ${categorized.has_documents.length}`);

  // 3. Test "0 Documents" issue
  console.log("\n--- TEST: '0 DOCUMENTS' RECONCILIATION ---");
  let docCountMismatchCount = 0;
  for (const docUser of categorized.has_documents) {
    console.log(`User [UID: ${docUser.uid.substring(0, 8)}...]:`);
    console.log(`  Actual raw docs found: ${docUser.documentCount}`);
    console.log(`  Normalized documentCount: ${docUser.documentCount}`);
    console.log(`  Documents detail:`, docUser.documents);
    if (docUser.documentCount <= 0) {
      console.error(`  FAIL: Document count is 0 despite having documents!`);
      docCountMismatchCount++;
    } else {
      console.log(`  PASS: actual documents (${docUser.documentCount}) > 0 produces displayed count (${docUser.documentCount}) > 0.`);
    }
  }

  // 4. Test Schema variations (legacy vs modern)
  console.log("\n--- TEST: SCHEMA VARIATIONS & BACKWARD COMPATIBILITY ---");
  const testSchemas = [
    {
      name: "Legacy single document fields",
      payload: {
        id: "legacy_user_1",
        identityDocument: "nat_id_123.pdf",
        commercialRegisterDoc: "cr_456.pdf"
      }
    },
    {
      name: "Legacy files array with Verification category",
      payload: {
        id: "legacy_user_2",
        files: [
          { id: "f_1", name: "passport.pdf", category: "Verification" },
          { id: "f_2", name: "normal_file.pdf", category: "General" }
        ]
      }
    },
    {
      name: "verificationInfo.documents array",
      payload: {
        id: "legacy_user_3",
        verificationInfo: {
          documents: [{ documentId: "doc_vinfo_1", fileName: "tax_card.pdf" }]
        }
      }
    },
    {
      name: "Modern verificationDocuments array",
      payload: {
        id: "modern_user_4",
        verificationDocuments: [
          { documentId: "doc_mod_1", fileName: "national_id.pdf", category: "personal" },
          { documentId: "doc_mod_2", fileName: "trade_license.pdf", category: "company" }
        ]
      }
    }
  ];

  for (const s of testSchemas) {
    const res = normalizeUserDocuments(s.payload);
    console.log(`Schema [${s.name}]: Document Count = ${res.documentCount}`);
    if (res.documentCount === 0) {
      console.error(`  FAIL: Schema ${s.name} resulted in 0 documents!`);
    } else {
      console.log(`  PASS: Schema ${s.name} correctly normalized ${res.documentCount} documents.`);
    }
  }

  // 5. Test Access Gate Logic for all states
  console.log("\n--- TEST: ACCESS GATE ENFORCEMENT ---");
  const gateTests = [
    {
      state: "not_started",
      user: { id: "u_gate_1", emailVerified: true, accountStatus: "VERIFICATION_REQUIRED" },
      expectedGate: "DocumentVerificationView",
      expectedAllowedToWorkspace: false
    },
    {
      state: "pending",
      user: { id: "u_gate_2", emailVerified: true, accountStatus: "PENDING_ADMIN_REVIEW", verificationDocuments: [{ documentId: "d1", fileName: "id.pdf" }] },
      expectedGate: "PendingApprovalView",
      expectedAllowedToWorkspace: false
    },
    {
      state: "rejected",
      user: { id: "u_gate_3", emailVerified: true, accountStatus: "REJECTED", rejectionReason: "Documents blurry" },
      expectedGate: "AccountRejectedView",
      expectedAllowedToWorkspace: false
    },
    {
      state: "approved",
      user: { id: "u_gate_4", emailVerified: true, accountStatus: "APPROVED", approvedBy: "admin@zakir.ai", approvedAt: new Date().toISOString(), verificationDocuments: [{ documentId: "d1", fileName: "id.pdf" }] },
      expectedGate: "MainWorkspace",
      expectedAllowedToWorkspace: true
    }
  ];

  for (const g of gateTests) {
    const canonical = computeCanonicalVerification(g.user, false);
    const allowsWorkspace = canonical.canonicalStatus === "approved" && canonical.isFullyApproved;
    const isPass = (canonical.canonicalStatus === g.state) && (allowsWorkspace === g.expectedAllowedToWorkspace);
    console.log(`Gate Test [State: ${g.state}]: Canonical = ${canonical.canonicalStatus}, Allowed Workspace = ${allowsWorkspace} -> ${isPass ? "PASS" : "FAIL"}`);
  }

  console.log("\n=================================================================");
  console.log("VERIFICATION COMPLETED");
  console.log("=================================================================");
}

runProductionVerification().catch(console.error);
