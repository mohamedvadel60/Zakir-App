const fs = require('fs');

let env = fs.readFileSync('.env.example', 'utf8');

env = env.replace(
  /# TRANSACTIONAL EMAIL PROVIDER: Set SMTP or Resend credentials for user verification & password resets\./,
  `# TRANSACTIONAL EMAIL PROVIDER: Use Resend ONLY for production OTP verification & password resets.`
);

env = env.replace(
  /EMAIL_FROM=/g,
  `# EMAIL_FROM: Must use a verified custom domain, e.g., "Your App <no-reply@yourdomain.com>"\nEMAIL_FROM="Your App <no-reply@yourdomain.com>"`
);

fs.writeFileSync('.env.example', env);
console.log('Fixed .env.example');
