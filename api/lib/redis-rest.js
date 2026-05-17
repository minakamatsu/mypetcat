/** Upstash (current) or legacy Vercel KV env names. */
export function getRedisRest() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

const COUNTER_KEY = "download_clicks";

/** @returns {Promise<void>} */
export async function incrDownloadCount() {
  const redis = getRedisRest();
  if (!redis) return;

  try {
    await fetch(`${redis.url}/incr/${COUNTER_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redis.token}` },
    });
  } catch (err) {
    console.error("download count incr failed", err);
  }
}

/** @returns {Promise<number | null>} */
export async function getDownloadCount() {
  const redis = getRedisRest();
  if (!redis) return null;

  const res = await fetch(`${redis.url}/get/${COUNTER_KEY}`, {
    headers: { Authorization: `Bearer ${redis.token}` },
  });
  const data = await res.json();
  return Number(data.result ?? 0);
}
