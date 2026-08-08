import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export interface CineImageOptions {
  container: HTMLElement;
  images: string[];
  videos?: string[];
  cameraPath?: "drone-descend" | "orbital" | "dolly-zoom" | "fly-through" | "static";
  showGrain?: boolean;
  showVignette?: boolean;
  showText?: boolean;
  title?: string;
  subtitle?: string;
  /** Crossfade between images automatically (seconds per slide, 0 = off). */
  slideInterval?: number;
  /** Alternate the scale/pan direction per slide so the montage feels like a real film. */
  alternateMotion?: boolean;
}

export interface CineImageHandle {
  dispose: () => void;
  setImages: (images: string[]) => void;
  setVideos: (videos: string[]) => void;
}

const CAMERA_PRESETS = {
  "drone-descend": {
    scale: [1.35, 1.0],
    panY: [10, 0],
    panX: [-6, 0],
    rotate: [1.5, 0],
    blur: [8, 0],
  },
  orbital: {
    scale: [1.2, 1.05],
    panY: [4, -4],
    panX: [-8, 8],
    rotate: [-1.2, 1.2],
    blur: [6, 0],
  },
  "dolly-zoom": {
    scale: [1.5, 0.95],
    panY: [6, 0],
    panX: [0, 0],
    rotate: [0, 0],
    blur: [10, 2],
  },
  "fly-through": {
    scale: [1.28, 1.0],
    panY: [12, -4],
    panX: [-12, 6],
    rotate: [2, -1],
    blur: [10, 0],
  },
  static: {
    scale: [1.08, 1.08],
    panY: [0, 0],
    panX: [0, 0],
    rotate: [0, 0],
    blur: [0, 0],
  },
};

