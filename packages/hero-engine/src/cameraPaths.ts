import * as THREE from "three";

export interface CameraPathResult {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export type CameraPathName = "drone-descend" | "orbital" | "dolly-zoom" | "fly-through" | "static";

export interface CameraRigOptions {
  distance?: number;
  heightOffset?: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function circlePoint(angle: number, radius: number, height: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

export function createCameraPath(
  name: CameraPathName,
  opts: CameraRigOptions = {}
): (p: number) => CameraPathResult {
  const d = opts.distance ?? 6;
  const h = opts.heightOffset ?? 0.5;

  switch (name) {
    case "drone-descend": {
      return (p) => {
        const ep = easeInOut(p);
        const startHeight = d * 5;
        const endHeight = d * 1.3;
        const height = THREE.MathUtils.lerp(startHeight, endHeight, ep);
        const radius = THREE.MathUtils.lerp(d * 4, d * 1.4, ep);
        const angle = -Math.PI / 2 + ep * Math.PI * 1.5;
        return {
          position: circlePoint(angle, radius, height + h),
          target: new THREE.Vector3(0, h, 0),
          fov: THREE.MathUtils.lerp(65, 42, ep),
        };
      };
    }

    case "orbital": {
      return (p) => {
        const ep = easeInOut(p);
        const angle = ep * Math.PI * 2;
        const bob = Math.sin(ep * Math.PI * 4) * d * 0.15;
        return {
          position: circlePoint(angle, d * 1.6, h + bob),
          target: new THREE.Vector3(0, h, 0),
          fov: 46,
        };
      };
    }

    case "dolly-zoom": {
      return (p) => {
        const ep = easeInOut(p);
        const z = THREE.MathUtils.lerp(d * 4, d * 0.55, ep);
        const y = THREE.MathUtils.lerp(d * 0.8, h, ep);
        return {
          position: new THREE.Vector3(0, y, z),
          target: new THREE.Vector3(0, h, 0),
          fov: THREE.MathUtils.lerp(72, 30, ep),
        };
      };
    }

    case "fly-through": {
      return (p) => {
        const ep = easeInOut(p);
        if (ep < 0.5) {
          const t = easeInOut(ep * 2);
          return {
            position: new THREE.Vector3(
              THREE.MathUtils.lerp(-d * 5, d * 2.5, t),
              THREE.MathUtils.lerp(d * 2.5, h + 0.5, t),
              THREE.MathUtils.lerp(d * 2, d * 0.5, t)
            ),
            target: new THREE.Vector3(0, h, 0),
            fov: 55,
          };
        }
        const t = easeInOut((ep - 0.5) * 2);
        return {
          position: new THREE.Vector3(
            THREE.MathUtils.lerp(d * 2.5, d * 0.5, t),
            THREE.MathUtils.lerp(h + 0.5, h, t),
            THREE.MathUtils.lerp(d * 0.5, -d * 2, t)
          ),
          target: new THREE.Vector3(0, h, 0),
          fov: 60,
        };
      };
    }

    case "static":
    default: {
      return () => ({
        position: new THREE.Vector3(0, h + 0.5, d * 1.8),
        target: new THREE.Vector3(0, h, 0),
        fov: 45,
      });
    }
  }
}

export function slowPanPath(opts: CameraRigOptions = {}): (p: number) => CameraPathResult {
  const d = opts.distance ?? 6;
  const h = opts.heightOffset ?? 0.5;
  return (p) => {
    const angle = -Math.PI / 2 + p * Math.PI * 0.9;
    return {
      position: circlePoint(angle, d * 1.9, h + 0.3 + Math.sin(p * Math.PI * 2) * 0.2),
      target: new THREE.Vector3(0, h, 0),
      fov: 48,
    };
  };
}
