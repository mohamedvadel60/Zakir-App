const fs = require('fs');
let serverTs = fs.readFileSync('server.ts', 'utf8');

const webhookCode = `
// STRIPE WEBHOOK ROUTE (Raw body parser before express.json)
`;

const resendWebhookCode = `
// RESEND WEBHOOK ROUTE (Raw body parser or JSON)
app.post("/api/webhooks/resend", express.json(), (req, res) => {
  try {
    const event = req.body;
    if (!event) {
      return res.status(400).send("No body");
    }

    console.log("[RESEND WEBHOOK] Received event:", {
      type: event.type,
      messageId: event.data?.email_id || event.data?.id,
      recipient: event.data?.to?.[0] || event.data?.to,
      timestamp: event.created_at || new Date().toISOString()
    });

    if (event.type === "email.bounced" || event.type === "email.delivery_delayed" || event.type === "email.complained") {
       console.warn("[RESEND EMAIL FAILURE] Delivery failed:", {
         messageId: event.data?.email_id,
         reason: event.data?.reason,
         recipient: event.data?.to?.[0]
       });
    } else if (event.type === "email.delivered") {
       console.log("[RESEND EMAIL DELIVERED] Delivery success:", {
         messageId: event.data?.email_id,
         recipient: event.data?.to?.[0]
       });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[RESEND WEBHOOK] Error processing event:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

`;

serverTs = serverTs.replace(webhookCode, resendWebhookCode + webhookCode);

fs.writeFileSync('server.ts', serverTs);
console.log('Added Resend webhook');
