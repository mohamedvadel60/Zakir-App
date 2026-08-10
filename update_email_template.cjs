const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const escapeHtml = `function escapeHtml(value) {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}`;

const buildOtpEmailHtmlNew = `function buildOtpEmailHtml({
  userName,
  otpCode,
  type = "account_registration"
}) {
  const safeName = escapeHtml(userName || "");
  const subject = type === "password_reset" ? "Reset your Zakir password" : "Verify Your Email — Zakir";
  
  const html = \`<div style="font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 32px 16px; color: #0f172a;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
    
    <!-- Logo & Header -->
    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto; padding-top: 32px; width: 100%;">
      <tr>
        <td align="center" valign="middle" style="padding: 10px;">
          <img src="https://www.getzakir.com/assets/logo.png" alt="Zakir Logo" width="80" height="auto" style="display: block; margin: 0 auto; width: 80px; height: auto; border: 0;" />
        </td>
      </tr>
      <tr>
        <td align="center">
          <div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 3px; font-family: 'Inter', sans-serif;">
            ZAKIR
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 6px;">
            VERIFY YOUR EMAIL
          </div>
        </td>
      </tr>
    </table>

    <hr style="border: 0; border-bottom: 1px solid #f1f5f9; margin: 16px 0;" />

    <!-- Main Content -->
    <div style="padding: 32px; text-align: left;">
      <h1 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.4;">
        Hello \${safeName},
      </h1>
      
      <p style="color: #475569; font-size: 15px; margin: 0 0 24px 0; line-height: 1.6;">
        Welcome to Zakir! Please verify your email address by entering the 6-digit code below. This code will expire in 15 minutes.
      </p>

      <!-- OTP Box -->
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
        <span style="display: block; font-family: monospace; font-size: 36px; font-weight: 800; color: #3b82f6; letter-spacing: 8px;">
          \${otpCode}
        </span>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 0; line-height: 1.5;">
        If you didn't create an account, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
      &copy; 2026 Zakir. All rights reserved.<br/>
      Need help? Contact our support team.
    </div>

  </div>
</div>\`;

  return { subject, text: subject, html };
}`;

// I need to find the old buildOtpEmailHtml and replace it.
// It starts at line 796 in server.ts
// I'll use a regex or a simple slice to replace it.
// Given the file size, I will just replace the function body.

code = code.replace(/function buildOtpEmailHtml\(options: BuildOtpEmailOptions\): \{ subject: string; text: string; html: string \} \{[\s\S]*?\}\n\nfunction hashVerificationCode/m, escapeHtml + "\n\n" + buildOtpEmailHtmlNew + "\n\nfunction hashVerificationCode");

fs.writeFileSync('server.ts', code);
