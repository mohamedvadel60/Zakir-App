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
    path.join(process.cwd(), "public", "zakir-email-logo.png"),
    path.join(process.cwd(), "public", "zakir-badge-light.png"),
    path.join(process.cwd(), "src", "assets", "zakir-email-logo.png"),
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
    path.join(process.cwd(), "public", "zakir-email-logo.png"),
    path.join(process.cwd(), "public", "zakir-badge-dark.png"),
    path.join(process.cwd(), "src", "assets", "zakir-email-logo.png"),
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

/**
 * Generates the unified, strict ZAKIR Logo Container for all HTML emails.
 * Solid Navy Square (#1C2C58) + Crisp White ZAKIR Logo (#FFFFFF) centered.
 * Self-contained email-safe asset from logo.txt source of truth.
 */
export function renderEmailLogoHeaderHtml(options?: {
  appBase?: string;
  wordmark?: string;
  tagline?: string;
  size?: number;
}): string {
  const size = options?.size || 96;
  const rawAppBase = options?.appBase || "https://www.getzakir.com";
  const publicAssetBase = (rawAppBase && rawAppBase.startsWith("https://") && !rawAppBase.includes("localhost"))
    ? rawAppBase.replace(/\/$/, "")
    : "https://www.getzakir.com";
  const appBase = rawAppBase;

  const logoUrl = `${publicAssetBase}/zakir-email-logo.png`;

  const wordmark = options?.wordmark !== undefined ? options.wordmark : "ZAKIR";
  const tagline =
    options?.tagline !== undefined
      ? options.tagline
      : "الذاكرة المؤسسية السببية &bull; Causal Decision Intelligence";

  return `
    <!-- Official ZAKIR Badge (Self-Contained Vector Render from logo.txt) -->
    <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" width="${size}" height="${size}" class="zakir-logo-table" style="width: ${size}px !important; height: ${size}px !important; max-width: ${size}px !important; max-height: ${size}px !important; margin: 0 auto 16px auto; border-collapse: collapse; border-spacing: 0;">
      <tr>
        <td align="center" valign="middle" width="${size}" height="${size}" bgcolor="#1C2C58" style="width: ${size}px; height: ${size}px; padding: 0; margin: 0; line-height: 0; font-size: 0; text-align: center; vertical-align: middle; background-color: #1C2C58; border-radius: 20px;">
          <a href="${appBase}" target="_blank" style="text-decoration: none; display: inline-block; width: ${size}px; height: ${size}px; margin: 0 auto; line-height: 0; font-size: 0; outline: none; border: 0;">
            <img src="${logoUrl}" alt="ZAKIR" width="${size}" height="${size}" class="zakir-logo" style="display: block; width: ${size}px !important; height: ${size}px !important; max-width: ${size}px !important; max-height: ${size}px !important; border: 0; outline: none; text-decoration: none; margin: 0 auto; border-radius: 20px; -ms-interpolation-mode: bicubic;" />
          </a>
        </td>
      </tr>
    </table>

    ${
      wordmark
        ? `<!-- ZAKIR Wordmark: Bold, uppercase, clean spacing -->
    <div class="zakir-wordmark" style="color: #0f172a; font-size: 22px; font-weight: 800; letter-spacing: 2.5px; text-transform: uppercase; line-height: 1.2; margin: 0 0 6px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${wordmark}
    </div>`
        : ""
    }

    ${
      tagline
        ? `<!-- Official Supporting Tagline -->
    <div style="color: #64748b; font-size: 13px; font-weight: 500; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      ${tagline}
    </div>`
        : ""
    }
  `;
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
  const appBase = (
    baseUrl ||
    process.env.VITE_APP_URL ||
    process.env.VITE_BACKEND_URL ||
    process.env.APP_URL ||
    canonicalDomain
  ).replace(/\/$/, "");

  const publicAssetBase = (appBase && appBase.startsWith("https://") && !appBase.includes("localhost"))
    ? appBase.replace(/\/$/, "")
    : "https://www.getzakir.com";

  const logoHeaderHtml = renderEmailLogoHeaderHtml({ appBase, size: 96 });

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
    .zakir-logo {
      display: block !important;
      border-radius: 20px;
    }
    @media (prefers-color-scheme: dark) {
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
    /* Webmail Dark Mode Overrides */
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
          <!-- Header with Official ZAKIR 96x96 Square Badge System -->
          <tr>
            <td class="zakir-header-cell" style="padding: 36px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              ${logoHeaderHtml}
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
              <!-- Mini Footer Brand -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" role="presentation" style="margin: 0 auto 10px auto;">
                <tr>
                  <td align="center" style="vertical-align: middle;">
                    <img src="${publicAssetBase}/zakir-email-logo.png" alt="ZAKIR" width="24" height="24" style="display: inline-block; width: 24px; height: 24px; border-radius: 6px; border: 0; vertical-align: middle; margin-right: 8px;" />
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
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { email, otpCode, type = "account_recovery", userName, baseUrl } = options;
  const cleanName = cleanUserName(userName, email);
  
  let subject = "رمز التحقق لتفعيل حسابك في Zakir - Verify your Zakir account";
  let title = "تفعيل حسابك في Zakir | Activate Account";
  
  if (type === "account_recovery") {
    subject = "رمز التحقق لاستعادة الحساب - Account Restoration Code | Zakir";
    title = "التحقق من استعادة الحساب | Verify Account Restoration";
  } else if (type === "password_reset") {
    subject = "إعادة تعيين كلمة المرور - Password Reset Code | Zakir";
    title = "إعادة تعيين كلمة المرور | Reset Password";
  } else if (type === "email_verification" || type === "account_registration") {
    subject = "رمز التحقق لتفعيل حسابك في Zakir - Verify your Zakir account";
    title = "تفعيل حسابك في Zakir | Activate Account";
  }

  const bodyHtml = `
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px 0;">
      يرجى استخدام رمز التحقق التالي لطلبك الخاص بالبريد: <strong style="color:#2563eb;">${escapeHtml(email)}</strong>.<br/>
      Please use the following single-use verification code for your request:
    </p>
    <div style="margin:24px 0;padding:20px;background-color:#eff6ff;border:1px dashed #2563eb;border-radius:12px;text-align:center;">
      <span style="font-family:monospace;font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;">${escapeHtml(otpCode)}</span>
      <p style="margin:8px 0 0 0;color:#64748b;font-size:12px;">صالح لمدة 10 دقائق &bull; Valid for 10 minutes</p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting: `مرحباً ${cleanName} / Hello ${cleanName},`,
    bodyHtml,
    securityNote: "لحماية أمن حسابك، لا تشارك هذا الرمز مع أي شخص مطلقا. فريق ذاكر لن يطلب منك هذا الرمز. Never share this code with anyone.",
    baseUrl
  });

  const text = `Hello ${cleanName},\n\nYour Zakir verification code is: ${otpCode}\n\nThis code will expire in 10 minutes.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export function buildRecoveryApprovalEmailHtml(options: {
  userName: string;
  email: string;
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, baseUrl } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "تمت الموافقة على طلب استعادة الحساب - Account Recovery Request Approved | Zakir";
  const title = "تمت الموافقة على استعادة الحساب";
  const greeting = `مرحباً ${cleanName} / Hello ${cleanName},`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      يسرنا إبلاغك بأنه قد تمت مراجعة طلب استعادة الحساب الخاص بالبريد <strong>${escapeHtml(email)}</strong> و<strong style="color:#16a34a;">الموافقة عليه</strong> من قبل فريق الإدارة.<br/>
      We are pleased to inform you that your account recovery request has been reviewed and approved by our administration team.
    </p>
    <div style="margin: 20px 0; padding: 20px; background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 10px;">
      <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 700;">
        الخطوة التالية: إتمام التحقق واستعادة مساحة العمل &bull; Next Step: Complete Verification
      </p>
      <p style="margin: 8px 0 0 0; color: #1d4ed8; font-size: 13px; line-height: 1.5;">
        يرجى العودة إلى تطبيق Zakir والضغط على "التحقق واستعادة الحساب" للحصول على الرمز النهائي وتفعيل مساحة العمل الخاصة بك.
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لدواعي الأمان، يرجى إتمام عملية الاستعادة خلال 72 ساعة. For security, complete your restoration within 72 hours.",
    baseUrl
  });

  const text = `${greeting}\n\nYour account recovery request has been approved by our administration team.\n\nPlease return to Zakir to complete verification and restore your workspace.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export function buildRecoveryRejectionEmailHtml(options: {
  userName: string;
  email: string;
  rejectionReason?: string;
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, rejectionReason, baseUrl } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "تحديث بخصوص طلب استعادة الحساب - Account Recovery Request Decision | Zakir";
  const title = "قرار مراجعة طلب استعادة الحساب";
  const greeting = `مرحباً ${cleanName} / Hello ${cleanName},`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      بعد مراجعة وثائق إثبات الهوية المقدمة للبريد <strong>${escapeHtml(email)}</strong>، يؤسفنا إبلاغك بتعذر الموافقة على طلب الاستعادة في الوقت الحالي.<br/>
      After reviewing the identity documentation submitted, our administration team was unable to approve the account recovery request at this time.
    </p>
    ${
      rejectionReason
        ? `
    <div style="margin: 20px 0; padding: 18px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 10px;">
      <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 700;">السبب الإداري / Reason Provided:</p>
      <p style="margin: 6px 0 0 0; color: #b91c1c; font-size: 13px; line-height: 1.5;">${escapeHtml(rejectionReason)}</p>
    </div>`
        : ""
    }
    <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
      إذا كنت تعتقد أن هذا القرار تم عن طريق الخطأ، يمكنك تقديم طلب استعادة جديد بوثائق هوية رسمية أكثر وضوحاً.
    </p>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لحماية الخصوصية، يتم حذف المستندات المرفوعة وفقاً لسياسات حماية البيانات. Uploaded identity documents are securely purged.",
    baseUrl
  });

  const text = `${greeting}\n\nYour account recovery request could not be approved at this time.\n${rejectionReason ? `Reason: ${rejectionReason}\n` : ""}\nYou may submit a new request with updated documentation if appropriate.\n\nThe Zakir Team`;
  return { subject, text, html };
}

export function buildInvitationEmailHtml(options: {
  companyName: string;
  memberName: string;
  inviterName: string;
  designatedRole: string;
  inviteLink: string;
  isReminder?: boolean;
  language?: "ar" | "en" | "fr";
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const {
    memberName,
    designatedRole,
    inviteLink,
    isReminder,
    language = "ar",
    baseUrl,
  } = options;

  const rawCompany = (options.companyName || "").trim();
  const companyName =
    rawCompany &&
    rawCompany !== "ZakIr Platform" &&
    rawCompany !== "Zakir Workspace"
      ? rawCompany
      : language === "ar"
        ? "المؤسسة"
        : language === "fr"
          ? "l'Entreprise"
          : "Organization";

  const rawInviter = (options.inviterName || "").trim();
  const inviterName =
    rawInviter ||
    (language === "ar"
      ? "مسؤول النظام"
      : language === "fr"
        ? "L'administrateur"
        : "Workspace Admin");

  let subject = "";
  let title = "";
  let greeting = "";
  let introText = "";
  let orgLabel = "";
  let inviterLabel = "";
  let roleLabel = "";
  let expiresLabel = "";
  let expiresVal = "";
  let ctaText = "";
  let fallbackText = "";
  let securityNote = "";

  if (language === "fr") {
    subject = `Invitation à rejoindre l'entreprise "${companyName}" sur Zakir`;
    title = `Invitation de l'entreprise`;
    greeting = memberName ? `Bonjour ${memberName},` : `Bonjour,`;
    introText = isReminder
      ? `Ceci est un rappel que ${inviterName} vous a invité à rejoindre l'entreprise "${companyName}" sur Zakir en tant que ${designatedRole}.`
      : `${inviterName} vous a invité à rejoindre l'entreprise "${companyName}" sur Zakir en tant que ${designatedRole}.`;
    orgLabel = "Entreprise :";
    inviterLabel = "Invité par :";
    roleLabel = "Rôle assigné :";
    expiresLabel = "Expire dans :";
    expiresVal = "7 jours";
    ctaText = "Accepter l'invitation";
    fallbackText =
      "Si le bouton ci-dessus ne fonctionne pas, copiez et collez cette URL dans votre navigateur :";
    securityNote =
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet e-mail en toute sécurité.";
  } else if (language === "en") {
    subject = `Invitation to join "${companyName}" on Zakir`;
    title = `Workspace Invitation`;
    greeting = memberName ? `Hello ${memberName},` : `Hello,`;
    introText = isReminder
      ? `This is a reminder that ${inviterName} has invited you to join "${companyName}" on Zakir as a ${designatedRole}.`
      : `${inviterName} has invited you to join "${companyName}" on Zakir as a ${designatedRole}.`;
    orgLabel = "Organization:";
    inviterLabel = "Invited by:";
    roleLabel = "Assigned Role:";
    expiresLabel = "Expires in:";
    expiresVal = "7 days";
    ctaText = "Accept invitation";
    fallbackText =
      "If the button above does not work, copy and paste this URL into your browser:";
    securityNote =
      "If you were not expecting this invitation, you can safely ignore this email.";
  } else {
    subject = `دعوة للانضمام إلى مؤسسة "${companyName}" على منصة Zakir`;
    title = `دعوة انضمام لمساحة عمل المؤسسة`;
    greeting = memberName ? `مرحباً ${memberName}،` : `مرحباً،`;
    introText = isReminder
      ? `هذا تذكير بأن المسؤول "${inviterName}" قد دعاك للانضمام إلى مؤسسة "${companyName}" على منصة Zakir بصفة "${designatedRole}".`
      : `لقد قام المسؤول "${inviterName}" بدعوتك للانضمام إلى مؤسسة "${companyName}" على منصة Zakir بصفة "${designatedRole}".`;
    orgLabel = "المؤسسة:";
    inviterLabel = "المرسل / المسؤول:";
    roleLabel = "الدور المحدد:";
    expiresLabel = "الصلاحية:";
    expiresVal = "7 أيام";
    ctaText = "قبول الدعوة والانضمام";
    fallbackText =
      "إذا لم يعمل الزر أعلاه، يرجى نسخ الرابط التالي ولصقه في متصفحك:";
    securityNote =
      "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان.";
  }

  const direction = language === "ar" ? "rtl" : "ltr";
  const textAlign = language === "ar" ? "right" : "left";

  const detailsHtml = `
    <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; direction: ${direction}; text-align: ${textAlign};">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #334155;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 140px; font-weight: 500; text-align: ${textAlign};">${escapeHtml(orgLabel)}</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: ${textAlign};">${escapeHtml(companyName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(inviterLabel)}</td>
          <td style="padding: 6px 0; font-weight: 600; color: #0f172a; text-align: ${textAlign};">${escapeHtml(inviterName)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(roleLabel)}</td>
          <td style="padding: 6px 0; text-align: ${textAlign};"><span style="display: inline-block; padding: 2px 8px; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 12px; border-radius: 4px;">${escapeHtml(designatedRole)}</span></td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b; font-weight: 500; text-align: ${textAlign};">${escapeHtml(expiresLabel)}</td>
          <td style="padding: 6px 0; font-weight: 500; color: #64748b; text-align: ${textAlign};">${escapeHtml(expiresVal)}</td>
        </tr>
      </table>
    </div>
  `;

  const ctaButtonHtml = `
    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 28px auto 20px auto;">
      <tr>
        <td align="center" bgcolor="#0075DE" style="border-radius: 10px;">
          <a href="${inviteLink}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block; padding: 14px 32px; border-radius: 10px; background-color: #0075DE; border: 1px solid #0075DE;">
            ${escapeHtml(ctaText)}
          </a>
        </td>
      </tr>
    </table>
    <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center; word-break: break-all; direction: ${direction};">
      ${escapeHtml(fallbackText)}<br/>
      <a href="${inviteLink}" style="color: #0075DE; text-decoration: underline;">${inviteLink}</a>
    </p>
  `;

  const bodyHtml = `
    <div style="direction: ${direction}; text-align: ${textAlign};">
      <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
        ${escapeHtml(introText)}
      </p>
    </div>
    ${detailsHtml}
    ${ctaButtonHtml}
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote,
    baseUrl,
  });

  const text = `${greeting}\n\n${introText}\n\n${orgLabel} ${companyName}\n${inviterLabel} ${inviterName}\n${roleLabel} ${designatedRole}\n\n${ctaText}: ${inviteLink}\n\n${expiresLabel} ${expiresVal}`;

  return { subject, text, html };
}

export function buildSupportReplyEmailHtml(options: {
  recipientName: string;
  ticketId: string;
  ticketSubject: string;
  message: string;
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { recipientName, ticketId, ticketSubject, message, baseUrl } = options;
  const subject = `Zakir Support: ${ticketSubject}`;
  const title = "Support Ticket Reply";
  const greeting = recipientName ? `Hello ${recipientName},` : `Hello,`;

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Our support team has replied to your request.
    </p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px;">
      <p style="margin: 0; font-weight: 700; color: #1d4ed8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ticket #${escapeHtml(ticketId)}</p>
      <p style="margin: 4px 0 0 0; font-weight: 700; color: #0f172a; font-size: 15px;">${escapeHtml(ticketSubject)}</p>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Latest Response from Support:</p>
      <p style="margin: 0; color: #0f172a; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</p>
    </div>

    <p style="margin-bottom: 0; color: #475569; font-size: 14px;">
      Open your Zakir account to view the response and continue the conversation.
    </p>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    baseUrl
  });

  const text = `${greeting}\n\nOur support team has replied to your request.\n\nTicket #${ticketId}: ${ticketSubject}\n\nResponse:\n${message}\n\nOpen your Zakir account to view the response and continue the conversation.`;

  return { subject, text, html };
}

