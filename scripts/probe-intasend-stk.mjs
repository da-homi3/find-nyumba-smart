/**
 * Probe IntaSend STK collection endpoints and print status + body (no secrets).
 * Usage: node scripts/probe-intasend-stk.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      env[t.slice(0, eq).trim()] = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const key = env.INTASEND_SECRET_KEY;
const mode = (env.INTASEND_ENV || "live").toLowerCase();
const bases =
  mode === "sandbox"
    ? ["https://sandbox.intasend.com/api/v1"]
    : ["https://payment.intasend.com/api/v1", "https://api.intasend.com/api/v1"];

const paths = ["/payment/mpesa-stk-push/", "/payment/collection/"];

const pub =
  env.INTASEND_PUBLISHABLE_KEY || env.INTASEND_PUBLIC_KEY || env.INTASEND_PUBLISHABLE || null;

console.log("ENV", mode, "secret set?", Boolean(key), "publishable set?", Boolean(pub));

for (const base of bases) {
  for (const path of paths) {
    const url = `${base}${path}`;
    const bodies = [
      {
        label: "bearer-amount-phone",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: {
          amount: 10,
          phone_number: "254714725598",
          api_ref: "probe-rent-1",
          mobile_tarrif: "BUSINESS-PAYS",
        },
      },
      {
        label: "bearer-string-amount",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: {
          amount: "10",
          phone_number: "254714725598",
          api_ref: "probe-rent-2",
        },
      },
    ];
    if (pub) {
      bodies.push(
        {
          label: "public_key-collection",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: {
            public_key: pub,
            currency: "KES",
            method: "M-PESA",
            amount: 10,
            phone_number: "254714725598",
            api_ref: "probe-rent-3",
          },
        },
        {
          label: "bearer+public_key",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: {
            public_key: pub,
            currency: "KES",
            method: "M-PESA",
            amount: 10,
            phone_number: "254714725598",
            api_ref: "probe-rent-4",
          },
        },
      );
    }

    for (const attempt of bodies) {
      const res = await fetch(url, {
        method: "POST",
        headers: attempt.headers,
        body: JSON.stringify(attempt.body),
      });
      const text = await res.text();
      console.log("\n===", attempt.label, url, res.status);
      console.log(text.slice(0, 500));
    }
  }
}
