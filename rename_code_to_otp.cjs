const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Rename variable
code = code.replace(/const code = crypto\.randomInt\(100000, 1000000\)\.toString\(\);/g, 'const otpCode = crypto.randomInt(100000, 1000000).toString();');
code = code.replace(/code\.length === 6 \? \`${code\.slice\(0, 3\)} ${code\.slice\(3\)}\` : code;/g, 'const formattedCode = otpCode.length === 6 ? `${otpCode.slice(0, 3)} ${otpCode.slice(3)}` : otpCode;');
// Actually, I already replaced the buildOtpEmailHtml function, so `code` is no longer used inside it.

// Update calls to buildOtpEmailHtml
code = code.replace(/code: code,/g, 'otpCode: otpCode,');
code = code.replace(/code: code/g, 'otpCode: otpCode'); // In case of no comma

// Update userName references
code = code.replace(/name: resolvedUserName,/g, 'userName: resolvedUserName,');

fs.writeFileSync('server.ts', code);
