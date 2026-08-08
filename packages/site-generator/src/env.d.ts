/// <reference path="../.astro/types.d.ts" />

interface Window {
  __track?: (event: string, params?: Record<string, unknown>) => void;
  __applyLang?: (lang: string) => void;
  __imgFallback?: Record<string, string[]>;
}
