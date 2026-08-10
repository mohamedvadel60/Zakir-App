const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const getTicketsOld = `app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, userEmail, isAdmin } = req.query;`;
const getTicketsNew = `app.get("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid) return res.status(401).json({ error: "Unauthorized" });
    
    // Check if caller is admin
    const isCallerAdmin = callerUid === "usr_ceo" || callerEmail.toLowerCase() === "mohamedvadel60@gmail.com";
    
    const isAdmin = isCallerAdmin && req.query.isAdmin === "true";
    const userId = isAdmin ? req.query.userId : callerUid;
    const userEmail = isAdmin ? req.query.userEmail : callerEmail;`;
code = code.replace(getTicketsOld, getTicketsNew);

const postTicketsOld = `app.post("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { userId, userEmail, userName, userPhone, companyName, category, subject, message, description, priority = "Normal", attachments = [] } = req.body;`;
const postTicketsNew = `app.post("/api/support/tickets", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerUid = req.user?.uid;
    const callerEmail = req.user?.email || "";
    if (!callerUid) return res.status(401).json({ error: "Unauthorized" });
    
    let { userId, userEmail, userName, userPhone, companyName, category, subject, message, description, priority = "Normal", attachments = [] } = req.body;
    
    // Force the caller's identity
    userId = callerUid;
    userEmail = callerEmail;`;
code = code.replace(postTicketsOld, postTicketsNew);

fs.writeFileSync('server.ts', code);
