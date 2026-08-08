import * as THREE from "three";

export function glassMaterial(opts: {
  color?: number;
  roughness?: number;
  ior?: number;
  thickness?: number;
  opacity?: number;
} = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.03,
    metalness: 0,
    transmission: 1,
    ior: opts.ior ?? 1.5,
    thickness: opts.thickness ?? 1.2,
    transparent: true,
    opacity: opts.opacity ?? 1,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.5,
  });
}

export function metalMaterial(color: number, roughness = 0.25) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness,
    envMapIntensity: 1.6,
    clearcoat: 0.3,
  });
}

export function satinMaterial(color: number, roughness = 0.4) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.05,
    roughness,
    envMapIntensity: 1.1,
    sheen: 0.6,
    sheenRoughness: 0.5,
  });
}

export function matteMaterial(color: number, roughness = 0.85) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness,
    envMapIntensity: 0.9,
  });
}

export function woodMaterial(baseColor: number) {
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: 0,
    roughness: 0.55,
    clearcoat: 0.3,
    envMapIntensity: 0.8,
  });
}

export function stoneMaterial(baseColor: number, roughness = 0.9) {
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: 0,
    roughness,
    envMapIntensity: 0.6,
  });
}

export function ceramicMaterial(baseColor: number) {
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    metalness: 0,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2,
  });
}

export function emissiveMaterial(color: number, intensity = 1) {
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0,
    roughness: 0.4,
  });
}
