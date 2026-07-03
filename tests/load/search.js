/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const errorRate = new Rate("errors");
const searchDuration = new Trend("search_duration");
const rateLimited = new Counter("rate_limited");

const BASE_URL = __ENV.BASE_URL || "https://nyumbasearch.com";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 200 },
    { duration: "2m", target: 500 },
    { duration: "1m", target: 1000 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    errors: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
  },
};

const NEIGHBOURHOODS = ["Kilimani", "Westlands", "Karen", "Lavington", "Kasarani"];
const BUDGETS = [15000, 20000, 30000, 50000, 80000];

export default function searchLoadTest() {
  const neighborhood = NEIGHBOURHOODS[Math.floor(Math.random() * NEIGHBOURHOODS.length)];
  const maxRent = BUDGETS[Math.floor(Math.random() * BUDGETS.length)];
  const beds = Math.floor(Math.random() * 4);

  const searchStart = Date.now();
  const searchRes = http.get(
    `${BASE_URL}/api/listings?neighborhood=${encodeURIComponent(neighborhood)}&maxRent=${maxRent}&minBedrooms=${beds}`,
    { tags: { name: "search" } },
  );
  searchDuration.add(Date.now() - searchStart);

  const searchOk = check(searchRes, {
    "search status 200": (r) => r.status === 200,
    "search under 2s": (r) => r.timings.duration < 2000,
  });
  if (!searchOk) errorRate.add(1);
  if (searchRes.status === 429) rateLimited.add(1);

  sleep(Math.random() * 2 + 0.5);

  const statsRes = http.get(`${BASE_URL}/api/stats/public`, { tags: { name: "stats" } });
  check(statsRes, {
    "stats status 200": (r) => r.status === 200,
    "stats has cache header": (r) => r.headers["X-Cache"] !== undefined,
  });

  sleep(0.5);
}
