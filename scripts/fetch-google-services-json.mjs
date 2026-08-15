/**
 * Download google-services.json for ke.co.nyumbasearch.app using FCM service account.
 * Usage: node scripts/fetch-google-services-json.mjs
 */
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const outPath = join(root, "..", "flutter_app", "android", "app", "google-services.json");
const PACKAGE = "ke.co.nyumbasearch.app";

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = v;
  }
  return env;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function normalizePrivateKey(privateKeyPem) {
  if (!privateKeyPem.includes(String.raw`\n`)) return privateKeyPem;
  return privateKeyPem.replaceAll(String.raw`\n`, "\n");
}

async function getAccessToken(clientEmail, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: clientEmail,
      scope:
        "https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = normalizePrivateKey(privateKeyPem);
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const sig = sign.sign(key).toString("base64url");
  const assertion = `${unsigned}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Token exchange failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function api(token, path, { method = "GET", body } = {}) {
  const res = await fetch(`https://firebase.googleapis.com/v1beta1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return json;
}

function operationPathFromName(name) {
  if (name.startsWith("operations/")) return name;
  const idx = name.indexOf("operations/");
  if (idx >= 0) return name.slice(idx);
  return `operations/${name}`;
}

async function waitForOperation(token, created) {
  if (!created.name || (!created.name.includes("/operations/") && created.done !== false)) {
    return created;
  }

  const opName = operationPathFromName(created.name);
  console.log(`Waiting for operation ${opName}…`);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const op = await api(token, `/${opName.replace(/^\//, "")}`);
    if (!op.done) continue;
    if (op.error) throw new Error(`Create failed: ${JSON.stringify(op.error)}`);
    return op.response ?? op;
  }
  return created;
}

async function resolveAndroidApp(token, projectId) {
  const listed = await api(token, `/projects/${projectId}/androidApps`);
  let apps = listed.apps ?? [];
  let app = apps.find((a) => a.packageName === PACKAGE);
  if (app) return app;

  console.log("Android app not found — creating…");
  const created = await api(token, `/projects/${projectId}/androidApps`, {
    method: "POST",
    body: {
      packageName: PACKAGE,
      displayName: "NyumbaSearch",
    },
  });
  app = await waitForOperation(token, created);

  if (!app?.name || app.name.includes("/operations/")) {
    const again = await api(token, `/projects/${projectId}/androidApps`);
    apps = again.apps ?? [];
    app = apps.find((a) => a.packageName === PACKAGE);
  }
  return app;
}

function loadFcmEnv() {
  if (!existsSync(envPath)) throw new Error(`Missing ${envPath}`);
  const env = parseEnv(readFileSync(envPath, "utf8"));
  const projectId = env.FCM_PROJECT_ID?.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL?.trim();
  const privateKey = env.FCM_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Need FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY in .env");
  }
  return { projectId, clientEmail, privateKey };
}

const { projectId, clientEmail, privateKey } = loadFcmEnv();
console.log(`Project: ${projectId}`);
console.log(`Package: ${PACKAGE}`);

const token = await getAccessToken(clientEmail, privateKey);
const app = await resolveAndroidApp(token, projectId);

if (!app?.name || app.name.includes("/operations/")) {
  throw new Error(
    "Android app still not ready. Create ke.co.nyumbasearch.app in Firebase Console, then re-run.",
  );
}

const appName = app.name; // projects/.../androidApps/...
console.log(`Using app: ${appName}`);

const cfg = await api(token, `/${appName}/config`);
if (!cfg.configFileContents) {
  throw new Error(`Config missing contents: ${JSON.stringify(Object.keys(cfg))}`);
}
const jsonText = Buffer.from(cfg.configFileContents, "base64").toString("utf8");
const parsed = JSON.parse(jsonText);
if (parsed.client?.[0]?.client_info?.android_client_info?.package_name !== PACKAGE) {
  console.warn("Warning: package_name mismatch in downloaded config");
}
writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log("Next: cd flutter_app && flutter pub get && flutter run");
