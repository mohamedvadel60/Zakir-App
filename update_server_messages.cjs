const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldCode = `app.post("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { senderId, senderType, senderName, senderEmail, message, attachments = [] } = req.body;`;

const newCode = `app.post("/api/support/tickets/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid) return res.status(401).json({ error: "Unauthorized" });
    
    const isCallerAdmin = callerUid === "usr_ceo" || callerEmail.toLowerCase() === "mohamedvadel60@gmail.com";
    
    const { id } = req.params;
    let { senderId, senderType, senderName, senderEmail, message, attachments = [] } = req.body;
    
    if (!isCallerAdmin) {
       senderId = callerUid;
       senderEmail = callerEmail;
       senderType = "user";
    }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('server.ts', code);
