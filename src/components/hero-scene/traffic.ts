import * as THREE from "three";
import { ROAD_BACKWARD, ROAD_FORWARD } from "./nairobi-layout";

export type VehicleKind = "sedan" | "matatu" | "boda";

type Vehicle = {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
};

function createWheel(r = 0.22, w = 0.12): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, w, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
  );
}

function createSedan(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 0.9),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }),
  );
  body.position.y = 0.45;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.75),
    new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    }),
  );
  cabin.position.set(-0.1, 0.75, 0);
  g.add(cabin);
  for (const [x, z] of [
    [-0.5, 0.35],
    [0.5, 0.35],
    [-0.5, -0.35],
    [0.5, -0.35],
  ] as const) {
    const wheel = createWheel();
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.22, z);
    g.add(wheel);
  }
  return g;
}

function createMatatu(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 1.0),
    new THREE.MeshStandardMaterial({ color: 0xf6ad55, roughness: 0.55 }),
  );
  body.position.y = 0.65;
  g.add(body);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.15, 1.02),
    new THREE.MeshStandardMaterial({ color: 0x1eb88a }),
  );
  stripe.position.y = 0.65;
  g.add(stripe);
  for (const [x, z] of [
    [-0.8, 0.4],
    [0.8, 0.4],
    [-0.8, -0.4],
    [0.8, -0.4],
  ] as const) {
    const wheel = createWheel(0.28, 0.14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.28, z);
    g.add(wheel);
  }
  return g;
}

function createBoda(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }),
  );
  body.position.y = 0.45;
  g.add(body);
  const rider = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.12, 0.35, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x12856b }),
  );
  rider.position.set(0, 0.85, 0);
  g.add(rider);
  for (const [x, z] of [
    [0, 0.45],
    [0, -0.45],
  ] as const) {
    const wheel = createWheel(0.2, 0.08);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.2, z);
    g.add(wheel);
  }
  return g;
}

function makeVehicle(kind: VehicleKind): THREE.Group {
  if (kind === "matatu") return createMatatu();
  if (kind === "boda") return createBoda();
  const colors = [0xcc3333, 0x3366cc, 0xeeeeee, 0x222222];
  return createSedan(colors[Math.floor(Math.random() * colors.length)]!);
}

const KINDS: VehicleKind[] = ["sedan", "sedan", "matatu", "boda", "sedan"];

export type TrafficSystem = {
  group: THREE.Group;
  update: (delta: number) => void;
  dispose: () => void;
};

export function createTraffic(scene: THREE.Scene, count: number): TrafficSystem {
  const root = new THREE.Group();
  scene.add(root);
  const vehicles: Vehicle[] = [];

  for (let i = 0; i < count; i++) {
    const kind = KINDS[i % KINDS.length]!;
    const vehicle = makeVehicle(kind);
    const forward = i % 2 === 0;
    const curve = forward ? ROAD_FORWARD : ROAD_BACKWARD;
    const t = (i / count) % 1;
    const speed = forward ? 0.04 + (i % 3) * 0.015 : -(0.035 + (i % 3) * 0.012);

    root.add(vehicle);
    vehicles.push({ group: vehicle, curve, t, speed });
  }

  const placeVehicle = (v: Vehicle) => {
    const pt = v.curve.getPointAt(((v.t % 1) + 1) % 1);
    const tangent = v.curve.getTangentAt(((v.t % 1) + 1) % 1);
    v.group.position.copy(pt);
    v.group.position.y = 0;
    v.group.rotation.y = Math.atan2(tangent.x, tangent.z) + (v.speed < 0 ? Math.PI : 0);
  };

  for (const v of vehicles) placeVehicle(v);

  return {
    group: root,
    update: (delta: number) => {
      for (const v of vehicles) {
        v.t += v.speed * delta;
        if (v.t > 1) v.t -= 1;
        if (v.t < 0) v.t += 1;
        placeVehicle(v);
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