export function buildNewAccountApprovalEmailHtml(options: {
  userName?: string;
  email: string;
  trialHours?: number;
  plan?: string;
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, trialHours = 24, plan = "Starter", baseUrl } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "تم اعتماد حسابك رسمياً في منصة ذاكر | Your Zakir Account has been Approved";
  const title = "تم اعتماد حسابك بنجاح";
  const greeting = cleanName ? `مرحباً ${cleanName}،` : "مرحباً بك،";
  const appBase = (baseUrl || process.env.APP_URL || "https://www.getzakir.com").replace(/\/$/, "");

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: right; direction: rtl;">
      يسرنا إبلاغك بأنه قد تم التحقق من بيانات حسابك والموافقة عليه رسمياً من قبل إدارة منصة <strong>ذاكر (Zakir)</strong>، وأصبح حسابك الآن مفعلاً وجاهزاً للاستخدام بالكامل.
    </p>

    <!-- Trial Information Banner -->
    <div style="margin: 22px 0; padding: 18px 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-right: 4px solid #10b981; border-radius: 12px; text-align: right; direction: rtl;">
      <div style="color: #166534; font-size: 15px; font-weight: 800; margin-bottom: 6px;">
        فترة التجربة المجانية (${trialHours} ساعة) بدأت الآن
      </div>
      <p style="margin: 0; color: #15803d; font-size: 13px; line-height: 1.6;">
        تم اعتماد باقة <strong>${escapeHtml(plan)}</strong> لحسابك مع فترة تجربة مجانية كاملة مدتها <strong>${trialHours} ساعة</strong> تبدأ من لحظة هذا الاعتماد، لتتيح لك استكشاف وتجربة كافة قدرات التحليلات السببية والذاكرة المؤسسية.
      </p>
    </div>

    <!-- Direct Official Login Link -->
    <div style="margin: 32px 0 24px 0; text-align: center;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${appBase}/login" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="#0075DE">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">تسجيل الدخول إلى Zakir</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${appBase}/login" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0075DE; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 117, 222, 0.25); text-align: center;">
        تسجيل الدخول إلى Zakir &bull; Log In to Zakir
      </a>
      <!--<![endif]-->
      <p style="margin: 14px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace;">
        <a href="${appBase}/login" target="_blank" rel="noopener noreferrer" style="color: #0075DE; text-decoration: underline;">${appBase}/login</a>
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لتسجيل الدخول، يرجى استخدام بريدك الإلكتروني الموثق وكلمة المرور الخاصة بك عبر الرابط الرسمي أعلاه.",
    baseUrl
  });

  const text = `${greeting}\n\nيسرنا إبلاغك بأنه قد تم التحقق من بيانات حسابك والموافقة عليه رسمياً من قبل إدارة منصة ذاكر (Zakir).\n\nحسابك الآن مفعل وجاهز للاستخدام، وقد بدأت فترة تجربتك المجانية الكاملة (${trialHours} ساعة) المعتمدة لباقة [${plan}] من لحظة هذا الاعتماد.\n\nلتسجيل الدخول إلى منصة ذاكر، يرجى زيارة الرابط الرسمي التالي:\n${appBase}/login\n\nمع تحيات،\nفريق منصة ذاكر (Zakir Team)`;

  return { subject, text, html };
}

