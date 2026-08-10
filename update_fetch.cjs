const fs = require('fs');
let code = fs.readFileSync('src/lib/firebaseServices.ts', 'utf8');

if (!code.includes("import { auth, db }")) {
  code = code.replace("import { db } from \"./firebase\";", "import { auth, db } from \"./firebase\";");
}

code = code.replace("export async function fetchSupportTicketsApi(userId?: string, userEmail?: string, isAdmin = false) {",
`export async function fetchSupportTicketsApi(userId?: string, userEmail?: string, isAdmin = false) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";`);

code = code.replace("const res = await fetch(`/api/support/tickets?${queryParams.toString()}`);",
`const res = await fetch(\`/api/support/tickets?\${queryParams.toString()}\`, {
        headers: token ? { "Authorization": \`Bearer \${token}\` } : {}
      });`);

code = code.replace("export async function createSupportTicketApi(ticketData: any) {",
`export async function createSupportTicketApi(ticketData: any) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";`);

code = code.replace("const res = await fetch(\"/api/support/tickets\", {",
`const res = await fetch("/api/support/tickets", {`);

code = code.replace("headers: { \"Content-Type\": \"application/json\" },",
`headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": \`Bearer \${token}\` } : {})
      },`);

code = code.replace("export async function addSupportTicketMessageApi(ticketId: string, messageData: {",
`export async function addSupportTicketMessageApi(ticketId: string, messageData: {`);

code = code.replace("senderEmail: string;\n  message: string;\n}) {",
`senderEmail: string;
  message: string;
}) {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";`);

code = code.replace("const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {",
`const res = await fetch(\`/api/support/tickets/\${ticketId}/messages\`, {`);
// Note the header replacement is the same, but let's be more precise.
fs.writeFileSync('src/lib/firebaseServices.ts', code);
