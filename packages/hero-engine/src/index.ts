import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HeroConfig } from "@demo-site-generator/shared";
import { createCameraPath, CameraPathName, slowPanPath } from "./cameraPaths";
import { buildAsset } from "./assetFactory";
import { createParticleField, animateParticles } from "./particles";
import { createStudioEnvironment } from "./environment";
import { createPostFX } from "./postfx";
import { LIGHTING_PRESETS } from "./types";

gsap.registerPlugin(ScrollTrigger);

export interface InitHeroOptions {
  container: HTMLElement;
  config: HeroConfig;
  assets?: Map<string, THREE.Object3D>;
  debug?: boolean;
}

export interface HeroHandle {
  dispose: () => void;
  setPaused: (paused: boolean) => void;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

export function initHero({ container, config, assets = new Map(), debug = false }: InitHeroOptions): HeroHandle {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0e1116, 1);
  container.appendChild(renderer.domElement);

  const world = new THREE.Group();
  scene.add(world);

  const env = createStudioEnvironment(renderer);
  scene.environment = env.environment;

  const mainObject = assets.get(config.primary3DAsset) ?? buildAsset(config.primary3DAsset) ?? buildAsset("floating-orbs");
  if (mainObject) {
    world.add(mainObject);
    if (mainObject.userData.floatAmount === undefined) {
      mainObject.userData.floatAmount = 0.12;
      mainObject.userData.autoRotate = 0.2;
    }
  }

  setupLights(scene, config);

  const particles = createParticleField({
    color: config.lighting === "moody" ? 0x8866aa : 0xffffff,
    count: config.particles ? 300 : 0,
  });
  if (config.particles) scene.add(particles);

  const fx = createPostFX(renderer, scene, camera, {
    bloom: true,
    bloomStrength: 0.55,
    ssao: false,
    filmGrain: true,
    vignette: true,
    vignetteIntensity: 0.6,
  });

  const target = new THREE.Vector3(0, 0.5, 0);
  const cameraPath = createCameraPath(config.cameraPath as CameraPathName, {
    distance: 5.5,
    heightOffset: 0.5,
  });

  let baseFov = 50;
  let mouseX = 0;
  let mouseY = 0;
  let paused = false;
  let disposed = false;

  const onMouseMove = (e: MouseEvent) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    fx.resize(w, h);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("resize", onResize);

  const applyCamera = (p: number) => {
    const result = cameraPath(p);
    camera.position.copy(result.position);
    camera.lookAt(result.target);
    camera.fov = result.fov;
    camera.updateProjectionMatrix();
    baseFov = result.fov;
  };

  applyCamera(0);

  let tl: gsap.core.Timeline | undefined;
  if (!prefersReduced) {
    tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
        onUpdate: (self) => {
          applyCamera(self.progress);
        },
      },
    });
  }

  const clock = new THREE.Clock();
  const animate = () => {
    if (disposed) return;
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    if (!paused) {
      if (mainObject) {
        const rotate = mainObject.userData.autoRotate ?? 0.2;
        mainObject.rotation.y += delta * rotate;

        const floatAmt = mainObject.userData.floatAmount ?? 0.1;
        const t = clock.elapsedTime;
        mainObject.position.y = Math.sin(t * 0.8) * floatAmt;
        mainObject.rotation.x = Math.sin(t * 0.5) * 0.05 + mouseY * 0.06;
        mainObject.rotation.z = Math.sin(t * 0.3) * 0.03;
      }

      const parallaxTarget = new THREE.Vector3(mouseX * 0.4, mouseY * 0.25, 0);
      world.position.lerp(parallaxTarget, 0.05);

      if (particles) animateParticles(particles, delta);
    }

    fx.composer.render();
  };
  animate();

  if (debug) {
    console.log(`[hero-engine] ${config.cameraPath} | ${config.primary3DAsset} | ${config.lighting}`);
  }

  return {
    dispose: () => {
      disposed = true;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      tl?.scrollTrigger?.kill();
      tl?.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
      fx.dispose();
      env.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
    setPaused: (p: boolean) => {
      paused = p;
    },
    scene,
    camera,
  };
}

function setupLights(scene: THREE.Scene, config: HeroConfig) {
  const preset = LIGHTING_PRESETS[config.lighting] ?? LIGHTING_PRESETS["studio"];

  const ambient = new THREE.AmbientLight(preset.ambient.color, preset.ambient.intensity);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(preset.hemisphere.skyColor, preset.hemisphere.groundColor, preset.hemisphere.intensity);
  scene.add(hemi);

  for (const d of preset.directional) {
    const light = new THREE.DirectionalLight(d.color, d.intensity);
    light.position.copy(d.position);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    scene.add(light);
  }

  for (const p of preset.point) {
    const light = new THREE.PointLight(p.color, p.intensity, p.distance, p.decay);
    light.position.copy(p.position);
    scene.add(light);
  }
}

export function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

export { slowPanPath };
export type { CameraPathName };
export { initCineImage } from "./cineImage";
export type { CineImageOptions, CineImageHandle } from "./cineImage";
export { CATEGORY_PHOTOS, photosForCategory, CATEGORY_VIDEOS, videosForCategory } from "./photos";