export function buildNewAccountRejectionEmailHtml(options: {
  userName?: string;
  email: string;
  reason?: string;
  baseUrl?: string;
}): { subject: string; text: string; html: string } {
  const { userName, email, reason = "يرجى تقديم وثائق هوية رسمية واضحة ومحدثة.", baseUrl } = options;
  const cleanName = cleanUserName(userName, email);
  const subject = "يلزم تحديث مستندات توثيق حسابك في منصة ذاكر | Action Required: Update Verification Documents - Zakir";
  const title = "يلزم تحديث مستندات التوثيق";
  const greeting = cleanName ? `مرحباً ${cleanName}،` : "مرحباً بك،";
  const appBase = (baseUrl || process.env.APP_URL || "https://www.getzakir.com").replace(/\/$/, "");

  const bodyHtml = `
    <p style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0; text-align: right; direction: rtl;">
      نشكرك على تسجيلك في منصة <strong>ذاكر (Zakir)</strong>. بعد مراجعة مستندات التحقق المرفوعة من قبلك، نود إفادتك بأنه يلزم تحديث أو استبدال بعض المستندات لإتمام عملية توثيق الحساب واعتماده.
    </p>

    <!-- Reason Banner -->
    <div style="margin: 22px 0; padding: 18px 20px; background-color: #fff1f2; border: 1px solid #fecdd3; border-right: 4px solid #e11d48; border-radius: 12px; text-align: right; direction: rtl;">
      <div style="color: #9f1239; font-size: 15px; font-weight: 800; margin-bottom: 6px;">
        سبب رفض المستندات والملاحظات الإدارية:
      </div>
      <p style="margin: 0; color: #be123c; font-size: 14px; line-height: 1.6; font-weight: 600;">
        ${escapeHtml(reason)}
      </p>
    </div>

    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 20px 0; text-align: right; direction: rtl;">
      يمكنك تسجيل الدخول إلى حسابك الآن واستبدال أو رفع المستندات المطلوبة (صورة واضحة للهوية الوطنية أو جواز السفر، وبيانات المنشأة إن وجدت) ثم الضغط على "إعادة إرسال للمراجعة".
    </p>

    <!-- Direct Re-Upload Link -->
    <div style="margin: 32px 0 24px 0; text-align: center;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${appBase}/login" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="#0075DE">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">تحديث المستندات وإعادة الإرسال</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${appBase}/login" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #0075DE; color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 10px; box-shadow: 0 4px 14px rgba(0, 117, 222, 0.25); text-align: center;">
        تحديث المستندات الآن &bull; Update Documents Now
      </a>
      <!--<![endif]-->
      <p style="margin: 14px 0 0 0; color: #64748b; font-size: 12px; font-family: monospace;">
        <a href="${appBase}/login" target="_blank" rel="noopener noreferrer" style="color: #0075DE; text-decoration: underline;">${appBase}/login</a>
      </p>
    </div>
  `;

  const html = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "لتحديث المستندات، قم بتسجيل الدخول إلى المنصة عبر الرابط الرسمي أعلاه باستخدام بريدك وكلمة مرورك.",
    baseUrl
  });

  const text = `${greeting}\n\nنود إفادتك بأنه يلزم تحديث مستندات التوثيق الخاصة بحسابك في منصة ذاكر (Zakir).\n\nسبب الرفض والملاحظات الإدارية:\n${reason}\n\nيرجى تسجيل الدخول إلى حسابك لاستبدال أو رفع المستندات المطلوبة وإعادة الإرسال عبر الرابط التالي:\n${appBase}/login\n\nمع تحيات،\nفريق منصة ذاكر (Zakir Team)`;

  return { subject, text, html };
}

