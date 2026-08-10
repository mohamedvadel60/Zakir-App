require('dotenv').config();
const nodemailer = require('nodemailer');

// We can test fetching or calling sendSystemMail logic
async function test() {
  const resendApiKey = process.env.RESEND_API_KEY;
  let resendFrom = process.env.RESEND_FROM || "Zakir <onboarding@resend.dev>";
  let finalResendFrom = resendFrom;
  if (!finalResendFrom.includes("<") && !finalResendFrom.includes(">")) {
    finalResendFrom = `Zakir <${resendFrom}>`;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: finalResendFrom,
      to: ["mohamedvadel60@gmail.com"],
      subject: "Verify your Zakir account",
      text: "Test verification code: 123456",
      html: "<p>Test verification code: 123456</p>"
    })
  });

  const statusCode = response.status;
  const data = await response.json().catch(() => ({}));
  console.log("Status:", statusCode, "Data:", data);
}

test();
