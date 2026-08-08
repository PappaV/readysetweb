/**
 * Per-business movie-trailer composer.
 *
 * Cuts a unique 15s hero film from the CLIENT'S OWN material:
 *   - title cards generated from their name / tagline / services / a real review
 *   - their real photos (Places / website / social) as scene inserts
 *   - industry footage as the living backdrop
 * edited with a cinematic trailer rhythm (dramatic pushes, crossfades, grade,
 * letterbox bars). The composition is seeded by the business identity, so no two
 * businesses ever produce the same trailer.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import type { BusinessData } from "@demo-site-generator/shared";
import { hashString, mulberry32 } from "./seed";

export const FFMPEG =
  process.env.FFMPEG_PATH ||
  "C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe";

/** Free industry footage pools (landscape 1080p, verified working). */
export const FOOTAGE_POOL: Record<string, string[]> = {
  medspa: [
    "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/13467956/13467956-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/5524244/5524244-hd_1920_1080_30fps.mp4",
  ],
  "boutique-hospitality": [
    "https://videos.pexels.com/video-files/856995/856995-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/13467956/13467956-hd_1920_1080_30fps.mp4",
  ],
  "guesthouse-lodge": [
    "https://videos.pexels.com/video-files/3130284/3130284-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/5524244/5524244-hd_1920_1080_30fps.mp4",
    "https://videos.pexels.com/video-files/13467956/13467956-hd_1920_1080_30fps.mp4",
  ],
  "real-estate-agent": [
    "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
  ],
  "real-estate-developer": [
    "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
  ],
};

export function footageFor(category: string, seed: number, count = 3): string[] {
  const pool = FOOTAGE_POOL[category] ?? FOOTAGE_POOL["guesthouse-lodge"];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(seed + i * 7) % pool.length]);
  }
  return out;
}

export interface TrailerInput {
  business: BusinessData;
  /** Title-card PNGs (from renderTrailerCards). */
  cards: string[];
  /** Local real photo paths for the client (may be empty). */
  photos: string[];
  /** Local footage file paths (may be empty). */
  footage: string[];
  outputPath: string;
  duration?: number;
  fps?: number;
}

function gradeFilter(lighting?: string): string {
  switch (lighting) {
    case "golden-hour":
      return "eq=saturation=1.2:contrast=1.08,colorbalance=rs=0.08:gs=0.01:bs=-0.07";
    case "moody":
      return "eq=saturation=1.06:contrast=1.14:brightness=-0.03,colorbalance=rs=0.02:gs=-0.01:bs=0.05";
    case "dramatic":
      return "eq=saturation=1.16:contrast=1.22:brightness=-0.04";
    case "bright-airy":
      return "eq=saturation=1.08:contrast=0.98:brightness=0.04";
    default:
      return "eq=saturation=1.14:contrast=1.1";
  }
}

/** Build the ffmpeg command that assembles one 15s trailer from source clips. */
export function composeTrailerArgs(input: TrailerInput): { args: string[]; label: string } {
  const duration = input.duration ?? 15;
  const fps = input.fps ?? 24;
  const seed = hashString(`${input.business.name}|${input.business.category}|trailer`);
  const rand = mulberry32(seed);

  // Source order: footage (alive) + cards (their story) + photos (their reality).
  const sources: string[] = [];
  const kinds: string[] = [];
  for (const f of input.footage.slice(0, 3)) {
    if (existsSync(f)) { sources.push(f); kinds.push("video"); }
  }
  for (const c of input.cards) {
    if (existsSync(c)) { sources.push(c); kinds.push("card"); }
  }
  for (const p of input.photos.slice(0, 4)) {
    if (existsSync(p)) { sources.push(p); kinds.push("photo"); }
  }

  // If nothing is available, bail.
  if (sources.length < 2) throw new Error("trailer: not enough sources");

  const n = sources.length;
  const fade = 0.6; // fast trailer cuts
  // Give footage the lion's share of time; cards get short punchy beats.
  const videoSources = kinds.filter((k) => k === "video").length;
  const cardSources = kinds.filter((k) => k === "card").length;
  const photoSources = kinds.filter((k) => k === "photo").length;
  const totalTime = duration + (n - 1) * fade;

  const weights = kinds.map((k) => (k === "video" ? 1.6 : k === "card" ? 0.9 : 1.1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const segLens = weights.map((w) => (totalTime * w) / weightSum);

  const args: string[] = ["-y", "-nostdin"];
  const filters: string[] = [];

  sources.forEach((src, i) => {
    if (kinds[i] === "video") {
      args.push("-i", src);
      filters.push(
        `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
          `fps=${fps},setsar=1[v${i}]`
      );
    } else {
      // cards + photos: loop-extend still to its segment length
      args.push("-loop", "1", "-t", segLens[i].toFixed(2), "-i", src);
      // Dramatic slow push-in on cards, gentle drift on photos.
      const push = kinds[i] === "card" ? 1.04 : 1.02;
      const d = Math.max(Math.round(segLens[i] * fps), 2);
      filters.push(
        `[${i}:v]scale=2048:1152:force_original_aspect_ratio=increase,crop=1920:1080,` +
          `zoompan=z='${push}+0.00035*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${d}:s=1920x1080,fps=${fps},setsar=1[v${i}]`
      );
    }
  });

  // Chain with fast crossfades (trailer rhythm).
  let last = "v0";
  let offset = segLens[0] - fade;
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `x${i}`;
    const transition = rand() > 0.5 ? "fade" : "dissolve";
    filters.push(`[${last}][v${i}]xfade=transition=${transition}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`);
    last = out;
    offset += segLens[i] - fade;
  }

  // Cinematic grade + letterbox + vignette.
  const grade = gradeFilter(input.business.heroConfig?.lighting);
  const barH = 70;
  filters.push(
    `[${last}]${grade},eq=contrast=1.1:saturation=1.12,vignette=angle=PI/5,` +
      `drawbox=x=0:y=0:w=iw:h=${barH}:color=black:t=fill,` +
      `drawbox=x=0:y=ih-${barH}:w=iw:h=${barH}:color=black:t=fill,format=yuv420p[vf]`
  );

  args.push("-filter_complex", filters.join(";"), "-map", "[vf]");
  args.push("-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  args.push("-r", String(fps), "-t", String(duration), input.outputPath);

  return { args, label: `${input.business.name} trailer (${n} sources)` };
}

/** Render the trailer. Returns true on success. */
export function renderTrailer(input: TrailerInput): boolean {
  try {
    const { args } = composeTrailerArgs(input);
    execFileSync(FFMPEG, args, { stdio: "ignore", timeout: 300_000 });
    return existsSync(input.outputPath) && statSync(input.outputPath).size > 100_000;
  } catch {
    rmSync(input.outputPath, { force: true });
    return false;
  }
}

/** Download real footage clips locally so trailers are self-contained. */
export async function downloadFootage(urls: string[], dir: string): Promise<string[]> {
  mkdirSync(dir, { recursive: true });
  const out: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const dest = join(dir, `clip-${i}.mp4`);
    try {
      if (!existsSync(dest) || statSync(dest).size < 50_000) {
        const res = await fetch(urls[i], {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 50_000) continue;
        const { writeFileSync } = await import("node:fs");
        writeFileSync(dest, buf);
      }
      out.push(dest);
    } catch {
      // skip failed clip
    }
  }
  return out;
}
