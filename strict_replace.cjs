const fs = require('fs');

let serverTs = fs.readFileSync('server.ts', 'utf8');

const startStr = "async function sendSystemMail(";
const endStr = "// SHA-256 verification code hashing helper";

const startIndex = serverTs.indexOf(startStr);
const endIndex = serverTs.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `async function sendSystemMail(
  toOrOptions: string | { to: string; subject: string; html: string; text?: string },
  subjectArg?: string,
  textArg?: string,
  htmlArg?: string
): Promise<{
  success: boolean;
  messageId?: string;
  error?: any;
}> {
  let to: string;
  let subject: string;
  let html: string;
  let text: string;

  if (typeof toOrOptions === "string") {
    to = toOrOptions;
    subject = subjectArg || "";
    text = textArg || "";
    html = htmlArg || "";
  } else if (toOrOptions && typeof toOrOptions === "object") {
    to = toOrOptions.to;
    subject = toOrOptions.subject;
    html = toOrOptions.html;
    text = toOrOptions.text || "";
  } else {
    to = "";
    subject = "";
    html = "";
    text = "";
  }

  if (!process.env.EMAIL_FROM) {
    console.error("EMAIL_FROM is missing in environment variables.");
    return { success: false, error: "EMAIL_FROM_MISSING" };
  }

  try {
    const resend = getResendInstance();
    console.log(\`[EMAIL DISPATCH ATTEMPT] To: \${to} | Subject: "\${subject}" | Sender: \${process.env.EMAIL_FROM}\`);

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: subject,
      html: html,
      text: text || undefined
    });

    if (response.error) {
      console.error("Verification email failed:", {
        email: to,
        error: response.error,
      });

      return {
        success: false,
        error: "EMAIL_SEND_FAILED"
      };
    }

    console.log(\`[EMAIL SENT SUCCESS] ID: \${response.data?.id} to \${to} via \${process.env.EMAIL_FROM}\`);
    return {
      success: true,
      messageId: response.data?.id
    };

  } catch (resendErr: any) {
    console.error("Exception during email send:", {
      email: to,
      error: resendErr?.message || resendErr
    });
    return { success: false, error: "EMAIL_SEND_FAILED" };
  }
}

`;
  
  serverTs = serverTs.substring(0, startIndex) + replacement + serverTs.substring(endIndex);
  fs.writeFileSync('server.ts', serverTs);
  console.log("Replaced cleanly.");
} else {
  console.log("Could not find boundaries.");
}
