const http = require('http');

const data = JSON.stringify({ email: 'mohamedvadel60@gmail.com', type: 'account_registration' });
const req = http.request('http://localhost:3000/api/auth/send-verification-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Body:", b);
  });
});
req.write(data);
req.end();
