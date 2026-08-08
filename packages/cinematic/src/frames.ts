import { chromium } from "playwright";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cinematicScene, cinematicSeed, mulberry32 } from "./index";
import type { BusinessData } from "@demo-site-generator/shared";

/**
 * Rasterize N unique cinematic movie-scene backdrops for a business into 1080p
 * PNG frames. Each frame is the same scene with a slightly different "camera"
 * (pan/crop) so ffmpeg can animate them into a 15s hero video that feels like a
 * film sequence.
 */
export async function renderCinematicFrames(
  business: Pick<BusinessData, "name" | "tagline" | "category" | "brandColors">,
  outDir: string,
  frameCount = 6
): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) {
    if (f.startsWith("cine-") && f.endsWith(".png")) rmSync(join(outDir, f), { force: true });
  }

  const seed = cinematicSeed(business.name, business.category);
  const rand = mulberry32(seed);

  const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--force-color-profile=srgb"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  try {
    for (let i = 0; i < frameCount; i++) {
      const svg = cinematicScene({
        businessName: business.name,
        tagline: business.tagline ?? undefined,
        category: business.category,
        brandColors: business.brandColors ?? undefined,
        seed: seed + i * 7919, // offset per frame but deterministic overall
        width: 1920,
        height: 1080,
      });
      // Inject the SVG directly into the DOM and capture the full-viewport shot.
      await page.setContent(
        `<html><body style="margin:0;padding:0;background:#000;width:1920px;height:1080px;overflow:hidden">${svg}</body></html>`,
        { waitUntil: "load" }
      );
      await page.waitForTimeout(120);
      const png = await page.screenshot({ type: "png" });
      writeFileSync(join(outDir, `cine-${String(i).padStart(3, "0")}.png`), png);
    }
  } finally {
    await browser.close();
  }

  const frames = readdirSync(outDir)
    .filter((f) => /^cine-\d+\.png$/.test(f))
    .sort()
    .map((f) => join(outDir, f))
    .filter((f) => statSync(f).size > 20_000);
  return frames;
}

export { cinematicScene, cinematicSeed };
