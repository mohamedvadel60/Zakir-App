import "../src/lib/env.js";
import { authenticatedFetch } from "../src/lib/apiUtils.js";

async function testBackendSecurity() {
  console.log("=================================================================");
  console.log("TESTING BACKEND SENSITIVE ENDPOINTS & ACCESS PROTECTION");
  console.log("=================================================================");

  const baseUrl = "http://localhost:3000";

  const endpoints = [
    { path: "/api/memories", method: "GET", name: "Memories API" },
    { path: "/api/smart-evolution", method: "POST", body: { topic: "test" }, name: "Smart Evolution API" },
    { path: "/api/market-intelligence", method: "POST", body: { topic: "test" }, name: "Market Intelligence API" },
    { path: "/api/database/schema", method: "POST", name: "Database Schema API" },
    { path: "/api/admin/pending-approvals", method: "GET", name: "Admin Pending Approvals API" }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      console.log(`Endpoint [${ep.name}] ${ep.method} ${ep.path}: HTTP ${res.status} (Protected from unauthenticated access: ${res.status === 401 || res.status === 403 ? "YES (PASS)" : "NO (WARN)"})`);
    } catch (err: any) {
      console.log(`Endpoint [${ep.name}] connection test: ${err.message}`);
    }
  }

  console.log("=================================================================");
}

testBackendSecurity().catch(console.error);
