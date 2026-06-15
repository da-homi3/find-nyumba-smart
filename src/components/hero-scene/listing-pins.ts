import * as THREE from "three";
import { PIN_SLOTS } from "./nairobi-layout";

export type ListingPinSystem = {
  heads: THREE.Mesh[];
  rings: THREE.Mesh[];
  group: THREE.Group;
  update: (time: number, hoveredIndex: number) => void;
  dispose: () => void;
};

export function createListingPins(scene: THREE.Scene): ListingPinSystem {
  const group = new THREE.Group();
  scene.add(group);
  const heads: THREE.Mesh[] = [];
  const rings: THREE.Mesh[] = [];

  for (const slot of PIN_SLOTS) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8),
      new THREE.MeshStandardMaterial({
        color: slot.color,
        emissive: slot.color,
        emissiveIntensity: 0.4,
      }),
    );
    stem.position.set(slot.x, slot.y - 0.5, slot.z);
    group.add(stem);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({
        color: slot.color,
        emissive: slot.color,
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.92,
      }),
    );
    head.position.set(slot.x, slot.y + 0.5, slot.z);
    head.userData.pinIndex = heads.length;
    group.add(head);
    heads.push(head);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.55, 32),
      new THREE.MeshBasicMaterial({
        color: slot.color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(slot.x, 0.05, slot.z);
    group.add(ring);
    rings.push(ring);
  }

  return {
    heads,
    rings,
    group,
    update: (time: number, hoveredIndex: number) => {
      for (let i = 0; i < heads.length; i++) {
        const head = heads[i]!;
        const isHovered = i === hoveredIndex;
        const pulse = 1 + 0.12 * Math.sin(time * 2.5 + i);
        head.scale.setScalar(isHovered ? pulse * 1.35 : pulse);
        const mat = head.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = isHovered ? 2.2 : 1.2;

        const ring = rings[i]!;
        const ringScale = 1 + ((time * 0.6 + i * 0.3) % 2);
        ring.scale.setScalar(isHovered ? ringScale * 1.2 : ringScale);
        (ring.material as THREE.MeshBasicMaterial).opacity = isHovered
          ? 0.55
          : Math.max(0, 0.4 - ((time * 0.25 + i * 0.1) % 1) * 0.35);
      }
    },
    dispose: () => {
      group.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
      scene.remove(group);
    },
  };
}