export function initCineImage({
  container,
  images,
  videos,
  cameraPath = "drone-descend",
  showGrain = true,
  showVignette = true,
  showText = true,
  title = "",
  subtitle = "",
  slideInterval = 5,
  alternateMotion = true,
}: CineImageOptions): CineImageHandle {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  container.classList.add("cine-hero");
  container.style.position = "relative";
  container.style.overflow = "hidden";
  container.style.isolation = "isolate";

  const layerEl = document.createElement("div");
  layerEl.className = "cine-layer";
  layerEl.style.cssText =
    "position:absolute;inset:0;will-change:transform;transform-style:preserve-3d;";
  container.appendChild(layerEl);

  const renderLayers = (urls: string[]) => {
    layerEl.innerHTML = "";
    urls.forEach((url, i) => {
      const img = document.createElement("div");
      img.className = `cine-slide cine-slide-${i}`;
      img.style.cssText = `
        position:absolute;inset:0;
        background-image:url(${JSON.stringify(url)});
        background-size:cover;
        background-position:center;
        will-change:transform,filter,opacity;
        opacity:${i === 0 ? "1" : "0"};
        transition:opacity 1.2s ease;
      `;
      layerEl.appendChild(img);
    });
  };

  const renderVideos = (urls: string[]) => {
    layerEl.innerHTML = "";
    urls.forEach((url, i) => {
      const vid = document.createElement("video");
      vid.className = `cine-slide cine-video cine-slide-${i}`;
      vid.src = url;
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.style.cssText = `
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:cover;
        will-change:transform,filter,opacity;
      `;
      vid.setAttribute("aria-hidden", "true");
      layerEl.appendChild(vid);
    });
  };

  const addOverlay = (css: string) => {
    const el = document.createElement("div");
    el.style.cssText = css;
    container.appendChild(el);
  };

  if (showVignette) {
    addOverlay(
      "position:absolute;inset:0;z-index:3;pointer-events:none;background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%);"
    );
  }

  if (showGrain) {
    addOverlay(
      `position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0.12;mix-blend-mode:overlay;
       background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");`
    );
  }

  if (showText) {
    const textEl = document.createElement("div");
    textEl.style.cssText = `
      position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;
      align-items:center;justify-content:center;text-align:center;
      color:#fff;pointer-events:none;font-family:var(--font-primary, Georgia, serif);
      text-shadow:0 2px 40px rgba(0,0,0,0.55);
    `;
    textEl.innerHTML = `
      <div class="cine-eyebrow" style="font-size:0.8rem;letter-spacing:0.3em;text-transform:uppercase;opacity:0;margin-bottom:1rem;font-family:var(--font-secondary, system-ui);">${cameraPath.replace(/-/g, " ")}</div>
      <div class="cine-title" style="font-size:clamp(2rem,6vw,5rem);font-weight:600;opacity:0;transform:translateY(30px);">${title || "Cinematic Hero"}</div>
      ${subtitle ? `<div class="cine-subtitle" style="font-size:clamp(1rem,2vw,1.4rem);opacity:0;margin-top:1rem;font-weight:300;font-family:var(--font-secondary, system-ui);">${subtitle}</div>` : ""}
    `;
    container.appendChild(textEl);

    const eyebrow = textEl.querySelector(".cine-eyebrow") as HTMLElement;
    const titleEl = textEl.querySelector(".cine-title") as HTMLElement;
    const subtitleEl = textEl.querySelector(".cine-subtitle") as HTMLElement;

    gsap.fromTo(eyebrow, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.4 });
    gsap.fromTo(titleEl, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, delay: 0.6, ease: "power3.out" });
    if (subtitleEl) {
      gsap.fromTo(subtitleEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, delay: 0.9, ease: "power3.out" });
    }
  }

  const preset = CAMERA_PRESETS[cameraPath];
  const slideCount = () => layerEl.querySelectorAll<HTMLElement>(".cine-slide").length;
  let activeSlide = 0;
  let slideTimer: ReturnType<typeof setTimeout> | null = null;
  const motionForward = alternateMotion ? 1 : 0;

  // Per-slide "film" motion (Ken Burns): each slide continuously drifts between
  // two scale/pan endpoints so even a single photo feels alive like video.
  const applySlideMotion = (slide: HTMLElement, i: number, p: number) => {
    const dir = motionForward ? (i % 2 === 0 ? 1 : -1) : 1;
    const scale = gsap.utils.interpolate(preset.scale[0], preset.scale[1], p);
    const panX = gsap.utils.interpolate(preset.panX[0] * dir, preset.panX[1] * dir, p);
    const panY = gsap.utils.interpolate(preset.panY[0], preset.panY[1], p);
    const rot = gsap.utils.interpolate(preset.rotate[0] * dir, preset.rotate[1] * dir, p);
    slide.style.transform = `scale(${scale}) translate3d(${panX}px, ${panY}px, 0) rotate(${rot}deg)`;
    const blur = gsap.utils.interpolate(preset.blur[0], preset.blur[1], p);
    slide.style.filter = blur > 0 ? `blur(${blur}px)` : "none";
  };

  const applyCamera = (progress: number) => {
    const p = progress;
    const slides = layerEl.querySelectorAll<HTMLElement>(".cine-slide");
    slides.forEach((slide, i) => applySlideMotion(slide, i, p));
  };

  const showSlide = (index: number) => {
    const slides = layerEl.querySelectorAll<HTMLElement>(".cine-slide");
    if (slides.length <= 1) return;
    activeSlide = ((index % slides.length) + slides.length) % slides.length;
    slides.forEach((s, i) => {
      s.style.opacity = i === activeSlide ? "1" : "0";
      s.style.zIndex = i === activeSlide ? "2" : "1";
    });
  };

  // Auto crossfade: play the business's real photos as a cinematic montage.
  const startSlideshow = () => {
    if (prefersReduced || !slideInterval || slideCount() <= 1) return;
    const advance = () => {
      showSlide(activeSlide + 1);
      slideTimer = setTimeout(advance, slideInterval * 1000);
    };
    slideTimer = setTimeout(advance, slideInterval * 1000);
  };

  applyCamera(0);
  showSlide(0);

  let tl: gsap.core.Timeline | undefined;
  if (!prefersReduced) {
    tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: "bottom top",
        scrub: 0.8,
        onUpdate: (self) => applyCamera(self.progress),
      },
    });
  }

  if (videos?.length) {
    renderVideos(videos);
  } else {
    renderLayers(images);
    startSlideshow();
  }

  return {
    dispose: () => {
      if (slideTimer) clearTimeout(slideTimer);
      tl?.scrollTrigger?.kill();
      tl?.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      layerEl.querySelectorAll("video").forEach((v) => v.pause());
      layerEl.innerHTML = "";
      container.innerHTML = "";
      container.classList.remove("cine-hero");
    },
    setImages: (urls: string[]) => {
      layerEl.querySelectorAll("video").forEach((v) => v.pause());
      if (slideTimer) clearTimeout(slideTimer);
      renderLayers(urls);
      activeSlide = 0;
      showSlide(0);
      startSlideshow();
    },
    setVideos: (urls: string[]) => {
      if (slideTimer) clearTimeout(slideTimer);
      renderVideos(urls);
    },
  };
}
