import * as THREE from "three";

export interface LightingSetup {
  ambient: { color: THREE.Color; intensity: number };
  directional: { color: THREE.Color; intensity: number; position: THREE.Vector3 }[];
  point: { color: THREE.Color; intensity: number; position: THREE.Vector3; distance: number; decay: number }[];
  hemisphere: { skyColor: THREE.Color; groundColor: THREE.Color; intensity: number };
}

export const LIGHTING_PRESETS: Record<string, LightingSetup> = {
  "golden-hour": {
    ambient: { color: new THREE.Color(0xfff0d0), intensity: 0.3 },
    directional: [
      { color: new THREE.Color(0xffddaa), intensity: 1.5, position: new THREE.Vector3(10, 20, 10) },
      { color: new THREE.Color(0xffaa66), intensity: 0.5, position: new THREE.Vector3(-10, 10, -10) },
    ],
    point: [
      { color: new THREE.Color(0xffcc88), intensity: 1, position: new THREE.Vector3(0, 5, 0), distance: 30, decay: 2 },
    ],
    hemisphere: { skyColor: new THREE.Color(0xfff5e0), groundColor: new THREE.Color(0x8b7355), intensity: 0.4 },
  },
  "studio": {
    ambient: { color: new THREE.Color(0xffffff), intensity: 0.4 },
    directional: [
      { color: new THREE.Color(0xffffff), intensity: 1.2, position: new THREE.Vector3(5, 10, 5) },
      { color: new THREE.Color(0xe0e0ff), intensity: 0.6, position: new THREE.Vector3(-5, 5, -5) },
    ],
    point: [
      { color: new THREE.Color(0xffffff), intensity: 0.8, position: new THREE.Vector3(0, 3, 0), distance: 20, decay: 2 },
    ],
    hemisphere: { skyColor: new THREE.Color(0xf0f0f5), groundColor: new THREE.Color(0xffffff), intensity: 0.5 },
  },
  "moody": {
    ambient: { color: new THREE.Color(0x1a1a2e), intensity: 0.2 },
    directional: [
      { color: new THREE.Color(0x3a3a5e), intensity: 0.8, position: new THREE.Vector3(10, 15, 10) },
      { color: new THREE.Color(0x1a1a3e), intensity: 0.4, position: new THREE.Vector3(-10, 5, -10) },
    ],
    point: [
      { color: new THREE.Color(0x8866aa), intensity: 1.5, position: new THREE.Vector3(0, 4, 0), distance: 25, decay: 2 },
      { color: new THREE.Color(0xaa4466), intensity: 1, position: new THREE.Vector3(5, 2, 5), distance: 15, decay: 2 },
    ],
    hemisphere: { skyColor: new THREE.Color(0x2a2a4a), groundColor: new THREE.Color(0x1a1a2e), intensity: 0.3 },
  },
  "bright-airy": {
    ambient: { color: new THREE.Color(0xfafafa), intensity: 0.5 },
    directional: [
      { color: new THREE.Color(0xffffff), intensity: 1, position: new THREE.Vector3(0, 20, 10) },
    ],
    point: [],
    hemisphere: { skyColor: new THREE.Color(0xffffff), groundColor: new THREE.Color(0xf0f0f0), intensity: 0.6 },
  },
  "dramatic": {
    ambient: { color: new THREE.Color(0x0a0a0a), intensity: 0.1 },
    directional: [
      { color: new THREE.Color(0xffffff), intensity: 2, position: new THREE.Vector3(15, 25, 15) },
      { color: new THREE.Color(0xff3333), intensity: 0.8, position: new THREE.Vector3(-10, 10, -10) },
    ],
    point: [
      { color: new THREE.Color(0xffaa00), intensity: 2, position: new THREE.Vector3(0, 5, 0), distance: 30, decay: 1.5 },
    ],
    hemisphere: { skyColor: new THREE.Color(0x1a1a1a), groundColor: new THREE.Color(0x0a0a0a), intensity: 0.2 },
  },
};
