import * as THREE from "three";
import { SIDEWALK_NORTH, SIDEWALK_SOUTH } from "./nairobi-layout";

type Pedestrian = {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  walkPhase: number;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
};

const SHIRT_COLORS = [0x12856b, 0x3366cc, 0xcc6633, 0x8844aa, 0xeeeeee, 0xf6ad55];

function createPedestrian(shirtColor: number): {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
} {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.14, 0.35, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }),
  );
  body.position.y = 0.55;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.85 }),
  );
  head.position.y = 0.95;
  group.add(head);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.9 });
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), legMat);
  leftLeg.position.set(-0.07, 0.18, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6), legMat);
  rightLeg.position.set(0.07, 0.18, 0);
  group.add(rightLeg);

  return { group, leftLeg, rightLeg };
}

export type PedestrianSystem = {
  group: THREE.Group;
  update: (delta: number) => void;
  dispose: () => void;
};

export function createPedestrians(scene: THREE.Scene, count: number): PedestrianSystem {
  const root = new THREE.Group();
  scene.add(root);
  const peds: Pedestrian[] = [];

  for (let i = 0; i < count; i++) {
    const color = SHIRT_COLORS[i % SHIRT_COLORS.length]!;
    const { group, leftLeg, rightLeg } = createPedestrian(color);
    const forward = i % 2 === 0;
    const curve = i % 3 === 0 ? SIDEWALK_NORTH : SIDEWALK_SOUTH;
    const t = (i / count + Math.random() * 0.2) % 1;
    const speed = forward ? 0.025 + (i % 4) * 0.008 : -(0.02 + (i % 4) * 0.007);

    root.add(group);
    peds.push({
      group,
      curve,
      t,
      speed,
      walkPhase: Math.random() * Math.PI * 2,
      leftLeg,
      rightLeg,
    });
  }

  const placePed = (p: Pedestrian, time: number) => {
    const tNorm = ((p.t % 1) + 1) % 1;
    const pt = p.curve.getPointAt(tNorm);
    const tangent = p.curve.getTangentAt(tNorm);
    p.group.position.set(pt.x, 0, pt.z);
    p.group.rotation.y = Math.atan2(tangent.x, tangent.z) + (p.speed < 0 ? Math.PI : 0);

    const stride = Math.sin(p.walkPhase + time * 8) * 0.35;
    p.leftLeg.rotation.x = stride;
    p.rightLeg.rotation.x = -stride;
  };

  for (const p of peds) placePed(p, 0);

  return {
    group: root,
    update: (delta: number) => {
      const time = performance.now() / 1000;
      for (const p of peds) {
        p.t += p.speed * delta;
        if (p.t > 1) p.t -= 1;
        if (p.t < 0) p.t += 1;
        p.walkPhase += delta * 6;
        placePed(p, time);
      }
    },
    dispose: () => {
      root.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      });
      scene.remove(root);
    },
  };
}
