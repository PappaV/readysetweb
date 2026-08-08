import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";

export interface PostFXOptions {
  bloom?: boolean;
  bloomStrength?: number;
  ssao?: boolean;
  filmGrain?: boolean;
  vignette?: boolean;
  vignetteIntensity?: number;
}

export interface PostFXHandle {
  composer: EffectComposer;
  resize: (w: number, h: number) => void;
  dispose: () => void;
  setDepthOfField: (enabled: boolean, focus?: number) => void;
}

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  opts: PostFXOptions = {}
): PostFXHandle {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const useBloom = opts.bloom ?? true;
  const bloomStrength = opts.bloomStrength ?? 0.6;

  if (useBloom) {
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomStrength,
      0.7,
      0.6
    );
    composer.addPass(bloomPass);
  }

  const useSSAO = opts.ssao ?? true;
  let ssaoPass: SSAOPass | null = null;
  if (useSSAO) {
    ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.output = SSAOPass.OUTPUT.Default;
    ssaoPass.kernelRadius = 8;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.1;
    composer.addPass(ssaoPass);
  }

  if (opts.filmGrain ?? true) {
    const filmPass = new FilmPass(0.2, false);
    composer.addPass(filmPass);
  }

  composer.addPass(new ShaderPass(GammaCorrectionShader));

  if (opts.vignette ?? true) {
    const vignettePass = new ShaderPass(VignetteShader);
    (vignettePass.uniforms.offset as { value: number }).value = 0.55;
    (vignettePass.uniforms.darkness as { value: number }).value = opts.vignetteIntensity ?? 0.55;
    composer.addPass(vignettePass);
  }

  const resize = (w: number, h: number) => {
    composer.setSize(w, h);
  };

  const dispose = () => {
    composer.dispose();
  };

  const setDepthOfField = (_enabled: boolean, _focus?: number) => {
    // Reserved for future DoF pass
  };

  return { composer, resize, dispose, setDepthOfField };
}
