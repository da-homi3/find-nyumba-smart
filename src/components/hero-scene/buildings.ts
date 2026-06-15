import * as THREE from "three";
import { BUILDING_SLOTS } from "./nairobi-layout";

function createWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 4; col++) {
      const lit = Math.random() > 0.35;
      ctx.fillStyle = lit ? (Math.random() > 0.5 ? "#ffe4a0" : "#a0c4ff") : "#0a0a12";
      ctx.fillRect(4 + col * 14, 4 + row * 7, 10, 5);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export type BuildingSystem = {
  windowTexture: THREE.CanvasTexture;
  meshes: THREE.Mesh[];
  update: (time: number) => void;
  dispose: () => void;
};

export function createBuildings(scene: THREE.Scene): BuildingSystem {
  const windowTexture = createWindowTexture();
  const meshes: THREE.Mesh[] = [];

  for (const slot of BUILDING_SLOTS) {
    const bodyMat = new THREE.MeshStandardMaterial({
      map: windowTexture,
      emissive: new THREE.Color(0xffe4a0),
      emissiveMap: windowTexture,
      emissiveIntensity: 0.35,
      roughness: 0.65,
      metalness: 0.25,
      color: new THREE.Color().setHSL(0.55, 0.15, 0.12 + Math.random() * 0.06),
    });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width, slot.height, slot.depth),
      bodyMat,
    );
    body.position.set(slot.x, slot.height / 2, slot.z);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);
    meshes.push(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width + 0.15, 0.15, slot.depth + 0.15),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 }),
    );
    roof.position.set(slot.x, slot.height + 0.08, slot.z);
    roof.castShadow = true;
    scene.add(roof);
    meshes.push(roof);
  }

  return {
    windowTexture,
    meshes,
    update: (time: number) => {
      const flicker = 0.3 + 0.08 * Math.sin(time * 0.7);
      for (let i = 0; i < meshes.length; i += 2) {
        const mat = meshes[i]!.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity != null) mat.emissiveIntensity = flicker;
      }
    },
    dispose: () => {
      windowTexture.dispose();
      for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}
