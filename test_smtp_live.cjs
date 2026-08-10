const nodemailer = require('nodemailer');

async function test() {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10),
    secure: false, // port 587 uses STARTTLS
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Zakir Enterprise" <${process.env.EMAIL_USERNAME}>`,
      to: process.env.EMAIL_USERNAME,
      subject: "Test Zakir SMTP",
      text: "This is a test email from Zakir Causal Analysis.",
      html: "<b>This is a test email from Zakir Causal Analysis.</b>"
    });
    console.log("Success:", info.messageId);
  } catch (err) {
    console.error("Failed:", err);
  }
}

test();
