const nodemailer = require('nodemailer');

async function sendSystemMail(to, subject, text, html) {
  const smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST;
  const smtpPort = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const smtpUser = process.env.EMAIL_USERNAME || process.env.SMTP_USER;
  const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
  const resendApiKey = process.env.RESEND_API_KEY;

  console.log("Config:", { smtpHost, smtpPort, smtpUser, hasPass: !!smtpPass, hasResend: !!resendApiKey });

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const info = await transporter.sendMail({ from: smtpUser, to, subject, text, html });
      return { success: true, messageId: info.messageId, provider: "smtp" };
    } catch (err) {
      console.error("SMTP failed:", err.message);
      if (!resendApiKey) {
        return { success: false, provider: "smtp", error: err.message };
      }
      console.log("Falling back to Resend...");
    }
  }

  if (resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Zakir <Zakir@resend.dev>",
        to: [to],
        subject,
        text,
        html
      })
    });
    const data = await res.json();
    if (res.ok && data.id) {
      return { success: true, messageId: data.id, provider: "resend" };
    }
    return { success: false, provider: "resend", error: data };
  }

  return { success: false, provider: "none" };
}

sendSystemMail("mohamedvadel60@gmail.com", "Test Subject", "Test Text", "<p>Test</p>").then(console.log);
