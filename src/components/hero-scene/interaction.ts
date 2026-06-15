import * as THREE from "three";

export type InteractionState = {
  mouseX: number;
  mouseY: number;
  hoveredPinIndex: number;
};

export type InteractionSystem = {
  state: InteractionState;
  raycaster: THREE.Raycaster;
  applyParallax: (camera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
};

export function createInteraction(): InteractionSystem {
  const state: InteractionState = { mouseX: 0, mouseY: 0, hoveredPinIndex: -1 };
  const raycaster = new THREE.Raycaster();
  const targetLook = new THREE.Vector3(0, 3, 0);
  const currentLook = new THREE.Vector3(0, 3, 0);

  return {
    state,
    raycaster,
    applyParallax: (camera: THREE.PerspectiveCamera) => {
      targetLook.set(state.mouseX * 4, 3 + state.mouseY * 1.5, state.mouseY * 2);
      currentLook.lerp(targetLook, 0.04);
      camera.lookAt(currentLook);
    },
    dispose: () => {},
  };
}

export function raycastPins(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  pointer: THREE.Vector2,
  pinHeads: THREE.Mesh[],
): number {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pinHeads, false);
  if (hits.length === 0) return -1;
  const hit = hits[0]!.object as THREE.Mesh;
  return typeof hit.userData.pinIndex === "number" ? hit.userData.pinIndex : -1;
}
