import { chromium } from "@playwright/test";

const url = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];

page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForTimeout(3000);

const snapshot = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const zeroOpacity = [...document.querySelectorAll("*")].filter(
    (el) => getComputedStyle(el).opacity === "0",
  ).length;
  return {
    title: document.title,
    bodyText: (document.body?.innerText ?? "").slice(0, 800),
    bodyTextLen: document.body?.innerText?.length ?? 0,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1: h1?.innerText ?? null,
    h1Opacity: h1 ? getComputedStyle(h1).opacity : null,
    zeroOpacityCount: zeroOpacity,
    childCount: document.body?.children?.length ?? 0,
  };
});

console.log(JSON.stringify({ url, errors, snapshot }, null, 2));
await browser.close();
process.exit(snapshot.bodyTextLen < 50 && errors.length > 0 ? 1 : 0);
