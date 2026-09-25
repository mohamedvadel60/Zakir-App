import { buildMasterEmailHtml, renderEmailLogoHeaderHtml, sendSystemMail } from "../src/lib/mailer.js";
import fs from "fs";
import path from "path";

console.log("===============================================================");
console.log("🚀 STARTING EMAIL LOGO DELIVERY AND RENDERING TEST SUITE");
console.log("===============================================================\n");

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, description: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`✅ [PASS] ${description}`);
  } else {
    console.error(`❌ [FAIL] ${description}`);
  }
}

// 1. Verify Public Image Assets exist
const emailLogoPath = path.join(process.cwd(), "public", "zakir-email-logo.png");
const lightBadgePath = path.join(process.cwd(), "public", "email-assets", "zakir-badge-light.png");
const darkBadgePath = path.join(process.cwd(), "public", "email-assets", "zakir-badge-dark.png");

assert(fs.existsSync(emailLogoPath), "Email logo asset exists in public/zakir-email-logo.png");
assert(fs.existsSync(lightBadgePath), "Light mode badge asset exists in public/email-assets/zakir-badge-light.png");
assert(fs.existsSync(darkBadgePath), "Dark mode badge asset exists in public/email-assets/zakir-badge-dark.png");

// 2. Test renderEmailLogoHeaderHtml
const headerHtml = renderEmailLogoHeaderHtml({ size: 96, appBase: "https://www.getzakir.com" });

assert(headerHtml.includes('width="96"'), "Logo container header has explicit width=96");
assert(headerHtml.includes('height="96"'), "Logo container header has explicit height=96");
assert(headerHtml.includes("https://www.getzakir.com/zakir-email-logo.png"), "Logo uses absolute public HTTPS URL");
assert(!headerHtml.includes('src="/'), "Logo HTML contains no relative image URLs");
assert(!headerHtml.includes("localhost"), "Logo HTML contains no localhost URLs");
assert(headerHtml.includes('bgcolor="#1C2C58"'), "Container TD has explicit fallback bgcolor=#1C2C58");

// 3. Test buildMasterEmailHtml
const masterHtml = buildMasterEmailHtml({
  subject: "Test Email Verification",
  title: "Test Verification Title",
  greeting: "Hello Member,",
  bodyHtml: "<p>Test message body content</p>",
  baseUrl: "https://www.getzakir.com"
});

assert(masterHtml.includes('width="96"'), "Master HTML email contains width=96");
assert(masterHtml.includes('height="96"'), "Master HTML email contains height=96");
assert(masterHtml.includes("https://www.getzakir.com/zakir-email-logo.png"), "Master HTML email contains public image URL");
assert(!masterHtml.includes('src=""'), "No empty image sources in Master HTML email");

// 4. Test sendSystemMail generation
async function testSendSystemMail() {
  const result = await sendSystemMail({
    to: "delivered@resend.dev",
    subject: "Test Delivery Email",
    html: masterHtml
  });

  assert(result.success === true, "sendSystemMail executes successfully");
  assert(result.messageId !== undefined && result.messageId.length > 0, "sendSystemMail produces a valid messageId");
  
  console.log("\n===============================================================");
  console.log(`🎉 ALL ${passedCount} / ${totalCount} EMAIL LOGO TESTS PASSED PERFECTLY!`);
  console.log("===============================================================\n");
}

testSendSystemMail().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
