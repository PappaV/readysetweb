import { execFileSync } from "node:child_process";
import { existsSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

export const FFMPEG =
  process.env.FFMPEG_PATH ||
  "C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe";

export interface HeroVideoRenderInput {
  /** Local file paths of the business's real photos */
  images: string[];
  outputPath: string;
  businessName: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  lighting?: string;
  colorScheme?: string;
  /** Optional explicit seed — defaults to a stable hash of businessName so each
   *  business always renders the same unique video, but different businesses
   *  never look alike. */
  seed?: number;
  /** Treat inputs as distinct 3D scene stills (loop + crossfade instead of
   *  per-slide zoompan). Fast path used for Blender-rendered hero frames. */
  stills?: boolean;
  /** Total video length in seconds (default 15) */
  duration?: number;
  fps?: number;
}

/** FNV-1a hash → deterministic 32-bit seed from any string. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32) so the same seed always yields the
 *  same camera moves, transitions and overlay style. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Crossfade/wipe styles rotated between slides — the site-to-site variety. */
const TRANSITIONS = [
  "fade",
  "dissolve",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
  "circleopen",
  "circleclose",
  "radial",
  "zoomin",
  "fadeblack",
  "fadewhite",
  "pixelize",
];

/** Camera motion presets — zoom in/out, pans in several directions. */
function motionPreset(index: number): {
  z: string;
  x: string;
  y: string;
} {
  switch (index % 7) {
    case 0:
      return { z: "1.001+${SPEED}*on", x: "iw/2-iw/zoom/2", y: "ih/2-ih/zoom/2" };
    case 1:
      // zoom-in, pan left → right
      return { z: "1.001+${SPEED}*on", x: "(iw-iw/zoom)*(on/${D})", y: "ih/2-ih/zoom/2" };
    case 2:
      // zoom-in, pan right → left
      return { z: "1.001+${SPEED}*on", x: "(iw-iw/zoom)*(1-on/${D})", y: "ih/2-ih/zoom/2" };
    case 3:
      // zoom-in, pan top → bottom
      return { z: "1.001+${SPEED}*on", x: "iw/2-iw/zoom/2", y: "(ih-ih/zoom)*(on/${D})" };
    case 4:
      // zoom-out from center
      return { z: "${ZOOMOUT}-${SPEED}*on", x: "iw/2-iw/zoom/2", y: "ih/2-ih/zoom/2" };
    case 5:
      // zoom-in, diagonal pan ↘
      return { z: "1.001+${SPEED}*on", x: "(iw-iw/zoom)*(on/${D})", y: "(ih-ih/zoom)*(on/${D})" };
    default:
      // zoom-in, diagonal pan ↖
      return { z: "1.001+${SPEED}*on", x: "(iw-iw/zoom)*(1-on/${D})", y: "(ih-ih/zoom)*(on/${D})" };
  }
}

/** Map a hero lighting value to an ffmpeg color-grade (subtle, cinematic). */
function gradeFilter(lighting?: string): string {
  switch (lighting) {
    case "golden-hour":
      return "eq=saturation=1.18:contrast=1.06,colorbalance=rs=0.07:gs=0.01:bs=-0.06";
    case "moody":
      return "eq=saturation=1.05:contrast=1.12:brightness=-0.03,colorbalance=rs=0.02:gs=-0.01:bs=0.04";
    case "dramatic":
      return "eq=saturation=1.15:contrast=1.2:brightness=-0.04";
    case "bright-airy":
      return "eq=saturation=1.06:contrast=0.96:brightness=0.04";
    case "studio":
      return "eq=saturation=1.12:contrast=1.04";
    default:
      return "eq=saturation=1.1:contrast=1.05";
  }
}

/** Extra grade tweaks from the site's color scheme so each video has its own mood. */
function schemeFilter(colorScheme?: string): string {
  switch (colorScheme) {
    case "warm":
      return "colorbalance=rs=0.04:gs=0.0:bs=-0.03";
    case "cool":
      return "colorbalance=rs=-0.02:gs=0.0:bs=0.05";
    case "monochrome":
      return "hue=s=0,eq=contrast=1.06";
    case "neutral":
      return "eq=saturation=0.85";
    default:
      return "";
  }
}

/** Font for the business-name overlay (Windows system fonts). */
function pickFont(): string {
  const candidates = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
  ];
  return candidates.find((f) => existsSync(f)) ?? "C:/Windows/Fonts/arial.ttf";
}

