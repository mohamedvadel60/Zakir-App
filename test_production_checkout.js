// Test production checkout script using a real Firebase ID Token
import { adminAuth } from "./src/lib/firebase-admin.js";
import fs from "fs";

// Load Firebase config
const fbConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
const apiKey = fbConfig.apiKey;

async function getAuthToken() {
  const testUid = "test_checkout_diagnostics_user_" + Math.random().toString(36).substring(7);
  console.log(`Creating custom token for temporary user: ${testUid}`);
  
  // Create or get user
  try {
    await adminAuth.createUser({
      uid: testUid,
      email: `${testUid}@example.com`,
    });
  } catch (err) {
    // If user exists, ignore
  }

  const customToken = await adminAuth.createCustomToken(testUid);
  
  // Exchange custom token for an ID token
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  const response = await fetch(exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to exchange custom token: ${JSON.stringify(data)}`);
  }

  // Clean up user in background
  adminAuth.deleteUser(testUid).catch(() => {});

  return data.idToken;
}

async function run() {
  try {
    const idToken = await getAuthToken();
    console.log("Acquired real Firebase ID token successfully.");

    const prodUrl = "https://www.getzakir.com/api/stripe/create-checkout-session";
    const combinations = [
      { plan: "Starter", billingCycle: "monthly" },
      { plan: "Starter", billingCycle: "annual" },
      { plan: "Professional", billingCycle: "monthly" },
      { plan: "Professional", billingCycle: "annual" },
      { plan: "Enterprise", billingCycle: "monthly" },
      { plan: "Enterprise", billingCycle: "annual" },
    ];

    for (const combo of combinations) {
      console.log(`\nTesting: ${combo.plan} - ${combo.billingCycle}`);
      const res = await fetch(prodUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          plan: combo.plan,
          billingCycle: combo.billingCycle,
          companyName: "Diagnostics Test Ltd"
        }),
      });

      console.log(`Response Status: ${res.status} ${res.statusText}`);
      const bodyText = await res.text();
      try {
        const data = JSON.parse(bodyText);
        if (data.success) {
          console.log(`SUCCESS: Session ID starts with ${data.sessionId?.substring(0, 15)}`);
        } else {
          console.log(`FAILED:`, data);
        }
      } catch {
        console.log("Response body was not JSON. HTML prefix:", bodyText.substring(0, 100));
      }
    }
  } catch (error) {
    console.error("Diagnostic error:", error);
  }
}

run();
