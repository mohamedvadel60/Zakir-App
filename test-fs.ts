import { adminDb } from "./src/lib/firebase-admin.js";

async function run() {
  const users = await adminDb.collection("users").limit(5).get();
  console.log("Found users:", users.docs.map(d => d.id));
}
run().catch(console.error);
