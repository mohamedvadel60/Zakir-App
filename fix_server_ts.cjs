const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Update BuildOtpEmailOptions
code = code.replace(
  'export interface BuildOtpEmailOptions {\n  email: string;\n  name?: string;\n  code: string;\n  type?: "account_registration" | "password_reset" | "email_verification" | string;\n}',
  'export interface BuildOtpEmailOptions {\n  email: string;\n  userName?: string;\n  otpCode: string;\n  type?: "account_registration" | "password_reset" | "email_verification" | string;\n}'
);

// 2. Update buildOtpEmailHtml signature
code = code.replace(
  'function buildOtpEmailHtml(options: BuildOtpEmailOptions): { subject: string; text: string; html: string } {',
  'function buildOtpEmailHtml(options: BuildOtpEmailOptions): { subject: string; text: string; html: string } {\n  const { email, userName, otpCode, type = "account_registration" } = options;'
);
// Need to remove the old line that was doing destructuring which I might have left or added.
// Wait, I already did that in the update_email_template.cjs. Let me check the file first to be sure.

fs.writeFileSync('server.ts', code);
