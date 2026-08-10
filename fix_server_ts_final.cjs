const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The issue is in buildOtpEmailHtml, lines ~796-820
// Let's replace the whole function using a simpler regex.

const functionRegex = /function buildOtpEmailHtml\(options: BuildOtpEmailOptions\): \{ subject: string; text: string; html: string \} \{[\s\S]*?\}\n\nfunction hashVerificationCode/m;

const newFunction = `function buildOtpEmailHtml(options: BuildOtpEmailOptions): { subject: string; text: string; html: string } {
  const { email, userName, otpCode, type = "account_registration" } = options;
  const cleanName = cleanUserName(userName || "", email);
  
  const isReset = type === "password_reset";

  // Subject (100% English ONLY)
  const subject = isReset ? "Reset your Zakir password" : "Your Zakir Verification Code";

  // Greeting
  const greeting = cleanName ? \`Hello \${cleanName},\` : \`Hello,\`;

  // Dynamic Titles & Introductions
  const actionTitle = isReset ? "Reset Your Password" : "Verify Your Email";
  const introText = isReset
    ? "We received a request to reset the password for your Zakir account. Use the verification code below to set a new password:"
    : "Welcome to Zakir. Use the verification code below to complete your verification and activate your account:";

  // Formatted Code for crisp visual spacing
  const formattedCode = otpCode.length === 6 ? \`\${otpCode.slice(0, 3)} \${otpCode.slice(3)}\` : otpCode;

  // Plain Text Version
  const textBody = \`\${greeting}\n\n\${introText}\n\n[ \${formattedCode} ]\n\nThis code expires in 10 minutes.\n\nFor your security, never share this code with anyone.\nIf you didn't request this code, you can safely ignore this email.\n\nThe Zakir Team\`;

  // Production-grade HTML Email (Gmail, Outlook, Apple Mail, Yahoo, Mobile/Desktop Compatible)
  const html = \`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting" />
  <title>\${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased; word-spacing: normal;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
          
          <!-- Top Gold Accent Line -->
          <tr>
            <td style="background-color: #d4af37; height: 5px; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 12px auto;">
                <tr>
                  <td align="center" valign="middle" style="width: 80px; height: 80px; border-radius: 12px; padding: 10px;">
                    <img src="https://www.getzakir.com/assets/logo.png" alt="Zakir Logo" width="80" height="auto" style="display: block; margin: 0 auto; width: 80px; height: auto; border: 0;" />
                  </td>
                </tr>
              </table>
              <div style="font-size: 26px; font-weight: 900; color: #0f172a; letter-spacing: 3px; font-family: 'Inter', sans-serif;">
                ZAKIR
              </div>
              <div style="font-size: 13px; font-weight: 600; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 6px;">
                \${actionTitle}
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px; text-align: left;">
              
              <h1 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.4;">
                \${greeting}
              </h1>

              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
                \${introText}
              </p>

              <!-- Gold Rectangular OTP Container -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="padding: 22px 16px; background-color: #d4af37; border-radius: 12px; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.25);">
                    <div style="font-family: 'Courier New', Courier, Monaco, monospace; font-size: 38px; font-weight: 900; color: #ffffff; letter-spacing: 10px; text-indent: 10px; text-align: center; margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.15);">
                      \${formattedCode}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; font-weight: 500;">
                ⏱️ This code expires in <strong>10 minutes</strong>.
              </p>

              <!-- Security Warning Box -->
              <p style="color: #475569; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0; padding: 12px 16px; background-color: #f8fafc; border-left: 3px solid #d4af37; border-radius: 4px;">
                🛡️ <strong>For your security:</strong> Never share this code with anyone. The Zakir team will never ask for your code.
              </p>

              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
                If you didn't request this code, you can safely ignore this email.
              </p>

              <!-- Sign Off -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #334155; font-size: 14px; font-weight: 600;">
                The Zakir Team
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>\`;

  return { subject, text: textBody, html };
}

function hashVerificationCode`;

code = code.replace(functionRegex, newFunction);

fs.writeFileSync('server.ts', code);
