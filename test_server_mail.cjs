const nodemailer = require('nodemailer');

async function sendSystemMail(to, subject, text, html) {
  const smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const smtpPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const smtpUser = process.env.EMAIL_USERNAME || process.env.SMTP_USER;
  const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
  const smtpFrom = process.env.EMAIL_FROM || process.env.SMTP_FROM || smtpUser || "no-reply@zakir-causal.com";

  const resendApiKey = process.env.RESEND_API_KEY;
  let resendFrom = process.env.RESEND_FROM || "Zakir <onboarding@resend.dev>";
  if (!process.env.RESEND_FROM && process.env.EMAIL_FROM) {
    resendFrom = process.env.EMAIL_FROM;
  }
  let finalResendFrom = resendFrom;
  if (!finalResendFrom.includes("<") && !finalResendFrom.includes(">")) {
    finalResendFrom = `Zakir <${resendFrom}>`;
  }

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const info = await transporter.sendMail({ from: `"Zakir Enterprise" <${smtpFrom}>`, to, subject, text, html });
      return { success: true, messageId: info.messageId, provider: "smtp" };
    } catch (err) {
      console.error("SMTP error:", err.message);
      if (!resendApiKey) {
        return { success: false, provider: "smtp", userFriendlyMessage: "Failed to send email via SMTP." };
      }
      console.log("Fallback to Resend...");
    }
  }

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: finalResendFrom,
        to: [to],
        subject: subject,
        text: text,
        html: html
      })
    });
    const data = await response.json();
    console.log("Resend response status:", response.status, data);
    if (response.ok && data.id) {
      return { success: true, messageId: data.id, provider: "resend" };
    }
    return { success: false, provider: "resend", userFriendlyMessage: data.message || "Resend error" };
  }

  return { success: false, provider: "none", userFriendlyMessage: "No email provider configured" };
}

sendSystemMail("mohamedvadel60@gmail.com", "Test Subject", "Test Text", "<p>Test</p>").then(console.log);
