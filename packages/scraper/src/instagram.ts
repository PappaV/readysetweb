/**
 * Instagram Graph API integration — the OFFICIAL way to pull a business's
 * full-resolution photos AND videos for the hero trailer.
 *
 * Requires an Instagram Business account connected to a Facebook app and a
 * long-lived user access token with `instagram_basic` (and ideally
 * `pages_read_engagement`). Set IG_ACCESS_TOKEN in the environment.
 *
 * Flow:
 *   1. Resolve the IG username → IG user id (via /ig_hashtag_search is wrong;
 *      instead use the Pages/IG endpoints or the `/me` + accounts route).
 *   2. Pull the user's recent media (images + videos + reels) at full res.
 *   3. Return clean URLs the trailer can download.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface InstagramMedia {
  id: string;
  type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  timestamp: string;
}

export interface InstagramResult {
  media: InstagramMedia[];
  bio?: string;
  followers?: number;
  ok: boolean;
  error?: string;
}

function token(): string | undefined {
  return process.env.IG_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
}

async function graphGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const t = token();
  if (!t) throw new Error("IG_ACCESS_TOKEN not set");
  const qs = new URLSearchParams({ access_token: t, ...params });
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Instagram Graph API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Resolve an Instagram username to an IG Business user id. */
async function resolveUserId(username: string): Promise<string> {
  // First, get the connected IG business accounts from the token owner.
  const me = await graphGet("me", { fields: "id,name" });
  // The token's connected accounts (pages / IG business).
  const acc = await graphGet("me/accounts", { fields: "instagram_business_account{id,username,profile_picture_url}" });
  const accounts = acc?.data ?? [];
  const match = accounts.find((a: any) => a.instagram_business_account?.username?.toLowerCase() === username.toLowerCase());
  if (match?.instagram_business_account?.id) {
    return match.instagram_business_account.id;
  }
  // Fallback: try the first available business account.
  if (accounts[0]?.instagram_business_account?.id) {
    return accounts[0].instagram_business_account.id;
  }
  throw new Error(`No connected Instagram business account for "${username}". Link the IG account to your Facebook page and re-token.`);
}

/** Fetch the most recent media (photos + videos + reels) for a username. */
export async function fetchInstagramMedia(username: string, limit = 20): Promise<InstagramResult> {
  try {
    const t = token();
    if (!t) return { media: [], ok: false, error: "IG_ACCESS_TOKEN not set" };

    const userId = await resolveUserId(username);
    const profile = await graphGet(userId, {
      fields: "id,username,biography,followers_count,profile_picture_url",
    });
    const mediaRes = await graphGet(`${userId}/media`, {
      fields: "id,media_type,media_url,thumbnail_url,caption,timestamp",
      limit: String(limit),
    });

    const media: InstagramMedia[] = (mediaRes?.data ?? [])
      .map((m: { id?: string; media_type?: string; media_url?: string; thumbnail_url?: string; caption?: string; timestamp?: string }) => ({
        id: String(m.id),
        type: m.media_type as InstagramMedia["type"],
        mediaUrl: String(m.media_url ?? ""),
        thumbnailUrl: m.thumbnail_url ? String(m.thumbnail_url) : undefined,
        caption: m.caption ? String(m.caption).slice(0, 400) : undefined,
        timestamp: String(m.timestamp ?? ""),
      }))
      .filter((m: InstagramMedia) => m.mediaUrl);

    return {
      media,
      bio: profile.biography ? String(profile.biography) : undefined,
      followers: profile.followers_count ? Number(profile.followers_count) : undefined,
      ok: true,
    };
  } catch (err) {
    return { media: [], ok: false, error: (err as Error).message };
  }
}

/** Split media into usable photo URLs and video URLs. */
export function mediaToUrls(result: InstagramResult): { photos: string[]; videos: string[] } {
  const photos: string[] = [];
  const videos: string[] = [];
  for (const m of result.media) {
    if (m.type === "VIDEO" && m.mediaUrl) {
      videos.push(m.mediaUrl);
      if (m.thumbnailUrl) photos.push(m.thumbnailUrl);
    } else if (m.mediaUrl && (m.type === "IMAGE" || m.type === "CAROUSEL_ALBUM")) {
      photos.push(m.mediaUrl);
    }
  }
  return { photos, videos };
}