export async function sendSystemMail(
  toOrOptions:
    | string
    | {
        to: string;
        subject: string;
        html?: string;
        bodyHtml?: string;
        body?: string;
        title?: string;
        text?: string;
        attachments?: any[];
      },
  subjectArg?: string,
  textArg?: string,
  htmlArg?: string,
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
    if (
      arg3.includes("<!DOCTYPE") ||
      arg3.includes("<html") ||
      arg3.includes("<table") ||
      arg3.includes("<div")
    ) {
      html = arg3;
      text = arg4;
    } else {
      html = arg4;
      text = arg3;
    }
  } else if (toOrOptions && typeof toOrOptions === "object") {
    to = toOrOptions.to || "";
    subject = toOrOptions.subject || "";
    userAttachments = toOrOptions.attachments || [];
    if (toOrOptions.html) {
      html = toOrOptions.html;
    } else if (toOrOptions.bodyHtml || toOrOptions.body || toOrOptions.title) {
      html = buildMasterEmailHtml({
        subject: toOrOptions.subject || "Zakir Notification",
        title: toOrOptions.title || toOrOptions.subject || "Zakir Notification",
        bodyHtml: toOrOptions.bodyHtml || toOrOptions.body || "",
      });
    } else {
      html = "";
    }
    text = toOrOptions.text || "";
  } else {
    to = "";
    subject = "";
    html = "";
    text = "";
  }

  html = html || "";

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
      console.warn(
        `[EMAIL DISPATCH NOTICE] RESEND_API_KEY is not configured. Simulating delivery for: ${to} | Subject: "${subject}"`,
      );
      return {
        success: true,
        simulated: true,
        provider: "local_simulation",
        messageId: `sim_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
      };
    }

    console.log(
      `[EMAIL DISPATCH ATTEMPT] To: ${to} | Subject: "${subject}" | Sender: ${fromSender}`,
    );

    const emailAttachments: any[] = [...userAttachments];

    // Official ZAKIR Light Mode Badge (Navy Square #1C2C58 + White Symbol #FFFFFF) [96x96 px presentation]
    if (
      html.includes("cid:zakir-logo-light") ||
      html.includes("cid:zakir-badge-light") ||
      html.includes("cid:zakir-logo")
    ) {
      const hasLightBadge = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-light" ||
          a.cid === "zakir-logo-light" ||
          a.filename === "zakir-badge-light.png",
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

    // Official ZAKIR Dark Mode Badge (White Square #FFFFFF + Navy Symbol #1C2C58) [96x96 px presentation]
    if (
      html.includes("cid:zakir-logo-dark") ||
      html.includes("cid:zakir-badge-dark")
    ) {
      const hasDarkBadge = emailAttachments.some(
        (a: any) =>
          a.contentId === "zakir-logo-dark" ||
          a.cid === "zakir-logo-dark" ||
          a.filename === "zakir-badge-dark.png",
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
          a.filename === "zakir-logo-navy.png",
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
          a.filename === "zakir-logo-white.png",
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
      const errStatus =
        (response.error as any).statusCode ||
        (response.error as any).status ||
        400;
      console.error("[EMAIL DELIVERY FAILURE]", {
        code: response.error.name || "RESEND_ERROR",
        message: response.error.message,
        provider: "Resend",
        httpStatus: errStatus,
      });

      return {
        success: false,
        error: response.error,
        statusCode: errStatus,
        userFriendlyMessage: "Failed to send email message.",
      };
    }

    return {
      success: true,
      provider: "Resend",
      messageId: response.data?.id,
    };
  } catch (err: any) {
    console.error("[EMAIL DISPATCH CRITICAL EXCEPTION]", err);
    return {
      success: false,
      error: err,
      userFriendlyMessage: "Failed to send email due to a system error.",
    };
  }
}
