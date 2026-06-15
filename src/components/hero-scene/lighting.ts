import * as THREE from "three";

export type SceneLighting = {
  sun: THREE.DirectionalLight;
  dispose: () => void;
};

export function addSceneLighting(scene: THREE.Scene): SceneLighting {
  scene.add(new THREE.AmbientLight(0xfff5e6, 0.35));
  scene.add(new THREE.HemisphereLight(0xffd4a3, 0x1a4d2e, 0.45));

  const sun = new THREE.DirectionalLight(0xffd4a3, 1.4);
  sun.position.set(18, 28, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  scene.add(sun);

  const greenFill = new THREE.PointLight(0x1eb88a, 0.5, 60);
  greenFill.position.set(-8, 8, 0);
  scene.add(greenFill);

  return {
    sun,
    dispose: () => {
      scene.remove(sun);
      scene.remove(greenFill);
    },
  };
}
