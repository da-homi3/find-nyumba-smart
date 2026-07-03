/* global __ENV */
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://nyumbasearch.com";

// NyumbaSearch uses Supabase Auth (no /api/auth/login). This tests the public
// listings API rate limit (60 req/min per IP via KV).
export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "30s", target: 5 },
    { duration: "15s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"],
  },
};

function isOkResponse(response) {
  return response.status === 200;
}

function isRateLimited(response) {
  return response.status === 429;
}

export default function authRateLimitTest() {
  for (let i = 0; i < 65; i++) {
    const res = http.get(`${BASE_URL}/api/listings?limit=5`, {
      tags: { name: "listings-rate-limit" },
    });

    if (i < 60) {
      check(res, { "under limit": isOkResponse });
    } else {
      check(res, { "rate limited at 61+": isRateLimited });
    }
    sleep(0.05);
  }
}
