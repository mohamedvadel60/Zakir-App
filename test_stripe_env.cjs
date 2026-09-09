// Diagnostic script for Stripe keys
const dotenv = require("dotenv");
dotenv.config();

console.log("Checking STRIPE environment variables...");
const keys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_LIVE_SECRET_KEY",
  "STRIPE_TEST_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_PUBLIC_KEY",
  "VITE_STRIPE_PUBLISHABLE_KEY",
  "VITE_STRIPE_PUBLIC_KEY",
  "STRIPE_MONTHLY_PRICE_ID",
  "STRIPE_YEARLY_PRICE_ID",
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_YEARLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
  "STRIPE_PRICE_PROFESSIONAL_YEARLY",
  "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  "STRIPE_PRICE_ENTERPRISE_MONTHLY",
  "STRIPE_PRICE_ENTERPRISE_YEARLY",
  "STRIPE_PRICE_ENTERPRISE_ANNUAL",
];

keys.forEach(key => {
  const val = process.env[key];
  if (val === undefined) {
    console.log(`  - ${key}: NOT SET`);
  } else if (typeof val !== "string") {
    console.log(`  - ${key}: SET BUT NOT A STRING (type: ${typeof val})`);
  } else {
    const trimmed = val.trim();
    if (trimmed.length === 0) {
      console.log(`  - ${key}: SET BUT EMPTY STRING`);
    } else {
      const prefix = trimmed.substring(0, 8);
      const suffix = trimmed.substring(trimmed.length - 4);
      console.log(`  - ${key}: SET (length: ${trimmed.length}, prefix: ${prefix}..., suffix: ...${suffix})`);
    }
  }
});
