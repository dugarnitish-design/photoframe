// =============================================================================
//  Photo Frame — Cloudflare Worker proxy
// =============================================================================
//  Why: a Google Photos shared-album page is large and can't be read directly
//  from a browser (CORS). This tiny Worker fetches it for you and adds the
//  headers that let the frame read it. It's your own private proxy, so there's
//  no shared rate limit and no response-size cap — the album loads reliably.
//
//  Setup (5 minutes, free):
//    1. Sign up at https://dash.cloudflare.com/sign-up
//    2. Workers & Pages  →  Create  →  Create Worker  →  name it  →  Deploy
//    3. Click "Edit code", delete everything, paste THIS file, then Deploy
//    4. Copy your Worker URL (https://NAME.SUBDOMAIN.workers.dev) and paste it
//       into the photo frame's Settings → "Your photo proxy" box → Save
//
//  Cost: the frame makes about 1 request/hour; the free plan allows 100,000/day.
// =============================================================================

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return new Response("Missing ?url= parameter", { status: 400, headers: cors });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: cors });
    }

    // Only proxy Google Photos and its image host, so this can't be abused
    // as a general open proxy.
    const allowedHost =
      /(^|\.)photos\.google\.com$|(^|\.)photos\.app\.goo\.gl$|(^|\.)googleusercontent\.com$|(^|\.)goo\.gl$/;
    if (!allowedHost.test(parsed.hostname)) {
      return new Response("Host not allowed", { status: 403, headers: cors });
    }

    const upstream = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PhotoFrame/1.0)" },
      redirect: "follow",
    });

    const headers = new Headers(cors);
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || "text/html; charset=utf-8"
    );
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
