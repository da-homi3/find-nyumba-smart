#!/usr/bin/env node
/**
 * Verify M-Pesa Daraja OAuth + optional STK push against credentials in .env
 * Usage: node scripts/test-mpesa.mjs [--stk 2547XXXXXXXX]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadEnv() {
  if (!existsSync(envPath)) throw new Error("Missing .env");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const required = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error("Missing:", missing.join(", "));
  process.exit(1);
}

const mpesaEnv = env.MPESA_ENV ?? "sandbox";
const base =
  mpesaEnv === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

console.log(`M-Pesa env: ${mpesaEnv} (${base})`);
console.log(`Shortcode: ${env.MPESA_SHORTCODE}`);

const auth = Buffer.from(`${env.MPESA_CONSUMER_KEY}:${env.MPESA_CONSUMER_SECRET}`).toString(
  "base64",
);
const oauthRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
  headers: { Authorization: `Basic ${auth}` },
});
const oauthJson = await oauthRes.json();
if (!oauthRes.ok || !oauthJson.access_token) {
  console.error("OAuth failed:", oauthRes.status, oauthJson);
  process.exit(1);
}
console.log("✓ OAuth token obtained");

const stkPhone = process.argv.includes("--stk")
  ? process.argv[process.argv.indexOf("--stk") + 1]
  : null;
if (!stkPhone) {
  console.log("Add --stk 2547XXXXXXXX to test an STK push (will charge the phone).");
  process.exit(0);
}

const timestamp = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 14);
const password = Buffer.from(`${env.MPESA_SHORTCODE}${env.MPESA_PASSKEY}${timestamp}`).toString(
  "base64",
);
const callback = env.MPESA_CALLBACK_URL ?? "https://nyumbasearch.com/api/mpesa/callback";

const stkRes = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${oauthJson.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    BusinessShortCode: env.MPESA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: 1,
    PartyA: stkPhone,
    PartyB: env.MPESA_SHORTCODE,
    PhoneNumber: stkPhone,
    CallBackURL: callback,
    AccountReference: "NS-TEST",
    TransactionDesc: "NyumbaTest",
  }),
});

const stkJson = await stkRes.json();
console.log("STK response:", stkRes.status, stkJson);
if (!stkRes.ok || !stkJson.CheckoutRequestID) process.exit(1);
console.log("✓ STK push sent — check phone for M-Pesa prompt");