/** Convert a hex brand color (#RRGGBB or #RGB) to an ffmpeg 0xRRGGBB value. */
function brandBoxColor(hex?: string): string {
  if (!hex) return "0x000000";
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "0x000000";
  return `0x${full.toLowerCase()}`;
}

/**
 * Render a 15s cinematic hero video from the business's real photos.
 * Each business gets a deterministic-but-unique treatment derived from its name:
 * rotating camera motions, different crossfade/wipe transitions, shuffled photo
 * order, a per-site color grade and a differently-placed name overlay. Returns
 * true on success.
 */
export function renderHeroVideo(input: HeroVideoRenderInput): boolean {
  const images = input.images.filter((p) => p && existsSync(p));
  if (!images.length) return false;

  const duration = input.duration ?? 15;
  const fps = input.fps ?? 15;
  const seed = input.seed ?? hashString(input.businessName + (input.lighting ?? "") + (input.colorScheme ?? ""));
  const rand = mulberry32(seed);

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  // Deterministic photo order shuffle so the opening shot differs per business.
  const order = images.map((img, i) => ({ img, r: rand() }));
  order.sort((a, b) => a.r - b.r);
  const ordered = order.map((o) => o.img);

  const n = ordered.length;
  const fade = 0.9 + rand() * 0.5; // seconds per transition (0.9–1.4)
  const speed = 0.0007 + rand() * 0.0006; // zoom velocity
  const zoomoutStart = 1.25 + rand() * 0.2;

  // Per-slide segment length so crossfades still total `duration` seconds.
  const segLen = n === 1 ? duration : (duration + (n - 1) * fade) / n;
  const frames = Math.max(Math.round(segLen * fps), 2);

  const buildArgs: string[] = ["-y", "-nostdin"];
  const filters: string[] = [];
  let last = "v0";

  if (n >= 3 && (input.stills || ordered.every((p) => /\.png$/i.test(p)))) {
    // Fast path (used for Blender 3D hero frames): each still is already a
    // distinct camera angle of the scene, so loop-extend + crossfade creates a
    // natural orbit. A single global slow zoom on the composited output adds
    // Ken Burns motion. ~4x faster than per-slide zoompan at 1080p.
    ordered.forEach((img, i) => {
      buildArgs.push("-loop", "1", "-t", segLen.toFixed(2), "-i", img);
      filters.push(
        `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
          `setsar=1,fps=${fps}[v${i}]`
      );
    });

    let offset = segLen - fade;
    for (let i = 1; i < n; i++) {
      const out = i === n - 1 ? "vout" : `x${i}`;
      const transition = pick(TRANSITIONS);
      filters.push(`[${last}][v${i}]xfade=transition=${transition}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`);
      last = out;
      offset += segLen - fade;
    }

    // No per-frame zoompan needed: the stills already orbit the 3D scene, so the
    // crossfade alone reads as cinematic motion (and keeps 1080p renders ~4x faster).
  } else {
    // Slow path (photos): per-slide zoompan for real Ken Burns motion.
    ordered.forEach((img, i) => {
      buildArgs.push("-i", img);
      const preset = motionPreset((seed >> 3) + i);
      const z = preset.z
        .replace("${SPEED}", speed.toFixed(6))
        .replace("${ZOOMOUT}", zoomoutStart.toFixed(6))
        .replace("${D}", String(frames - 1));
      const x = preset.x.replace("${D}", String(frames - 1));
      const y = preset.y.replace("${D}", String(frames - 1));
      filters.push(
        `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
          `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=1920x1080[v${i}]`
      );
    });

    let offset = segLen - fade;
    for (let i = 1; i < n; i++) {
      const out = i === n - 1 ? "vout" : `x${i}`;
      const transition = pick(TRANSITIONS);
      filters.push(`[${last}][v${i}]xfade=transition=${transition}:duration=${fade.toFixed(3)}:offset=${offset.toFixed(3)}[${out}]`);
      last = out;
      offset += segLen - fade;
    }
  }

  // Final grade + scheme tint + subtle vignette (film grain is applied via the
  // site's CSS overlay at runtime — cheaper than heavy ffmpeg temporal noise).
  const grade = [gradeFilter(input.lighting), schemeFilter(input.colorScheme)].filter(Boolean).join(",");
  filters.push(`[${last}]${grade},vignette=angle=PI/5[vgraded]`);

  // Business-name overlay — position, size and timing vary per business, and a
  // translucent brand-colored nameplate ties the video to the site's identity.
  const fontFile = pickFont().replace(/:/g, "\\:");
  const safeName = input.businessName.replace(/'/g, "").slice(0, 34);
  const showWindow = Math.max(duration - 3, 2);
  const alphaExpr =
    `if(lt(t,1),0,if(lt(t,1.8),(t-1)/0.8,if(lt(t,${showWindow.toFixed(2)}),1,` +
    `max(0,1-(t-${showWindow.toFixed(2)})/1.2))))`;
  const fontsize = Math.round(44 + rand() * 18);
  const overlay = Math.floor(rand() * 4);
  let pos: string;
  switch (overlay) {
    case 1:
      pos = `x=w*0.06:y=h*0.10`;
      break;
    case 2:
      pos = `x=(w-text_w)/2:y=h*0.80`;
      break;
    case 3:
      pos = `x=w-text_w-w*0.06:y=h*0.10`;
      break;
    default:
      pos = `x=(w-text_w)/2:y=h*0.14`;
  }
  const boxColor = brandBoxColor(input.brandColors?.accent);
  const draw = `drawtext=fontfile='${fontFile}':text='${safeName}':` +
    `fontsize=${fontsize}:fontcolor=white@0.95:borderw=2:bordercolor=black@0.35:` +
    `box=1:boxcolor=${boxColor}@0.28:boxborderw=14:` +
    `shadowx=0:shadowy=2:shadowcolor=black@0.45:` +
    `${pos}:alpha='${alphaExpr}'`;
  filters.push(`[vgraded]${draw},format=yuv420p[vfinal]`);

  buildArgs.push("-filter_complex", filters.join(";"), "-map", "[vfinal]");
  buildArgs.push("-c:v", "libx264", "-preset", "fast", "-crf", "20");
  buildArgs.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(fps));
  buildArgs.push("-t", String(duration));
  buildArgs.push(input.outputPath);

  try {
    execFileSync(FFMPEG, buildArgs, { stdio: "ignore", timeout: 420_000 });
    return isUsableVideo(input.outputPath);
  } catch {
    rmSync(input.outputPath, { force: true });
    // Fallback: render without the name overlay if drawtext fails (font issues).
    const fallbackArgs = buildArgs.filter((a) => !String(a).startsWith("drawtext"));
    const fbFilters = filters.filter((f) => !f.startsWith("drawtext"));
    // Rebuild without the drawtext stage (keep [vfinal] = [vgraded]).
    fallbackArgs[fallbackArgs.indexOf("-filter_complex") + 1] = fbFilters
      .filter((f) => f !== `[vgraded]${draw},format=yuv420p[vfinal]`)
      .join(";") + ";format=yuv420p[vfinal]";
    try {
      execFileSync(FFMPEG, fallbackArgs, { stdio: "ignore", timeout: 420_000 });
      return isUsableVideo(input.outputPath);
    } catch {
      rmSync(input.outputPath, { force: true });
      return false;
    }
  }
}

/** A usable video must exist, be non-empty, and contain real frames (> 20 KB). */
function isUsableVideo(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).size > 20_000;
  } catch {
    return false;
  }
}

export function heroVideoFilename(businessName: string): string {
  return `${businessName.replace(/[^\w-]+/g, "-").slice(0, 50)}-hero.mp4`;
}
