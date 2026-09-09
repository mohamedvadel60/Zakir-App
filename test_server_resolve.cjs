// Test script to run resolveStripeKeys on the server side
const dotenv = require("dotenv");
dotenv.config();

// Mimic resolveStripeKeys
function extractAcctId(k) {
  const match = k.match(/^[prs]k_(?:live|test)_(?:51)?([0-9a-zA-Z]+)/);
  return match ? match[1].substring(0, 14) : "";
}

function resolveStripeKeys() {
  const pubCandidates = [];
  const checkPubCandidate = (val, source) => {
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("pk_live_") || trimmed.startsWith("pk_test_")) {
        if (!pubCandidates.some(p => p.key === trimmed)) {
          pubCandidates.push({ key: trimmed, source });
        }
      }
    }
  };

  checkPubCandidate(process.env.VITE_STRIPE_PUBLISHABLE_KEY, "VITE_STRIPE_PUBLISHABLE_KEY");
  checkPubCandidate(process.env.STRIPE_PUBLISHABLE_KEY, "STRIPE_PUBLISHABLE_KEY");
  checkPubCandidate(process.env.VITE_STRIPE_PUBLIC_KEY, "VITE_STRIPE_PUBLIC_KEY");
  checkPubCandidate(process.env.STRIPE_PUBLIC_KEY, "STRIPE_PUBLIC_KEY");

  const secretCandidates = [];
  const addSecretCandidate = (val, source) => {
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed.startsWith("sk_live_") ||
        trimmed.startsWith("sk_test_") ||
        trimmed.startsWith("rk_live_") ||
        trimmed.startsWith("rk_test_")
      ) {
        if (!secretCandidates.some(c => c.key === trimmed)) {
          secretCandidates.push({ key: trimmed, source });
        }
      }
    }
  };

  addSecretCandidate(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  addSecretCandidate(process.env.STRIPE_LIVE_SECRET_KEY, "STRIPE_LIVE_SECRET_KEY");
  addSecretCandidate(process.env.STRIPE_TEST_SECRET_KEY, "STRIPE_TEST_SECRET_KEY");
  addSecretCandidate(process.env.VITE_STRIPE_PUBLIC_KEY, "VITE_STRIPE_PUBLIC_KEY");
  addSecretCandidate(process.env.STRIPE_MONTHLY_PRICE_ID, "STRIPE_MONTHLY_PRICE_ID");
  addSecretCandidate(process.env.STRIPE_YEARLY_PRICE_ID, "STRIPE_YEARLY_PRICE_ID");

  const primaryPub = pubCandidates[0]?.key || null;
  const pubIsLive = primaryPub ? primaryPub.startsWith("pk_live_") : false;
  const pubIsTest = primaryPub ? primaryPub.startsWith("pk_test_") : false;

  const pubAcct = primaryPub ? extractAcctId(primaryPub) : "";

  let selectedKey = null;
  let selectedSource = "none";

  if (pubAcct) {
    const matched = secretCandidates.find(c => {
      const cAcct = extractAcctId(c.key);
      const cIsLive = c.key.startsWith("sk_live_") || c.key.startsWith("rk_live_");
      return cAcct === pubAcct && (pubIsLive ? cIsLive : !cIsLive);
    });
    if (matched) {
      selectedKey = matched.key;
      selectedSource = matched.source;
    }
  }

  if (!selectedKey && secretCandidates.length > 0) {
    if (pubIsLive) {
      const liveCand = secretCandidates.find(c => c.key.startsWith("sk_live_") || c.key.startsWith("rk_live_"));
      if (liveCand) {
        selectedKey = liveCand.key;
        selectedSource = liveCand.source;
      }
    } else if (pubIsTest) {
      const testCand = secretCandidates.find(c => c.key.startsWith("sk_test_") || c.key.startsWith("rk_test_"));
      if (testCand) {
        selectedKey = testCand.key;
        selectedSource = testCand.source;
      }
    }
  }

  if (!selectedKey) {
    const primary = secretCandidates.find(c => c.source === "STRIPE_SECRET_KEY");
    if (primary) {
      selectedKey = primary.key;
      selectedSource = primary.source;
    } else if (secretCandidates.length > 0) {
      selectedKey = secretCandidates[0].key;
      selectedSource = secretCandidates[0].source;
    }
  }

  let finalPub = primaryPub;
  if (selectedKey) {
    const selIsLive = selectedKey.startsWith("sk_live_") || selectedKey.startsWith("rk_live_");
    const selAcct = extractAcctId(selectedKey);
    const matchedPub = pubCandidates.find(p => {
      const pIsLive = p.key.startsWith("pk_live_");
      const pAcct = extractAcctId(p.key);
      return (pIsLive === selIsLive) && (!selAcct || !pAcct || pAcct === selAcct);
    }) || pubCandidates.find(p => {
      const pIsLive = p.key.startsWith("pk_live_");
      return pIsLive === selIsLive;
    });
    if (matchedPub) {
      finalPub = matchedPub.key;
    }
  }

  const isLiveMode = Boolean(
    (selectedKey && (selectedKey.startsWith("sk_live_") || selectedKey.startsWith("rk_live_"))) ||
    (!selectedKey && pubIsLive)
  );

  return {
    secretKey: selectedKey ? `${selectedKey.substring(0, 8)}...` : null,
    publishableKey: finalPub ? `${finalPub.substring(0, 8)}...` : null,
    mode: isLiveMode ? "live" : "test",
    accountId: selectedKey ? extractAcctId(selectedKey) : undefined,
    source: selectedSource
  };
}

console.log("Resolved Keys:", resolveStripeKeys());
