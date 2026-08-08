import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const FFMPEG =
  process.env.FFMPEG_PATH ||
  "C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe";

const timeout = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.argv[2];
  const name = process.argv[3] || "hero";
  const outDir = process.argv[4] || "C:/Users/User/demo_videos";
const duration = Number(process.argv[5] || 15);
const fps = Number(process.argv[6] || 12);

  if (!url) { console.error("usage: record-hero.ts <url> <name> [outDir] [durationSec] [fps]"); process.exit(1); }

  mkdirSync(outDir, { recursive: true });
  const safe = name.replace(/[^\w-]+/g, "-").slice(0, 60);
  const mp4Path = join(outDir, `${safe}.mp4`);
  const frameDir = join(os.tmpdir(), `hero-${Date.now()}`);
  mkdirSync(frameDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await Promise.race([
      page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }),
      timeout(50000),
    ]).catch(() => {});
    await timeout(4000);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Page.enable");

    const total = Math.round(duration * fps);
    let written = 0;
    const deadline = Date.now() + (duration + 40) * 1000;
    while (written < total && Date.now() < deadline) {
      try {
        const shot: any = await Promise.race([
          cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 82 }),
          timeout(4000),
        ]);
        if (shot?.data) {
          writeFileSync(join(frameDir, `f-${String(written).padStart(4, "0")}.jpg`), Buffer.from(shot.data, "base64"));
          written++;
        }
      } catch { /* skip a dropped frame */ }
    }
    console.log(`captured ${written}/${total} frames`);

    execFileSync(FFMPEG, [
      "-y", "-nostats", "-loglevel", "error", "-framerate", String(fps), "-i", join(frameDir, "f-%04d.jpg"),
      "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      mp4Path,
    ], { stdio: "ignore" });

    rmSync(frameDir, { recursive: true, force: true });
    try { browser.process()?.kill(); } catch { /* ignore */ }
    console.log("MP4:", mp4Path);
    process.exit(0);
  } catch (e) {
    console.error("RECORD FAILED:", e instanceof Error ? e.message : e);
  } finally {
    rmSync(frameDir, { recursive: true, force: true });
    try { browser.process()?.kill(); } catch { /* ignore */ }
    process.exit(0);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
// Hard watchdog so we never hang indefinitely (capture can take ~2-3min on slow pages)
setTimeout(() => { console.error("WATCHDOG EXIT"); process.exit(1); }, 300000).unref();
