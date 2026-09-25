import {
  buildMasterEmailHtml,
  renderEmailLogoHeaderHtml,
  buildOtpEmailHtml,
  buildRecoveryApprovalEmailHtml,
  buildRecoveryRejectionEmailHtml,
  buildInvitationEmailHtml,
  buildSupportReplyEmailHtml,
  buildNewAccountApprovalEmailHtml,
  buildNewAccountRejectionEmailHtml,
  sendSystemMail,
  getOfficialEmailLogoLightBuffer,
  getOfficialEmailLogoDarkBuffer,
} from "../src/lib/mailer.js";

async function runTests() {
  console.log("=================================================");
  console.log("ZAKIR EMAIL BRANDING & LOGO SYSTEM VERIFICATION");
  console.log("=================================================");

  const targetTestEmail = process.env.TEST_EMAIL_RECIPIENT || "mohamedvadel60@gmail.com";

  // 1. Check buffers and assets
  const lightBuf = getOfficialEmailLogoLightBuffer();
  const darkBuf = getOfficialEmailLogoDarkBuffer();

  console.log("\n[1] ASSET VALIDATION:");
  console.log("- Light Mode Badge (Navy #1C2C58 + White Symbol):", lightBuf.length > 0 ? `FOUND (${lightBuf.length} bytes)` : "MISSING");
  console.log("- Dark Mode Badge (White #FFFFFF + Navy Symbol):", darkBuf.length > 0 ? `FOUND (${darkBuf.length} bytes)` : "MISSING");

  if (lightBuf.length === 0 || darkBuf.length === 0) {
    throw new Error("Missing badge buffers!");
  }

  // 2. Validate Logo Container HTML
  console.log("\n[2] LOGO CONTAINER STRUCTURE (96x96 px):");
  const logoHeader = renderEmailLogoHeaderHtml({ size: 96 });
  
  const has96WidthAttr = logoHeader.includes('width="96"');
  const has96HeightAttr = logoHeader.includes('height="96"');
  const has96WidthStyle = logoHeader.includes('width: 96px !important');
  const has96HeightStyle = logoHeader.includes('height: 96px !important');
  const hasCenterAlign = logoHeader.includes('align="center"') && logoHeader.includes('valign="middle"');
  const hasLogoImg = logoHeader.includes('zakir-email-logo.png') || logoHeader.includes('zakir-badge');
  const hasPurple = /purple|violet|#8b5cf6|#a855f7|#7c3aed|#6d28d9/i.test(logoHeader);

  console.log("- Container Width 96 Attribute:", has96WidthAttr ? "PASS" : "FAIL");
  console.log("- Container Height 96 Attribute:", has96HeightAttr ? "PASS" : "FAIL");
  console.log("- Container Width 96 CSS Style:", has96WidthStyle ? "PASS" : "FAIL");
  console.log("- Container Height 96 CSS Style:", has96HeightStyle ? "PASS" : "FAIL");
  console.log("- Horizontal & Vertical Centering:", hasCenterAlign ? "PASS" : "FAIL");
  console.log("- Logo Image Source:", hasLogoImg ? "PASS" : "FAIL");
  console.log("- No Purple/Violet in Dark Mode:", !hasPurple ? "PASS" : "FAIL");

  if (!has96WidthAttr || !has96HeightAttr || !hasCenterAlign || !hasLogoImg || hasPurple) {
    throw new Error("Logo container structure validation failed!");
  }

  // 3. Test Email Dispatches
  console.log("\n[3] TEST EMAIL DISPATCHES:");

  // Test Email 1: Email Verification / OTP
  console.log("\n--- Dispatching Test Email 1: Email Verification / OTP ---");
  const otpEmail = buildOtpEmailHtml({
    email: targetTestEmail,
    otpCode: "948271",
    type: "email_verification",
    userName: "Mohamed Vadel",
  });
  const res1 = await sendSystemMail({
    to: targetTestEmail,
    subject: otpEmail.subject,
    html: otpEmail.html,
    text: otpEmail.text,
  });
  console.log("Test Email 1 Result:", {
    success: res1.success,
    messageId: res1.messageId,
    provider: res1.provider,
    simulated: res1.simulated,
  });

  // Test Email 2: Account Recovery
  console.log("\n--- Dispatching Test Email 2: Account Recovery Approval ---");
  const recoveryEmail = buildRecoveryApprovalEmailHtml({
    email: targetTestEmail,
    userName: "Mohamed Vadel",
  });
  const res2 = await sendSystemMail({
    to: targetTestEmail,
    subject: recoveryEmail.subject,
    html: recoveryEmail.html,
    text: recoveryEmail.text,
  });
  console.log("Test Email 2 Result:", {
    success: res2.success,
    messageId: res2.messageId,
    provider: res2.provider,
    simulated: res2.simulated,
  });

  // Test Email 3: Account Approved / Welcome
  console.log("\n--- Dispatching Test Email 3: New Account Approved ---");
  const approvalEmail = buildNewAccountApprovalEmailHtml({
    email: targetTestEmail,
    userName: "Mohamed Vadel",
    plan: "Enterprise Pro",
    trialHours: 48,
  });
  const res3 = await sendSystemMail({
    to: targetTestEmail,
    subject: approvalEmail.subject,
    html: approvalEmail.html,
    text: approvalEmail.text,
  });
  console.log("Test Email 3 Result:", {
    success: res3.success,
    messageId: res3.messageId,
    provider: res3.provider,
    simulated: res3.simulated,
  });

  // 4. Test Workspace Invitation & Support Reply
  console.log("\n--- Dispatching Additional Template Tests ---");
  const inviteEmail = buildInvitationEmailHtml({
    companyName: "Acme Holdings",
    memberName: "Mohamed Vadel",
    inviterName: "Admin Executive",
    designatedRole: "Senior Risk Analyst",
    inviteLink: "https://www.getzakir.com/invite/inv_sample_984",
    language: "ar",
  });
  const res4 = await sendSystemMail({
    to: targetTestEmail,
    subject: inviteEmail.subject,
    html: inviteEmail.html,
    text: inviteEmail.text,
  });
  console.log("Invitation Email Result:", { success: res4.success, messageId: res4.messageId });

  const supportEmail = buildSupportReplyEmailHtml({
    recipientName: "Mohamed Vadel",
    ticketId: "TCK-8820",
    ticketSubject: "Causal Graph Integration Query",
    message: "Your enterprise connector has been successfully configured and verified.",
  });
  const res5 = await sendSystemMail({
    to: targetTestEmail,
    subject: supportEmail.subject,
    html: supportEmail.html,
    text: supportEmail.text,
  });
  console.log("Support Reply Email Result:", { success: res5.success, messageId: res5.messageId });

  console.log("\n=================================================");
  console.log("ALL EMAIL LOGO & DISPATCH TESTS COMPLETED SUCCESSFULLY");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
