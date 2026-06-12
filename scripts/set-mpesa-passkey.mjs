import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const passkey = process.argv[2];
if (!passkey) {
  console.error("Usage: node scripts/set-mpesa-passkey.mjs <passkey>");
  process.exit(1);
}

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
let text = readFileSync(envPath, "utf8");

const upsert = (key, value) => {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(text)) text = text.replace(re, line);
  else text = text.trimEnd() + `\n${line}\n`;
};

upsert("MPESA_ENV", "sandbox");
upsert("MPESA_SHORTCODE", "174379");
upsert("MPESA_PASSKEY", passkey);

writeFileSync(envPath, text);
console.log("Set MPESA_ENV, MPESA_SHORTCODE, MPESA_PASSKEY in .env");
