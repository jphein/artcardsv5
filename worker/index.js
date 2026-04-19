// Cloudflare Worker for artcardsv5 API.
// Ports the former Vercel functions in api/ to a single fetch handler.

import { handleVersion } from "./version.js";
import { handlePublish, handleStatus, handlePrice } from "./gamecrafter.js";
import { handleCast, handleDivine } from "./generate.js";
import { corsHeaders, preflight } from "./cors.js";

const ROUTES = {
  "/api/version": handleVersion,
  "/api/gamecrafter/publish": handlePublish,
  "/api/gamecrafter/status": handleStatus,
  "/api/gamecrafter/price": handlePrice,
  "/api/generate/cast": handleCast,
  "/api/generate/divine": handleDivine,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "";

    if (request.method === "OPTIONS") {
      return preflight(origin);
    }

    const handler = ROUTES[url.pathname];
    if (!handler) {
      return json({ error: "Not found", path: url.pathname }, 404, origin);
    }

    try {
      return await handler(request, env, origin);
    } catch (err) {
      console.error(`${url.pathname} error:`, err);
      return json({ error: err.message || "Internal server error" }, 500, origin);
    }
  },
};

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
