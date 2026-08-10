const fs = require('fs');

// Fix server.ts boolean comparison
let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(/if \(isAdmin === "true"\)/g, 'if (isAdmin)');
serverCode = serverCode.replace(/if \(isAdmin !== "true"\)/g, 'if (!isAdmin)');
serverCode = serverCode.replace(/if \(isAdmin === "true"\)/g, 'if (isAdmin)');
fs.writeFileSync('server.ts', serverCode);

// Fix firebaseServices.ts
let fbCode = fs.readFileSync('src/lib/firebaseServices.ts', 'utf8');

// Remove wrongly injected const token lines
fbCode = fbCode.replace(/const token = auth\.currentUser \? await auth\.currentUser\.getIdToken\(\) : "";\n\s*status\?: string;/g, 'status?: string;');
fbCode = fbCode.replace(/const token = auth\.currentUser \? await auth\.currentUser\.getIdToken\(\) : "";\n\s*senderType\?: "user" \| "admin";/g, 'senderType?: "user" | "admin";');
// Actually, it's easier to manually fix the ones I broke.
// Looking at lines 1658-1663 of firebaseServices.ts:
// export async function updateSupportTicketStatusApi(ticketId: string, updateData: {
//   const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";
//   status?: string;
//   priority?: string;
//   adminNotes?: string;
// }) {

fbCode = fbCode.replace(/export async function updateSupportTicketStatusApi\(ticketId: string, updateData: \{\n\s*const token = auth\.currentUser \? await auth\.currentUser\.getIdToken\(\) : "";\n\s*status\?: string;/, 'export async function updateSupportTicketStatusApi(ticketId: string, updateData: {\n  status?: string;');

// Now put the const token inside the function.
fbCode = fbCode.replace(/export async function updateSupportTicketStatusApi\(ticketId: string, updateData: \{\n\s*status\?: string;\n\s*priority\?: string;\n\s*adminNotes\?: string;\n\}\) \{/g, 'export async function updateSupportTicketStatusApi(ticketId: string, updateData: {\n  status?: string;\n  priority?: string;\n  adminNotes?: string;\n}) {\n  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";');

fs.writeFileSync('src/lib/firebaseServices.ts', fbCode);
