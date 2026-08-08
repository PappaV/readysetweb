import * as THREE from "three";

export interface ParticleOptions {
  count?: number;
  color?: THREE.Color | string | number;
  size?: number;
  spread?: number;
  opacity?: number;
  speed?: number;
}

export function createParticleField(opts: ParticleOptions = {}): THREE.Points {
  const count = opts.count ?? 350;
  const spread = opts.spread ?? 8;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread * 2;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread * 2;
    velocities[i] = 0.1 + Math.random() * 0.3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.userData.velocities = velocities;
  geometry.userData.spreadY = spread;

  const material = new THREE.PointsMaterial({
    color: opts.color ?? 0xffffff,
    size: opts.size ?? 0.035,
    transparent: true,
    opacity: opts.opacity ?? 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  return points;
}

export function animateParticles(points: THREE.Points, delta: number) {
  const pos = points.geometry.getAttribute("position") as THREE.BufferAttribute;
  const velocities = points.geometry.userData.velocities as Float32Array;
  const spreadY = points.geometry.userData.spreadY as number;

  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i);
    y += velocities[i] * delta;
    if (y > spreadY / 2) y = -spreadY / 2;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;

  points.rotation.y += delta * 0.02;
}
