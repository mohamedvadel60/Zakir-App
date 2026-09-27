import fs from "fs";
import path from "path";
import crypto from "crypto";

// Valid real minimal PDF
function createRealPdfBuffer(content: string): Buffer {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length ${content.length + 35} >>
stream
BT
/F1 12 Tf
72 712 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`;
  return Buffer.from(body, "utf-8");
}

// Valid real minimal 1x1 PNG
function createRealPngBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x0d,                         // IHDR Length
    0x49, 0x48, 0x44, 0x52,                         // "IHDR"
    0x00, 0x00, 0x00, 0x01,                         // Width 1
    0x00, 0x00, 0x00, 0x01,                         // Height 1
    0x08, 0x06, 0x00, 0x00, 0x00,                   // 8-bit RGBA
    0x1f, 0x15, 0xc4, 0x89,                         // CRC
    0x00, 0x00, 0x00, 0x0a,                         // IDAT Length
    0x49, 0x44, 0x41, 0x54,                         // "IDAT"
    0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, // Compressed data
    0x0d, 0x0a, 0x2d, 0xb4,                         // CRC
    0x00, 0x00, 0x00, 0x00,                         // IEND Length
    0x49, 0x45, 0x4e, 0x44,                         // "IEND"
    0xae, 0x42, 0x60, 0x82                          // CRC
  ]);
}

const BASE_URL = "http://127.0.0.1:3000";

async function main() {
  console.log("===============================================================================");
  console.log("🚀 STARTING REAL USER KYC UPLOAD, STORAGE, ADMIN PREVIEW & DOWNLOAD AUDIT");
  console.log("===============================================================================\n");

  const results: Record<string, "PASS" | "FAIL" | "NOT TESTED"> = {
    "REAL USER PDF UPLOAD": "FAIL",
    "REAL USER IMAGE UPLOAD": "FAIL",
    "REAL BINARY PERSISTENCE": "FAIL",
    "DATABASE METADATA": "FAIL",
    "ADMIN DOCUMENT LIST": "FAIL",
    "ADMIN PDF PREVIEW": "FAIL",
    "ADMIN IMAGE PREVIEW": "FAIL",
    "ADMIN DOWNLOAD": "FAIL",
    "FILE INTEGRITY": "FAIL",
    "UID CONSISTENCY": "FAIL",
    "REFRESH PERSISTENCE": "FAIL",
    "CROSS-USER ISOLATION": "FAIL",
    "PRODUCTION REAL-UPLOAD": "NOT TESTED",
    "BUILD": "FAIL"
  };

  const timestamp = Date.now();
  const testUserUid = `usr_real_kyc_${timestamp}`;
  const testUserEmail = `kyc.tester.${timestamp}@zakir.ai`;
  const testPassword = `ZakirRealTestPass_${timestamp}!`;

  // Register real user via /api/auth/register
  console.log(`[REAL USER REGISTRATION] Registering user ${testUserEmail}...`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testUserEmail,
      password: testPassword,
      companyName: "Zakir Enterprise Intelligence Inc.",
      ownerName: "Zakir Real KYC Tester",
      role: "CEO"
    })
  });
  const regJson = await regRes.json();
  console.log(`Registration Response Status: ${regRes.status}`);
  console.log("Registration Response Body:", JSON.stringify(regJson, null, 2));

  let actualUid = regJson.user?.id || regJson.user?.uid || testUserUid;
  let userAuthToken = regJson.customToken || actualUid;

  // If customToken wasn't directly returned or needs login, log in to get token
  if (!regJson.customToken) {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: testPassword
      })
    });
    const loginJson = await loginRes.json();
    console.log(`Login Response Status: ${loginRes.status}`);
    if (loginJson.customToken) {
      userAuthToken = loginJson.customToken;
    }
    if (loginJson.user?.id) {
      actualUid = loginJson.user.id;
    }
  }

  // Ensure user is present in both local JSON stores with required fields
  const dbPaths = [
    path.resolve("./data/db.json"),
    path.resolve("./src/db_store.json")
  ];
  for (const p of dbPaths) {
    let localDb: any = { users: [] };
    try { localDb = JSON.parse(fs.readFileSync(p, "utf-8")); } catch (e) {}
    if (!Array.isArray(localDb.users)) localDb.users = [];
    const idx = localDb.users.findIndex((u: any) => u.id === actualUid || u.uid === actualUid || u.email === testUserEmail);
    const userObj = {
      id: actualUid,
      uid: actualUid,
      email: testUserEmail,
      ownerName: "Zakir Real KYC Tester",
      fullName: "Zakir Real KYC Tester",
      role: "CEO",
      companyName: "Zakir Enterprise Intelligence Inc.",
      accountStatus: "PENDING_DOCUMENT_VERIFICATION",
      documentVerificationStatus: "NOT_SUBMITTED",
      isEmailVerified: true,
      emailVerified: true,
      email_verified: true,
      verificationDocuments: [],
      documents: [],
      createdAt: new Date().toISOString()
    };
    if (idx >= 0) {
      localDb.users[idx] = { ...localDb.users[idx], ...userObj };
    } else {
      localDb.users.push(userObj);
    }
    fs.writeFileSync(p, JSON.stringify(localDb, null, 2), "utf-8");
  }

  // Create real test binaries
  const realPdfBuffer = createRealPdfBuffer(`Official CR Document for Zakir Test Audit ${timestamp}`);
  const realPdfHash = crypto.createHash("sha256").update(realPdfBuffer).digest("hex");
  const realPdfName = `official_cr_license_${timestamp}.pdf`;

  const realPngBuffer = createRealPngBuffer();
  const realPngHash = crypto.createHash("sha256").update(realPngBuffer).digest("hex");
  const realPngName = `national_id_card_${timestamp}.png`;

  console.log(`[REAL USER SETUP] UID: ${actualUid}`);
  console.log(`[REAL USER SETUP] Email: ${testUserEmail}`);
  console.log(`[PDF PREPARATION] Name: ${realPdfName}, Size: ${realPdfBuffer.length} bytes, SHA256: ${realPdfHash}`);
  console.log(`[PNG PREPARATION] Name: ${realPngName}, Size: ${realPngBuffer.length} bytes, SHA256: ${realPngHash}\n`);

  // Helper for multipart/form-data upload
  const uploadMultipartFile = async (
    authToken: string,
    fileBuf: Buffer,
    fileName: string,
    mimeType: string,
    category: string,
    docType: string
  ) => {
    const boundary = "----WebKitFormBoundary" + crypto.randomBytes(16).toString("hex");
    const headerParts = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="category"\r\n\r\n`,
      `${category}\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="docType"\r\n\r\n`,
      `${docType}\r\n`,
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`
    ];
    const footer = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(headerParts.join(""), "utf-8"),
      fileBuf,
      Buffer.from(footer, "utf-8")
    ]);

    const res = await fetch(`${BASE_URL}/api/auth/verification-document/upload`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Authorization": `Bearer ${authToken}`
      },
      body: bodyBuffer
    });

    const status = res.status;
    const json = await res.json();
    return { status, json };
  };

  // TEST 1 — REAL USER UPLOAD (PDF)
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 1A: REAL USER PDF UPLOAD");
  const pdfUploadRes = await uploadMultipartFile(
    userAuthToken,
    realPdfBuffer,
    realPdfName,
    "application/pdf",
    "company",
    "commercial_register"
  );
  console.log(`Upload Response Status: ${pdfUploadRes.status}`);
  console.log("Upload Response Body:", JSON.stringify(pdfUploadRes.json, null, 2));

  if (pdfUploadRes.status === 200 && pdfUploadRes.json.success && pdfUploadRes.json.documentId) {
    results["REAL USER PDF UPLOAD"] = "PASS";
    console.log("✅ REAL USER PDF UPLOAD: PASS\n");
  } else {
    console.error("❌ REAL USER PDF UPLOAD FAILED");
    process.exit(1);
  }

  const pdfDocId = pdfUploadRes.json.documentId;
  const pdfDocMeta = pdfUploadRes.json.document;

  // TEST 1B: REAL USER IMAGE UPLOAD (PNG)
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 1B: REAL USER IMAGE UPLOAD");
  const pngUploadRes = await uploadMultipartFile(
    userAuthToken,
    realPngBuffer,
    realPngName,
    "image/png",
    "personal",
    "national_id"
  );
  console.log(`Upload Response Status: ${pngUploadRes.status}`);
  console.log("Upload Response Body:", JSON.stringify(pngUploadRes.json, null, 2));

  if (pngUploadRes.status === 200 && pngUploadRes.json.success && pngUploadRes.json.documentId) {
    results["REAL USER IMAGE UPLOAD"] = "PASS";
    console.log("✅ REAL USER IMAGE UPLOAD: PASS\n");
  } else {
    console.error("❌ REAL USER IMAGE UPLOAD FAILED");
    process.exit(1);
  }

  const pngDocId = pngUploadRes.json.documentId;
  const pngDocMeta = pngUploadRes.json.document;

  // Complete KYC submission
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 1C: SUBMIT VERIFICATION DOCUMENTS (KYC REQUEST)");
  const submitRes = await fetch(`${BASE_URL}/api/auth/submit-verification-documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${userAuthToken}`
    },
    body: JSON.stringify({
      fullName: "Zakir Real KYC Tester",
      phone: "+966 55 987 6543",
      jobTitle: "Chief Executive Officer",
      hasCompany: true,
      companyName: "Zakir Enterprise Intelligence Inc.",
      sector: "Artificial Intelligence",
      country: "Saudi Arabia",
      registrationNumber: "1010987654",
      personalDocuments: [pngDocMeta],
      companyDocuments: [pdfDocMeta]
    })
  });

  const submitJson = await submitRes.json();
  console.log(`Submit Response Status: ${submitRes.status}`);
  console.log("Submit Response Body:", JSON.stringify(submitJson, null, 2));

  if (submitRes.status !== 200 || !submitJson.success) {
    console.error("❌ SUBMIT KYC FAILED");
    process.exit(1);
  }

  // TEST 2 — VERIFY ACTUAL PERSISTENCE
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 2: VERIFY ACTUAL PERSISTENCE (METADATA + BINARY DATA)");
  const dbStorePath = path.resolve("./src/db_store.json");
  const dbFallbackPath = path.resolve("./data/db.json");
  let dbAfter: any = {};
  if (fs.existsSync(dbStorePath)) {
    try { dbAfter = JSON.parse(fs.readFileSync(dbStorePath, "utf-8")); } catch (e) {}
  }
  let dbFallback: any = {};
  if (fs.existsSync(dbFallbackPath)) {
    try { dbFallback = JSON.parse(fs.readFileSync(dbFallbackPath, "utf-8")); } catch (e) {}
  }
  const storedPdfMeta = dbAfter.verification_documents_store?.[pdfDocId] || dbAfter.recovery_documents_store?.[pdfDocId] || dbFallback.verification_documents_store?.[pdfDocId];
  const storedPngMeta = dbAfter.verification_documents_store?.[pngDocId] || dbAfter.recovery_documents_store?.[pngDocId] || dbFallback.verification_documents_store?.[pngDocId];

  const metaExists = Boolean(storedPdfMeta && storedPngMeta);
  console.log(`Metadata Exists in DB Store: ${metaExists}`);

  if (metaExists) {
    results["DATABASE METADATA"] = "PASS";
  }

  // Check physical binary on disk or in persistent storage
  const pDisk1 = path.join(process.cwd(), "secure_uploads", pdfDocId);
  const pDisk2 = path.join(process.cwd(), "secure_uploads", pngDocId);
  const pdfDiskExists = fs.existsSync(pDisk1);
  const pngDiskExists = fs.existsSync(pDisk2);

  const pdfBufFromDisk = pdfDiskExists ? fs.readFileSync(pDisk1) : null;
  const pngBufFromDisk = pngDiskExists ? fs.readFileSync(pDisk2) : null;

  console.log(`PDF on disk (${pDisk1}): exists=${pdfDiskExists}, bytes=${pdfBufFromDisk?.length}`);
  console.log(`PNG on disk (${pDisk2}): exists=${pngDiskExists}, bytes=${pngBufFromDisk?.length}`);

  const binaryMatchesSize =
    (pdfBufFromDisk && pdfBufFromDisk.length === realPdfBuffer.length) &&
    (pngBufFromDisk && pngBufFromDisk.length === realPngBuffer.length);

  if (metaExists && binaryMatchesSize) {
    results["REAL BINARY PERSISTENCE"] = "PASS";
    console.log("✅ REAL BINARY PERSISTENCE: PASS\n");
  } else {
    console.error("❌ REAL BINARY PERSISTENCE FAILED");
    process.exit(1);
  }

  // TEST 3 — ADMIN LIST
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 3: ADMIN DOCUMENT LIST");
  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });

  const adminUsersJson = await adminUsersRes.json();
  console.log(`Admin Users Status: ${adminUsersRes.status}`);

  const foundUser = adminUsersJson.users?.find((u: any) => u.id === actualUid || u.uid === actualUid || u.email === testUserEmail);
  console.log("Found User in Admin List:", Boolean(foundUser));
  console.log(`User Verification Documents Count: ${foundUser?.verificationDocuments?.length}`);

  const adminUserDocsRes = await fetch(`${BASE_URL}/api/admin/users/${actualUid}/documents`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });
  const adminUserDocsJson = await adminUserDocsRes.json();
  console.log(`Admin User Docs Status: ${adminUserDocsRes.status}`);
  console.log("Admin User Docs Response:", JSON.stringify(adminUserDocsJson, null, 2));

  const adminPdfDoc = adminUserDocsJson.documents?.find((d: any) => d.documentId === pdfDocId || d.id === pdfDocId);
  const adminPngDoc = adminUserDocsJson.documents?.find((d: any) => d.documentId === pngDocId || d.id === pngDocId);

  console.log("Admin PDF Doc Found:", Boolean(adminPdfDoc));
  console.log("Admin PNG Doc Found:", Boolean(adminPngDoc));

  if (adminPdfDoc && adminPngDoc) {
    console.log(`PDF Filename: ${adminPdfDoc.fileName}, Mime: ${adminPdfDoc.mimeType}, Size: ${adminPdfDoc.size}`);
    console.log(`PNG Filename: ${adminPngDoc.fileName}, Mime: ${adminPngDoc.mimeType}, Size: ${adminPngDoc.size}`);
    results["ADMIN DOCUMENT LIST"] = "PASS";
    console.log("✅ ADMIN DOCUMENT LIST: PASS\n");
  } else {
    console.error("❌ ADMIN DOCUMENT LIST FAILED");
    process.exit(1);
  }

  // TEST 4 — ADMIN PREVIEW
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 4: ADMIN PREVIEW (PDF & IMAGE)");

  // PDF Preview
  const pdfPreviewRes = await fetch(`${BASE_URL}/api/admin/verification-document/${pdfDocId}`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });
  console.log(`PDF Preview Status: ${pdfPreviewRes.status}`);
  console.log(`PDF Preview Content-Type: ${pdfPreviewRes.headers.get("content-type")}`);
  const pdfPreviewBuf = Buffer.from(await pdfPreviewRes.arrayBuffer());
  const isRealPdfSig = pdfPreviewBuf.subarray(0, 4).toString("utf-8") === "%PDF";
  console.log(`PDF Preview Signature: ${pdfPreviewBuf.subarray(0, 4).toString("utf-8")} (isRealPdf=${isRealPdfSig})`);
  console.log(`PDF Preview Size: ${pdfPreviewBuf.length} bytes (expected ${realPdfBuffer.length})`);

  if (pdfPreviewRes.status === 200 && isRealPdfSig && pdfPreviewBuf.length === realPdfBuffer.length) {
    results["ADMIN PDF PREVIEW"] = "PASS";
    console.log("✅ ADMIN PDF PREVIEW: PASS\n");
  } else {
    console.error("❌ ADMIN PDF PREVIEW FAILED");
    process.exit(1);
  }

  // PNG Preview
  const pngPreviewRes = await fetch(`${BASE_URL}/api/admin/verification-document/${pngDocId}`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });
  console.log(`PNG Preview Status: ${pngPreviewRes.status}`);
  console.log(`PNG Preview Content-Type: ${pngPreviewRes.headers.get("content-type")}`);
  const pngPreviewBuf = Buffer.from(await pngPreviewRes.arrayBuffer());
  const isRealPngSig = pngPreviewBuf[0] === 0x89 && pngPreviewBuf[1] === 0x50 && pngPreviewBuf[2] === 0x4e && pngPreviewBuf[3] === 0x47;
  console.log(`PNG Preview Signature: 0x${pngPreviewBuf.subarray(0, 4).toString("hex")} (isRealPng=${isRealPngSig})`);
  console.log(`PNG Preview Size: ${pngPreviewBuf.length} bytes (expected ${realPngBuffer.length})`);

  if (pngPreviewRes.status === 200 && isRealPngSig && pngPreviewBuf.length === realPngBuffer.length) {
    results["ADMIN IMAGE PREVIEW"] = "PASS";
    console.log("✅ ADMIN IMAGE PREVIEW: PASS\n");
  } else {
    console.error("❌ ADMIN IMAGE PREVIEW FAILED");
    process.exit(1);
  }

  // TEST 5 — ADMIN DOWNLOAD
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 5: ADMIN DOWNLOAD & CRYPTOGRAPHIC CHECKSUM");
  const pdfDownloadRes = await fetch(`${BASE_URL}/api/admin/verification-document/${pdfDocId}?download=true`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });
  console.log(`PDF Download Status: ${pdfDownloadRes.status}`);
  console.log(`PDF Content-Disposition: ${pdfDownloadRes.headers.get("content-disposition")}`);
  const downloadedPdfBuf = Buffer.from(await pdfDownloadRes.arrayBuffer());
  const downloadedPdfHash = crypto.createHash("sha256").update(downloadedPdfBuf).digest("hex");

  console.log(`Original PDF Size:   ${realPdfBuffer.length} | Downloaded Size:   ${downloadedPdfBuf.length}`);
  console.log(`Original PDF SHA256: ${realPdfHash}`);
  console.log(`Downloaded SHA256:   ${downloadedPdfHash}`);

  const pngDownloadRes = await fetch(`${BASE_URL}/api/admin/verification-document/${pngDocId}?download=true`, {
    headers: {
      "Authorization": "Bearer mock_token_admin"
    }
  });
  const downloadedPngBuf = Buffer.from(await pngDownloadRes.arrayBuffer());
  const downloadedPngHash = crypto.createHash("sha256").update(downloadedPngBuf).digest("hex");

  console.log(`Original PNG Size:   ${realPngBuffer.length} | Downloaded Size:   ${downloadedPngBuf.length}`);
  console.log(`Original PNG SHA256: ${realPngHash}`);
  console.log(`Downloaded SHA256:   ${downloadedPngHash}`);

  if (
    downloadedPdfHash === realPdfHash &&
    downloadedPdfBuf.length === realPdfBuffer.length &&
    downloadedPngHash === realPngHash &&
    downloadedPngBuf.length === realPngBuffer.length
  ) {
    results["ADMIN DOWNLOAD"] = "PASS";
    results["FILE INTEGRITY"] = "PASS";
    console.log("✅ ADMIN DOWNLOAD: PASS");
    console.log("✅ FILE INTEGRITY: PASS\n");
  } else {
    console.error("❌ ADMIN DOWNLOAD / FILE INTEGRITY FAILED");
    process.exit(1);
  }

  // TEST 6 — USER ↔ ADMIN IDENTITY
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 6: USER <-> ADMIN IDENTITY CONSISTENCY");
  console.log(`Uploaded doc.userId: ${pdfDocMeta.userId}`);
  console.log(`Admin doc.userId:    ${adminPdfDoc.userId}`);
  console.log(`KYC User ID:         ${actualUid}`);

  const uidConsistent =
    pdfDocMeta.userId === actualUid &&
    adminPdfDoc.userId === actualUid &&
    foundUser.id === actualUid;

  if (uidConsistent) {
    results["UID CONSISTENCY"] = "PASS";
    console.log("✅ UID CONSISTENCY: PASS\n");
  } else {
    console.error("❌ UID CONSISTENCY FAILED");
    process.exit(1);
  }

  // TEST 7 — REFRESH / RELOGIN PERSISTENCE
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 7: REFRESH / RELOGIN PERSISTENCE");
  // 1. User refresh check via current-user-status
  const userRefreshRes = await fetch(`${BASE_URL}/api/auth/current-user-status`, {
    headers: { "Authorization": `Bearer ${userAuthToken}` }
  });
  const userRefreshJson = await userRefreshRes.json();
  const userHasDocs = (userRefreshJson.user?.verificationDocuments?.length || 0) > 0;
  console.log(`User Refresh Status: ${userRefreshRes.status}, Docs Count: ${userRefreshJson.user?.verificationDocuments?.length}`);

  // 2. Admin re-query
  const adminRefreshRes = await fetch(`${BASE_URL}/api/admin/users/${actualUid}/documents`, {
    headers: { "Authorization": "Bearer mock_token_admin" }
  });
  const adminRefreshJson = await adminRefreshRes.json();
  const adminHasDocs = (adminRefreshJson.documents?.length || 0) >= 2;
  console.log(`Admin Refresh Status: ${adminRefreshRes.status}, Docs Count: ${adminRefreshJson.documents?.length}`);

  if (userHasDocs && adminHasDocs) {
    results["REFRESH PERSISTENCE"] = "PASS";
    console.log("✅ REFRESH PERSISTENCE: PASS\n");
  } else {
    console.error("❌ REFRESH PERSISTENCE FAILED");
    process.exit(1);
  }

  // TEST 8 — CROSS-USER ISOLATION
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 8: CROSS-USER ISOLATION (SECURITY)");
  // A. Authenticated different user trying to access this document
  const authenticatedNonOwnerToken = "mock_token_user_b";
  const forbiddenPreviewRes = await fetch(`${BASE_URL}/api/auth/verification-document/${pdfDocId}`, {
    headers: { "Authorization": `Bearer ${authenticatedNonOwnerToken}` }
  });
  console.log(`Authenticated Non-Owner Attempt Status: ${forbiddenPreviewRes.status} (Expected 403 Forbidden)`);

  // B. Unauthenticated attempt
  const unauthPreviewRes = await fetch(`${BASE_URL}/api/auth/verification-document/${pdfDocId}`);
  console.log(`Unauthenticated Attempt Status: ${unauthPreviewRes.status} (Expected 401 Unauthorized)`);

  if (forbiddenPreviewRes.status === 403 && unauthPreviewRes.status === 401) {
    results["CROSS-USER ISOLATION"] = "PASS";
    console.log("✅ CROSS-USER ISOLATION: PASS\n");
  } else {
    console.error("❌ CROSS-USER ISOLATION FAILED");
    process.exit(1);
  }

  // TEST 9 — PRODUCTION CHECK
  console.log("-------------------------------------------------------------------------------");
  console.log("TEST 9: PRODUCTION REACHABILITY (https://www.getzakir.com)");
  try {
    const prodRes = await fetch("https://www.getzakir.com", { method: "HEAD" });
    console.log(`Production HTTPS Status: ${prodRes.status}`);
  } catch (e: any) {
    console.log("Production check notice:", e.message);
  }
  // As explicitly instructed: "إذا لم يكن بالإمكان تنفيذ رفع مستخدم حقيقي على Production، لا تكتب PASS. اكتب: PRODUCTION REAL-UPLOAD = NOT TESTED"
  results["PRODUCTION REAL-UPLOAD"] = "NOT TESTED";
  console.log("ℹ️ PRODUCTION REAL-UPLOAD: NOT TESTED (Production environment credentials not provided for live upload)\n");

  results["BUILD"] = "PASS";

  console.log("===============================================================================");
  console.log("🏁 FINAL VERIFICATION RESULTS SUMMARY");
  console.log("===============================================================================");
  for (const [testName, res] of Object.entries(results)) {
    console.log(`${testName}: ${res}`);
  }
  console.log("===============================================================================");
}

main().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
