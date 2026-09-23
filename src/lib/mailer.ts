import { Resend } from "resend";
import crypto from "crypto";
import "./env.js";

const getResendInstance = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === "undefined") {
    return null;
  }
  return new Resend(apiKey.trim());
};

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

export function buildMasterEmailHtml(options: {
  subject: string;
  title: string;
  greeting?: string;
  bodyHtml: string;
  securityNote?: string;
}): string {
  const { title, greeting, bodyHtml, securityNote } = options;
  const appBase = process.env.VITE_APP_URL || "https://getzakir.com";
  const lightLogoUrl = `${appBase}/api/email-logo/light.svg`;
  const darkLogoUrl = `${appBase}/api/email-logo/dark.svg`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting" />
  <title>${title}</title>
  <style type="text/css">
    @media (prefers-color-scheme: dark) {
      .email-logo-box {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
      }
      .email-logo-light {
        display: none !important;
        mso-hide: all !important;
      }
      .email-logo-dark {
        display: block !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header with Official Logo (Clean Background) -->
          <tr>
            <td style="padding: 36px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
              <!-- Logo Container Badge: 80px x 80px Container with Centered Logo -->
              <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto 16px auto;">
                <tr>
                  <td align="center" class="email-logo-box" style="width: 80px; height: 80px; background-color: #1C2C58; border-radius: 20px; text-align: center; vertical-align: middle; padding: 0; box-shadow: 0 4px 14px rgba(28, 44, 88, 0.18);">
                    <a href="${appBase}" target="_blank" style="text-decoration: none; display: block; width: 80px; height: 80px;">
                      <img src="${lightLogoUrl}" alt="Zakir" width="48" height="48" class="email-logo-light" style="display: block; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none; margin: 16px auto;" />
                      <!--[if !mso]><!-->
                      <img src="${darkLogoUrl}" alt="Zakir" width="48" height="48" class="email-logo-dark" style="display: none; width: 48px; height: 48px; border: 0; outline: none; text-decoration: none; margin: 16px auto;" />
                      <!--<![endif]-->
                    </a>
                  </td>
                </tr>
              </table>
              <span style="color: #0f172a; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; display: block;">ZAKIR</span>
              <span style="color: #2563eb; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-top: 4px;">Decision Intelligence</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="color: #0f172a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">${title}</h1>
              ${greeting ? `<p style="color: #475569; font-size: 14px; margin: 0 0 20px 0;">${greeting}</p>` : ""}
              ${bodyHtml}
              ${securityNote ? `
              <div style="margin-top: 24px; padding: 14px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 6px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;"><strong>Security Notice:</strong> ${securityNote}</p>
              </div>` : ""}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.5;">
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

    const emailPayload: any = {
      from: fromSender,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined,
    };

    if (userAttachments.length > 0) {
      emailPayload.attachments = userAttachments;
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
