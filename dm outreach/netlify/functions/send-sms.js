// PLUGDISTRICT — Netlify Function: send-sms
// Receives quote request from catalog form, sends 2 SMS via Twilio:
//   1. Auto-confirmation to the customer
//   2. Order notification to Aiden's phone
//
// REQUIRED ENVIRONMENT VARIABLES (set in Netlify Site Settings → Environment):
//   TWILIO_ACCOUNT_SID    — your Twilio account SID
//   TWILIO_AUTH_TOKEN     — your Twilio auth token
//   TWILIO_PHONE_NUMBER   — your Twilio number in E.164 format (e.g., +15551234567)
//   AIDEN_PHONE_NUMBER    — your personal phone in E.164 format (e.g., +15551234567)

const twilio = require("twilio");

exports.handler = async (event) => {
  // CORS headers — allow browser to call this function from any origin
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { phone, list, source } = body;

    // ---- Validation ----
    if (!phone || !list) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "phone and list are required" })
      };
    }

    if (String(list).length < 3) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "list is too short" })
      };
    }

    // ---- Read Twilio config from environment ----
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const aidenNumber = process.env.AIDEN_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio env vars");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "SMS service not configured" })
      };
    }

    const client = twilio(accountSid, authToken);

    // ---- Normalize customer phone to E.164 (assumes US if no country code) ----
    const cleanPhone = String(phone).replace(/\D/g, "");
    let toPhone;
    if (cleanPhone.length === 10) {
      toPhone = `+1${cleanPhone}`;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) {
      toPhone = `+${cleanPhone}`;
    } else if (cleanPhone.length >= 10) {
      toPhone = `+${cleanPhone}`;
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "invalid phone number" })
      };
    }

    // ---- Compose messages ----
    const customerMsg =
      `hey whats up! got ur list:\n\n` +
      `${list}\n\n` +
      `lemme review and personally add this up to give u the best rates i can!! give me a sec to do this 🔥\n\n` +
      `— plugdistrict`;

    const aidenMsg =
      `🔥 NEW ORDER REQUEST — plugdistrict.com\n\n` +
      `from: ${phone}\n\n` +
      `${list}\n\n` +
      `text or facetime them asap w/ rates 🙏`;

    // ---- Send the customer's auto-confirmation ----
    await client.messages.create({
      body: customerMsg,
      from: fromNumber,
      to: toPhone
    });

    // ---- Send Aiden the order notification (if his number is configured) ----
    if (aidenNumber) {
      try {
        await client.messages.create({
          body: aidenMsg,
          from: fromNumber,
          to: aidenNumber
        });
      } catch (notifyErr) {
        // Don't fail the whole request if just the owner notify fails
        console.error("Failed to notify Aiden:", notifyErr.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "SMS sent successfully",
        to: toPhone
      })
    };

  } catch (error) {
    console.error("send-sms error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || "Failed to send SMS"
      })
    };
  }
};
