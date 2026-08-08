import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export interface EnvironmentHandle {
  environment: THREE.Texture;
  dispose: () => void;
}

export function createStudioEnvironment(renderer: THREE.WebGLRenderer): EnvironmentHandle {
  const pmrem = new THREE.PMREMGenerator(renderer);

  const env = new RoomEnvironment(renderer);
  const rt = pmrem.fromScene(env, 0.04);

  return {
    environment: rt.texture,
    dispose: () => {
      rt.dispose();
      pmrem.dispose();
    },
  };
}
