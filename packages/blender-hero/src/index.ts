import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BusinessData } from "@demo-site-generator/shared";

export const BLENDER =
  process.env.BLENDER_PATH || "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe";

export interface BlenderHeroInput {
  business: BusinessData;
  outDir: string;
  /** Deterministic seed — derive from business identity so it never changes. */
  seed: number;
  /** Number of cinematic keyframes to render (default 8). */
  stills?: number;
}

export interface BlenderHeroResult {
  /** Absolute paths to rendered 1080p hero stills (PNG). */
  frames: string[];
  ok: boolean;
}

/**
 * Render a set of brand-personalized 3D hero stills for a business via Blender.
 * The stills are later animated by ffmpeg into the 15s hero video. Returns the
 * frame paths, or an empty result if Blender is unavailable / rendering fails.
 */
export function renderBlenderHero(input: BlenderHeroInput): BlenderHeroResult {
  const { business, seed } = input;
  const outDir = input.outDir;

  if (!existsSync(BLENDER)) {
    console.warn("[blender-hero] Blender not found — skipping 3D hero render");
    return { frames: [], ok: false };
  }

  mkdirSync(outDir, { recursive: true });
  // Clear stale frames from a previous render of the same site.
  for (const f of readdirSync(outDir)) {
    if (f.startsWith("hero-") && f.endsWith(".png")) rmSync(join(outDir, f), { force: true });
  }

  const sceneScript = join(__dirname, "scene.py");
  if (!existsSync(sceneScript)) {
    console.warn("[blender-hero] scene.py not found at", sceneScript);
    return { frames: [], ok: false };
  }

  const accent = business.brandColors?.accent ?? "#d9a441";
  const primary = business.brandColors?.primary ?? "#1a2b3c";
  const stills = String(input.stills ?? 8);

  try {
    execFileSync(
      BLENDER,
      [
        "--background",
        "--factory-startup",
        "--python",
        sceneScript,
        "--",
        accent,
        primary,
        outDir,
        String(seed),
        stills,
      ],
      { stdio: "ignore", timeout: 20 * 60_000 }
    );
  } catch (err) {
    console.warn("[blender-hero] render failed:", (err as Error).message);
    return { frames: [], ok: false };
  }

  const frames = readdirSync(outDir)
    .filter((f) => /^hero-\d+\.png$/.test(f))
    .sort()
    .map((f) => join(outDir, f))
    .filter((f) => statSync(f).size > 10_000);

  return { frames, ok: frames.length >= 3 };
}

/** Deterministic seed from a business identity (stable across runs). */
export function blenderSeed(businessName: string, category: string): number {
  let h = 2166136261;
  const s = `${businessName}|${category}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
