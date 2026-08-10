const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseServices.ts', 'utf8');

const functionsToFix = [
  'export async function sendVerificationCodeApi',
  'export async function verifyCodeApi',
  'export async function forgotPasswordApi',
  'export async function resetPasswordApi',
  'export async function deleteAccountApi',
  'export async function updateSupportTicketStatusApi'
];

functionsToFix.forEach(func => {
  const regex = new RegExp(`(${func}.*?\\{)(\\n\\s*try \\{)?`, 's');
  code = code.replace(regex, (match, p1, p2) => {
    return p1 + '\n  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";' + (p2 || '');
  });
});

fs.writeFileSync('src/lib/firebaseServices.ts', code);
