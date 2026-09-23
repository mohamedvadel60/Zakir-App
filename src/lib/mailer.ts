import { Resend } from "resend";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import "./env.js";

const getResendInstance = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === "undefined") {
    return null;
  }
  return new Resend(apiKey.trim());
};

let emailLogoLightCache: Buffer | null = null;
let emailLogoDarkCache: Buffer | null = null;
let emailLogoWhiteCache: Buffer | null = null;
let emailLogoNavyCache: Buffer | null = null;
let emailLogoBlackCache: Buffer | null = null;
let emailAvatarCache: Buffer | null = null;

export function getOfficialLogoBlackBuffer(): Buffer {
  if (emailLogoBlackCache && emailLogoBlackCache.length > 0) {
    return emailLogoBlackCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-logo-black.png"),
    path.join(process.cwd(), "src", "assets", "zakir-logo-black.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailLogoBlackCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialLogoWhiteBuffer(): Buffer {
  if (emailLogoWhiteCache && emailLogoWhiteCache.length > 0) {
    return emailLogoWhiteCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-logo-white.png"),
    path.join(process.cwd(), "src", "assets", "zakir-logo-white.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailLogoWhiteCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialLogoNavyBuffer(): Buffer {
  if (emailLogoNavyCache && emailLogoNavyCache.length > 0) {
    return emailLogoNavyCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-logo-navy.png"),
    path.join(process.cwd(), "src", "assets", "zakir-logo-navy.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailLogoNavyCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialEmailLogoLightBuffer(): Buffer {
  if (emailLogoLightCache && emailLogoLightCache.length > 0) {
    return emailLogoLightCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-badge-light.png"),
    path.join(process.cwd(), "src", "assets", "zakir-badge-light.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailLogoLightCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialEmailLogoDarkBuffer(): Buffer {
  if (emailLogoDarkCache && emailLogoDarkCache.length > 0) {
    return emailLogoDarkCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-badge-dark.png"),
    path.join(process.cwd(), "src", "assets", "zakir-badge-dark.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailLogoDarkCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialSenderAvatarBuffer(): Buffer {
  if (emailAvatarCache && emailAvatarCache.length > 0) {
    return emailAvatarCache;
  }
  const possiblePaths = [
    path.join(process.cwd(), "public", "zakir-sender-avatar.png"),
    path.join(process.cwd(), "src", "assets", "zakir-sender-avatar.png"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b = fs.readFileSync(p);
        if (b && b.length > 0) {
          emailAvatarCache = b;
          return b;
        }
      } catch (e) {}
    }
  }
  return Buffer.alloc(0);
}

export function getOfficialEmailLogoBuffer(): Buffer {
  return getOfficialEmailLogoLightBuffer();
}

export function cleanUserName(name?: string, email?: string): string {
  if (name && name.trim() && !name.includes("@")) {
    return name.trim();
  }
  if (email && email.includes("@")) {
    const local = email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "Valued Member";
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildMasterEmailHtml(options: {
  subject: string;
  title: string;
  greeting?: string;
  bodyHtml: string;
  securityNote?: string;
  baseUrl?: string;
}): string {
  const { subject, title, greeting, bodyHtml, securityNote, baseUrl } = options;
  const canonicalDomain = "https://www.getzakir.com";
  const appBase = (baseUrl || process.env.VITE_APP_URL || process.env.VITE_BACKEND_URL || canonicalDomain).replace(
    /\/$/,
    ""
  );

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="ar">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title || subject)}</title>
  <style type="text/css">
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      .zakir-logo-light {
        display: none !important;
        mso-hide: all !important;
        font-size: 0px !important;
        line-height: 0px !important;
        max-height: 0px !important;
        max-width: 0px !important;
        overflow: hidden !important;
      }
      .zakir-logo-dark-wrap {
        display: block !important;
        mso-hide: none !important;
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
        font-size: 0 !important;
        line-height: 0 !important;
      }
      .zakir-logo-dark {
        display: block !important;
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
      }
      .zakir-footer-logo-light {
        display: none !important;
        max-height: 0px !important;
        overflow: hidden !important;
      }
      .zakir-footer-logo-dark {
        display: inline-block !important;
        max-height: none !important;
        overflow: visible !important;
      }
      .zakir-card {
        background-color: #0b1329 !important;
        border-color: #1e293b !important;
      }
      .zakir-header-cell {
        background-color: #0b1329 !important;
        border-bottom-color: #1e293b !important;
      }
      .zakir-wordmark {
        color: #f8fafc !important;
      }
      .zakir-body-cell {
        background-color: #0b1329 !important;
      }
      .zakir-title {
        color: #f8fafc !important;
      }
      .zakir-footer-cell {
        background-color: #070d1d !important;
        border-top-color: #1e293b !important;
      }
      .zakir-footer-text {
        color: #94a3b8 !important;
      }
    }
    /* Outlook / Webmail Dark Mode Overrides */
    [data-ogsc] .zakir-logo-light,
    [data-ogsb] .zakir-logo-light {
      display: none !important;
    }
    [data-ogsc] .zakir-logo-dark-wrap,
    [data-ogsb] .zakir-logo-dark-wrap,
    [data-ogsc] .zakir-logo-dark,
    [data-ogsb] .zakir-logo-dark {
      display: block !important;
      max-height: none !important;
      overflow: visible !important;
    }
    [data-ogsc] .zakir-footer-logo-light,
    [data-ogsb] .zakir-footer-logo-light {
      display: none !important;
    }
    [data-ogsc] .zakir-footer-logo-dark,
    [data-ogsb] .zakir-footer-logo-dark {
      display: inline-block !important;
      max-height: none !important;
      overflow: visible !important;
    }
    [data-ogsc] .zakir-card,
    [data-ogsb] .zakir-card {
      background-color: #0b1329 !important;
      border-color: #1e293b !important;
    }
    [data-ogsc] .zakir-wordmark,
    [data-ogsb] .zakir-wordmark {
      color: #f8fafc !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Master Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="zakir-card" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);">
          <!-- Header with Official ZAKIR Square Badge System -->
          <tr>
            <td class="zakir-header-cell" style="padding: 36px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <!-- Perfect 1:1 Square Logo Container (72px x 72px) -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin: 0 auto 16px auto; border-collapse: collapse; border-spacing: 0;">
                <tr>
                  <td align="center" valign="middle" style="padding: 0; margin: 0; line-height: 0; font-size: 0; text-align: center;">
                    <a href="${appBase}" target="_blank" style="text-decoration: none; display: inline-block; line-height: 0; font-size: 0; outline: none; border: 0;">
                      <!-- LIGHT MODE: Solid Navy Square (#1C2C58) + Crisp White ZAKIR Logo (#FFFFFF) -->
                      <img src="cid:zakir-logo-light" alt="ZAKIR" width="72" height="72" class="zakir-logo-light" style="display: block; width: 72px !important; height: 72px !important; max-width: 72px !important; max-height: 72px !important; aspect-ratio: 1 / 1; border: 0; outline: none; text-decoration: none; margin: 0 auto; -ms-interpolation-mode: bicubic; border-radius: 16px;" />
                      
                      <!-- DARK MODE: Solid Pure White Square (#FFFFFF) + Crisp Navy ZAKIR Logo (#1C2C58) -->
                      <!--[if !mso]><!-->
                      <div class="zakir-logo-dark-wrap" style="display: none; mso-hide: all; max-height: 0px; max-width: 0px; overflow: hidden; width: 0; height: 0; margin: 0 auto; line-height: 0; font-size: 0;">
                        <img src="cid:zakir-logo-dark" alt="ZAKIR" width="72" height="72" class="zakir-logo-dark" style="display: none; width: 72px !important; height: 72px !important; max-width: 72px !important; max-height: 72px !important; aspect-ratio: 1 / 1; border: 0; outline: none; text-decoration: none; margin: 0 auto; -ms-interpolation-mode: bicubic; border-radius: 16px;" />
                      </div>
                      <!--<![endif]-->
                    </a>
                  </td>
                </tr>
              </table>

              <!-- ZAKIR Wordmark: Bold, uppercase, clean spacing -->
              <div class="zakir-wordmark" style="color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; line-height: 1.2; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                ZAKIR
              </div>

              <!-- Official Supporting Tagline -->
              <div style="color: #64748b; font-size: 13px; font-weight: 500; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                الذاكرة المؤسسية السببية &bull; Causal Decision Intelligence
              </div>
            </td>
          </tr>
          <tr>
            <td class="zakir-body-cell" style="padding: 34px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <h1 class="zakir-title" style="color: #0f172a; font-size: 20px; font-weight: 800; margin: 0 0 16px 0; line-height: 1.4; letter-spacing: -0.2px;">${escapeHtml(title)}</h1>
              ${greeting ? `<p style="color: #334155; font-size: 15px; font-weight: 600; margin: 0 0 20px 0; line-height: 1.5;">${escapeHtml(greeting)}</p>` : ""}
              ${bodyHtml}
              ${securityNote ? `
              <div style="margin-top: 26px; padding: 14px 18px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #475569; font-size: 12px; line-height: 1.6;"><strong>Security Notice / تنبيه أمني:</strong> ${escapeHtml(securityNote)}</p>
              </div>` : ""}
            </td>
          </tr>
          <tr>
            <td class="zakir-footer-cell" style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              <!-- Mini Footer Brand with Light/Dark Inversion -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin: 0 auto 10px auto;">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    <span class="zakir-footer-logo-light" style="display: inline-block; vertical-align: middle; margin-right: 8px;">
                      <img src="cid:zakir-logo-light" alt="ZAKIR" width="22" height="22" style="display: block; width: 22px; height: 22px; border-radius: 5px; border: 0;" />
                    </span>
                    <!--[if !mso]><!-->
                    <span class="zakir-footer-logo-dark" style="display: none; mso-hide: all; max-height: 0; max-width: 0; overflow: hidden; vertical-align: middle; margin-right: 8px;">
                      <img src="cid:zakir-logo-dark" alt="ZAKIR" width="22" height="22" style="display: block; width: 22px; height: 22px; border-radius: 5px; border: 0;" />
                    </span>
                    <!--<![endif]-->
                    <span class="zakir-wordmark" style="font-size: 13px; font-weight: 800; color: #0f172a; vertical-align: middle; letter-spacing: 1.5px; text-transform: uppercase;">ZAKIR</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                الذاكرة المؤسسية السببية &bull; Causal Decision Intelligence
              </p>
              <p class="zakir-footer-text" style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Zakir Intelligence Platform. All rights reserved.<br>
                Enterprise security &amp; institutional data protection.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildOtpEmailHtml(options: {
  email: string;
  otpCode: string;
  type?: string;
  userName?: string;
}): { subject: string; text: string; html: string } {
  const { email, otpCode, type = "account_recovery", userName } = options;
  const cleanName = cleanUserName(userName, email);
  
  let subject = "Zakir Verification Code";
  let title = "Verification Code";
  
  if (type === "account_recovery") {
    subject = "Account Restoration Verification Code - Zakir";
    title = "Verify Your Account Restoration";
  } else if (type === "password_reset") {
    subject = "Password Reset Code - Zakir";
    title = "Reset Your Password";
  }

  const bodyHtml = `
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      Use the following single-use verification code to complete your request for <strong style="color:#2563eb;">${email}</strong>.
    </p>
    <div style="margin:24px 0;padding:20px;background-color:#eff6ff;border:1px dashed #2563eb;border-radius:12px;text-align:center;">
      <span style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${otpCode}</span>
      <p style="margin:8px 0 0 0;color:#64748b;font-size:12px;">Valid for 10 minutes</p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting: `Hello ${cleanName},`,
    bodyHtml,
    securityNote: "Do not share this code with anyone. Zakir staff will never ask for your code."
  });

  const text = `Hello ${cleanName},\n\nYour Zakir verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export function buildRecoveryApprovalEmailHtml(options: {
  userName: string;
  email: string;
}): { subject: string; text: string; html: string } {
  const { userName, email } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Approved - Zakir";
  const title = "Your Account Recovery Has Been Approved";
  const greeting = `Hello ${cleanName},`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      We are pleased to inform you that your account recovery request for <strong>${email}</strong> has been reviewed and <strong style="color:#16a34a;">approved</strong> by our administration team.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 700;">
        Next Step: Complete Verification
      </p>
      <p style="margin: 8px 0 0 0; color: #1d4ed8; font-size: 13px; line-height: 1.5;">
        Please return to the Zakir application and proceed with verification to receive your final code and restore your active workspace.
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "For security, complete your restoration within 72 hours."
  });

  const text = `${greeting}\n\nYour account recovery request has been approved by our administration team.\n\nPlease return to Zakir to complete verification and restore your workspace.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export function buildRecoveryRejectionEmailHtml(options: {
  userName: string;
  email: string;
  rejectionReason?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, rejectionReason } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "Account Recovery Request Update - Zakir";
  const title = "Account Recovery Request Decision";
  const greeting = `Hello ${cleanName},`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      After reviewing the identity documentation submitted for <strong>${email}</strong>, our administration team was unable to approve the account recovery request.
    </p>
    ${rejectionReason ? `
    <div style="margin: 20px 0; padding: 18px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;">
      <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 700;">Reason Provided:</p>
      <p style="margin: 6px 0 0 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${rejectionReason}</p>
    </div>` : ""}
    <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
      If you believe this decision was made in error or you have updated official documentation, you may submit a new recovery request with clearer identification proofs.
    </p>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "Uploaded identity documents have been purged from our storage system in accordance with our data protection policies."
  });

  const text = `${greeting}\n\nYour account recovery request could not be approved at this time.\n${rejectionReason ? `Reason: ${rejectionReason}\n` : ""}\nYou may submit a new request with updated documentation if appropriate.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export async function sendSystemMail(
  toOrOptions: string | { to: string; subject: string; html: string; text?: string; attachments?: any[] },
  subjectArg?: string,
  textArg?: string,
  htmlArg?: string
): Promise<{
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: any;
  userFriendlyMessage?: string;
  provider?: string;
  statusCode?: number;
}> {
  let to: string;
  let subject: string;
  let html: string;
  let text: string;
  let userAttachments: any[] = [];

  if (typeof toOrOptions === "string") {
    to = toOrOptions;
    subject = subjectArg || "";
    const arg3 = textArg || "";
    const arg4 = htmlArg || "";
    if (arg3.includes("<!DOCTYPE") || arg3.includes("<html") || arg3.includes("<table") || arg3.includes("<div")) {
      html = arg3;
      text = arg4;
    } else {
      html = arg4;
      text = arg3;
    }
  } else if (toOrOptions && typeof toOrOptions === "object") {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
    text = toOrOptions.text || "";
    userAttachments = toOrOptions.attachments || [];
  } else {
    to = "";
    subject = "";
    html = "";
    text = "";
  }

  let fromSender = (
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    "noreply@getzakir.com"
  ).trim();

  if (
    !fromSender ||
    fromSender.includes("yourdomain.com") ||
    fromSender.includes("example.com") ||
    fromSender.includes("onboarding@resend.dev")
  ) {
    fromSender = "noreply@getzakir.com";
  }

  if (!fromSender.includes("<")) {
    fromSender = `Zakir Platform <${fromSender}>`;
  }

  try {
    const resend = getResendInstance();
    if (!resend) {
      console.warn(`[EMAIL DISPATCH NOTICE] RESEND_API_KEY is not configured. Simulating delivery for: ${to} | Subject: "${subject}"`);
      return {
        success: true,
        simulated: true,
        provider: "local_simulation",
        messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`
      };
    }

    console.log(`[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${fromSender}`);

    const emailAttachments: any[] = [...userAttachments];
    
    // Official ZAKIR Light Mode Badge (Navy Square #1C2C58 + White Symbol #FFFFFF)
    if (
      html.includes("cid:zakir-logo-light") ||
      html.includes("cid:zakir-badge-light") ||
      html.includes("cid:zakir-logo")
    ) {
      const hasLightBadge = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-light" ||
          a.cid === "zakir-logo-light" ||
          a.filename === "zakir-badge-light.png"
      );
      if (!hasLightBadge) {
        const lightBadgeBuf = getOfficialEmailLogoLightBuffer();
        if (lightBadgeBuf && lightBadgeBuf.length > 0) {
          emailAttachments.push({
            filename: "zakir-badge-light.png",
            content: lightBadgeBuf,
            contentType: "image/png",
            contentId: "zakir-logo-light",
            cid: "zakir-logo-light",
          });
        }
      }
    }

    // Official ZAKIR Dark Mode Badge (White Square #FFFFFF + Navy Symbol #1C2C58)
    if (
      html.includes("cid:zakir-logo-dark") ||
      html.includes("cid:zakir-badge-dark")
    ) {
      const hasDarkBadge = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-dark" ||
          a.cid === "zakir-logo-dark" ||
          a.filename === "zakir-badge-dark.png"
      );
      if (!hasDarkBadge) {
        const darkBadgeBuf = getOfficialEmailLogoDarkBuffer();
        if (darkBadgeBuf && darkBadgeBuf.length > 0) {
          emailAttachments.push({
            filename: "zakir-badge-dark.png",
            content: darkBadgeBuf,
            contentType: "image/png",
            contentId: "zakir-logo-dark",
            cid: "zakir-logo-dark",
          });
        }
      }
    }

    // Transparent Navy Symbol fallback if explicitly requested
    if (html.includes("cid:zakir-logo-navy")) {
      const hasNavyLogo = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-navy" ||
          a.cid === "zakir-logo-navy" ||
          a.filename === "zakir-logo-navy.png"
      );
      if (!hasNavyLogo) {
        const navyBuf = getOfficialLogoNavyBuffer();
        if (navyBuf && navyBuf.length > 0) {
          emailAttachments.push({
            filename: "zakir-logo-navy.png",
            content: navyBuf,
            contentType: "image/png",
            contentId: "zakir-logo-navy",
            cid: "zakir-logo-navy",
          });
        }
      }
    }

    // Transparent White Symbol fallback if explicitly requested
    if (html.includes("cid:zakir-logo-white")) {
      const hasWhiteLogo = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-white" ||
          a.cid === "zakir-logo-white" ||
          a.filename === "zakir-logo-white.png"
      );
      if (!hasWhiteLogo) {
        const whiteBuf = getOfficialLogoWhiteBuffer();
        if (whiteBuf && whiteBuf.length > 0) {
          emailAttachments.push({
            filename: "zakir-logo-white.png",
            content: whiteBuf,
            contentType: "image/png",
            contentId: "zakir-logo-white",
            cid: "zakir-logo-white",
          });
        }
      }
    }

    const emailPayload: any = {
      from: fromSender,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined,
    };

    if (emailAttachments.length > 0) {
      emailPayload.attachments = emailAttachments;
    }

    const response = await resend.emails.send(emailPayload);

    if (response.error) {
      const errStatus = (response.error as any).statusCode || (response.error as any).status || 400;
      console.error("[EMAIL DELIVERY FAILURE]", {
        code: response.error.name || "RESEND_ERROR",
        message: response.error.message,
        provider: "Resend",
        httpStatus: errStatus
      });

      return {
        success: false,
        error: response.error,
        statusCode: errStatus,
        userFriendlyMessage: "Failed to send email message."
      };
    }

    return {
      success: true,
      provider: "Resend",
      messageId: response.data?.id
    };
  } catch (err: any) {
    console.error("[EMAIL DISPATCH CRITICAL EXCEPTION]", err);
    return {
      success: false,
      error: err,
      userFriendlyMessage: "Failed to send email due to a system error."
    };
  }
}
