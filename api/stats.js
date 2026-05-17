import { getDownloadCount, getRedisRest } from "./lib/redis-rest.js";

export const config = { runtime: "edge" };

/** @param {Request} request */
function authorized(request) {
  const secret = process.env.STATS_SECRET;
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const key = new URL(request.url).searchParams.get("key");
  return key === secret;
}

/** @param {Request} request */
export default async function handler(request) {
  if (!authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!getRedisRest()) {
    return Response.json({
      downloads: null,
      message:
        "Add Upstash Redis from the Vercel Marketplace (see website/WEBSITE.md).",
    });
  }

  try {
    const downloads = await getDownloadCount();
    return Response.json({ downloads: downloads ?? 0 });
  } catch (err) {
    console.error("stats read failed", err);
    return Response.json(
      { downloads: null, message: "Could not read counter." },
      { status: 500 },
    );
  }
}
