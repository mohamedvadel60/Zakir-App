import fs from "fs";
import { Resend } from "resend";
import { buildMasterEmailHtml, sendSystemMail } from "../src/lib/mailer.js";

async function main() {
  const subject = "ZAKIR Brand Logo & Email System Verification";
  const title = "منظومة الهوية البصرية الرسمية • ZAKIR Email Branding";
  const greeting = "مرحباً بك،";

  const bodyHtml = `
    <p style="font-size: 15px; line-height: 1.8; color: #334155; margin: 0 0 16px 0;">
      تم اعتماد الهوية البصرية الرسمية لشعار <strong>ذاكر (ZAKIR)</strong> في كافة قوالب البريد الإلكتروني للنظام وفقاً للمواصفات القياسية المعتمدة:
    </p>

    <!-- Specs Summary Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 14px 0; color: #0f172a; font-size: 15px; font-weight: 700;">المواصفات القياسية المطبقة:</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #334155; line-height: 1.8;">
        <tr>
          <td style="padding: 6px 0; width: 35%; font-weight: 700; color: #1c2c58;">الوضع الفاتح (Light Mode):</td>
          <td style="padding: 6px 0;">مربع كحلي رسمي (#1C2C58) + شعار ذاكر باللون الأبيض الناصع (#FFFFFF).</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #1c2c58;">الوضع الداكن (Dark Mode):</td>
          <td style="padding: 6px 0;">مربع أبيض (#FFFFFF) + شعار ذاكر باللون الكحلي الرسمي (#1C2C58).</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #1c2c58;">أبعاد الحاوية:</td>
          <td style="padding: 6px 0;">نسبة مربعة دقيقة 1:1 (96px &times; 96px) مع زوايا ناعمة (18px radius).</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 700; color: #1c2c58;">التوافقية:</td>
          <td style="padding: 6px 0;">جاهزية كاملة لـ Gmail, Apple Mail, Outlook (Desktop &amp; Web), Yahoo, iOS, Android.</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0;">
      Zakir Intelligence Platform &bull; الذاكرة المؤسسية السببية وذكاء اتخاذ القرار
    </p>
  `;

  const emailHtml = buildMasterEmailHtml({
    subject,
    title,
    greeting,
    bodyHtml,
    securityNote: "هذا بريد تأكيد رسمي صادر من خوادم منصة ZAKIR للتحقق من تكامل الهوية البصرية.",
  });

  console.log("Email HTML generated successfully. Length:", emailHtml.length);

  // Send via system mailer
  const result = await sendSystemMail({
    to: "mohamedvadhil0@gmail.com",
    subject,
    html: emailHtml,
    text: "ZAKIR Brand Logo & Email System Verification - Light Mode: Navy square + White logo. Dark Mode: White square + Navy logo.",
  });

  console.log("SYSTEM MAIL RESULT:", result);
}

main().catch(console.error);
