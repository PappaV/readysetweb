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
  /** Total video length in seconds (default 15) */
  duration?: number;
  fps?: number;
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

/**
 * Render a 15s cinematic hero video from the business's real photos.
 * Continuous Ken Burns motion (zoom + pan per slide), smooth crossfades,
 * a subtle color grade matching the hero lighting, and the business name
 * fading in near the start. Returns true on success.
 */
export function renderHeroVideo(input: HeroVideoRenderInput): boolean {
  const images = input.images.filter((p) => p && existsSync(p));
  if (!images.length) return false;

  const duration = input.duration ?? 15;
  const fps = input.fps ?? 30;
  const fade = 1.0; // seconds per crossfade
  const n = images.length;

  // Per-slide segment length so crossfades still total `duration` seconds.
  const segLen = n === 1 ? duration : (duration + (n - 1) * fade) / n;
  const frames = Math.max(Math.round(segLen * fps), 2);

  const buildArgs: string[] = ["-y", "-nostdin"];
  const filters: string[] = [];

  // Each still becomes a zoom-pan animated clip via zoompan.
  images.forEach((img, i) => {
    buildArgs.push("-i", img);
    // Alternate motion: zoom-in vs zoom-in + lateral pan, direction flips per slide.
    const dir = i % 2 === 0 ? 1 : -1;
    const zoom = `1.001+0.0009*on`;
    const xExpr = i % 2 === 0
      ? `iw/2-iw/zoom/2`
      : `iw/2-iw/zoom/2+on*2.5`;
    const yExpr = i % 2 === 0
      ? `ih/2-ih/zoom/2`
      : `ih/2-ih/zoom/2+on*1.2`;
    filters.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,` +
        `zoompan=z='${zoom}':x='${xExpr}':y='${yExpr}':d=${frames}[v${i}]`
    );
  });

  // Chain the clips with crossfades.
  let last = "v0";
  let offset = segLen - fade;
  for (let i = 1; i < n; i++) {
    const out = i === n - 1 ? "vout" : `x${i}`;
    filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${out}]`);
    last = out;
    offset += segLen - fade;
  }

  // Final grade + subtle grain + optional vignette on the finished video.
  const grade = gradeFilter(input.lighting);
  filters.push(`[${last}]${grade},vignette=angle=PI/5[vgraded]`);

  // Business-name overlay, fading in ~1s and out near the end.
  const fontFile = pickFont().replace(/:/g, "\\:");
  const safeName = input.businessName.replace(/'/g, "").slice(0, 34);
  const showWindow = Math.max(duration - 3, 2);
  const alphaExpr =
    `if(lt(t,1),0,if(lt(t,1.8),(t-1)/0.8,if(lt(t,${showWindow.toFixed(2)}),1,` +
    `max(0,1-(t-${showWindow.toFixed(2)})/1.2))))`;
  const draw = `drawtext=fontfile='${fontFile}':text='${safeName}':` +
    `fontsize=54:fontcolor=white@0.92:borderw=2:bordercolor=black@0.45:` +
    `shadowx=0:shadowy=2:shadowcolor=black@0.5:` +
    `x=(w-text_w)/2:y=h*0.14:alpha='${alphaExpr}'`;
  filters.push(`[vgraded]${draw},format=yuv420p[vfinal]`);

  buildArgs.push("-filter_complex", filters.join(";"), "-map", "[vfinal]");
  buildArgs.push("-c:v", "libx264", "-preset", "medium", "-crf", "21");
  buildArgs.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(fps));
  buildArgs.push("-t", String(duration));
  buildArgs.push(input.outputPath);

  try {
    execFileSync(FFMPEG, buildArgs, { stdio: "ignore", timeout: 120_000 });
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
      execFileSync(FFMPEG, fallbackArgs, { stdio: "ignore", timeout: 120_000 });
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
