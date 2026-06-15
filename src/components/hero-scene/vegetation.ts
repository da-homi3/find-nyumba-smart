import * as THREE from "three";
import { generateTreePositions } from "./nairobi-layout";

export type VegetationSystem = {
  update: (time: number) => void;
  dispose: () => void;
};

function createPalmTemplate(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }),
  );
  trunk.position.y = 0.9;
  g.add(trunk);

  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 }),
    );
    const angle = (i / 6) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 0.2, 1.9, Math.sin(angle) * 0.2);
    frond.rotation.z = Math.cos(angle) * 0.5;
    frond.rotation.x = Math.sin(angle) * 0.5;
    g.add(frond);
  }
  return g;
}

function createAcaciaTemplate(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.1, 1.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }),
  );
  trunk.position.y = 0.6;
  g.add(trunk);

  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.1, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d7a52, roughness: 0.75 }),
  );
  canopy.position.y = 1.35;
  g.add(canopy);
  return g;
}

export function createVegetation(scene: THREE.Scene, treeCount: number): VegetationSystem {
  const positions = generateTreePositions(treeCount);
  const palmTemplate = createPalmTemplate();
  const acaciaTemplate = createAcaciaTemplate();
  const groups: THREE.Group[] = [];

  for (const pos of positions) {
    const template = pos.kind === "palm" ? palmTemplate : acaciaTemplate;
    const tree = template.clone(true);
    tree.position.set(pos.x, 0, pos.z);
    const scale = 0.85 + Math.random() * 0.35;
    tree.scale.setScalar(scale);
    tree.rotation.y = Math.random() * Math.PI * 2;
    scene.add(tree);
    groups.push(tree);
  }

  palmTemplate.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
  });
  acaciaTemplate.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    }
  });

  return {
    update: (time: number) => {
      for (let i = 0; i < groups.length; i++) {
        const tree = groups[i]!;
        tree.rotation.z = Math.sin(time * 0.8 + i) * 0.015;
      }
    },
    dispose: () => {
      for (const tree of groups) {
        tree.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            const mats = Array.isArray(c.material) ? c.material : [c.material];
            for (const m of mats) m.dispose();
          }
        });
        scene.remove(tree);
      }
    },
  };
}
