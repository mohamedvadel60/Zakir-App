import dotenv from 'dotenv';
dotenv.config();

import { sendSystemMail, buildMasterEmailHtml } from '../src/lib/mailer';

async function run() {
  const recipient = 'mohamedvadhil0@gmail.com';
  console.log(`Sending live test email to: ${recipient}...`);

  const appBase = process.env.APP_URL || 'https://www.getzakir.com';

  const html = buildMasterEmailHtml({
    subject: "ZAKIR - رسالة تجريبية لاختبار دقة الشعار الرسمي",
    title: "اختبار دقة الشعار الرسمي في البريد الإلكتروني",
    greeting: "أهلاً بك محمد،",
    baseUrl: appBase,
    bodyHtml: `
      <p style="font-size: 15px; line-height: 1.8; color: #334155; margin: 0 0 16px 0;">
        تم إرسال هذه الرسالة التجريبية للتحقق المباشر من دقة ووضوح شعار <strong>ZAKIR</strong> في صندوق الوارد لديك.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 0 0 20px 0;">
        <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px; font-weight: 700;">مواصفات الشعار المطبق:</h4>
        <ul style="margin: 0; padding-right: 20px; font-size: 14px; color: #475569; line-height: 1.9;">
          <li><strong>المصدر:</strong> ملف <code>logo.txt</code> الأصلي بدون أي تعديل في المسارات أو النسب المتجهية.</li>
          <li><strong>الجودة:</strong> بدقة HiDPI / Retina فائقة (768×768 بكسل) لعرض فائق النقاء والحدة.</li>
          <li><strong>الألوان:</strong> خلفية المربع الكحلي <code>#1C2C58</code> مع الأيقونة البيضاء الناصعة <code>#FFFFFF</code>.</li>
          <li><strong>التوافق:</strong> يدعم كافة برامج البريد الإلكتروني وشاشات الهاتف والكمبيوتر.</li>
        </ul>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #64748b; margin: 0;">
        منصة ذاكر • الذاكرة المؤسسية السببية • Causal Decision Intelligence
      </p>
    `,
    securityNote: "هذه رسالة اختبارية مرسلة من بيئة الإنتاج للتحقق الفعلي من وضوح الشعار.",
  });

  const result = await sendSystemMail({
    to: recipient,
    subject: "ZAKIR • رسالة تجريبية للتحقق من وضوح الشعار",
    html: html,
    text: "ZAKIR Live Brand Verification Email - High Definition Retina Logo Test",
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

run().catch(console.error);
