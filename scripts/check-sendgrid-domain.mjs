#!/usr/bin/env node
/**
 * Verify SendGrid domain authentication status for nyumbasearch.com.
 * Reads SENDGRID_API_KEY from .env — does not print the key.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DOMAIN = "nyumbasearch.com";
const envPath = join(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error("Missing .env");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const apiKey = env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error("Missing SENDGRID_API_KEY in .env");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

const list = await fetch("https://api.sendgrid.com/v3/whitelabel/domains", { headers });
const domains = await list.json();
if (!list.ok) {
  console.error("SendGrid list failed:", domains);
  process.exit(1);
}

const match = domains.find((d) => d.domain === DOMAIN);
if (!match) {
  console.log(`No SendGrid domain auth found for ${DOMAIN}`);
  console.log("Registered domains:", domains.map((d) => d.domain).join(", ") || "(none)");
  process.exit(0);
}

console.log(`Domain: ${match.domain} (id ${match.id})`);
console.log(`Valid: ${match.valid}`);
console.log(`DNS records needed:`);
for (const [key, rec] of Object.entries(match.dns ?? {})) {
  console.log(`  ${key}: ${rec.type} ${rec.host} → ${rec.data} (valid: ${rec.valid})`);
}

const validate = await fetch(`https://api.sendgrid.com/v3/whitelabel/domains/${match.id}/validate`, {
  method: "POST",
  headers,
});
const validation = await validate.json();
console.log("\nValidation:", validation.valid ? "PASSED" : "FAILED");
if (!validation.valid && validation.validation_results) {
  for (const [k, v] of Object.entries(validation.validation_results)) {
    if (!v.valid) console.log(`  ✗ ${k}: ${v.reason ?? "not valid"}`);
  }
}
