import * as THREE from "three";

export type BuildingSlot = {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
};

export type PinSlot = {
  x: number;
  y: number;
  z: number;
  color: number;
};

/** Main arterial road — curves left to right across foreground. */
export const ROAD_FORWARD = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-28, 0, 8),
  new THREE.Vector3(-14, 0, 4),
  new THREE.Vector3(0, 0, 2),
  new THREE.Vector3(14, 0, 4),
  new THREE.Vector3(28, 0, 8),
]);

/** Oncoming lane (offset). */
export const ROAD_BACKWARD = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-28, 0, 11),
  new THREE.Vector3(-14, 0, 7),
  new THREE.Vector3(0, 0, 5),
  new THREE.Vector3(14, 0, 7),
  new THREE.Vector3(28, 0, 11),
]);

/** North sidewalk (building side). */
export const SIDEWALK_NORTH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-26, 0, -2),
  new THREE.Vector3(-12, 0, -4),
  new THREE.Vector3(2, 0, -6),
  new THREE.Vector3(16, 0, -4),
  new THREE.Vector3(26, 0, -2),
]);

/** South sidewalk (tree line side). */
export const SIDEWALK_SOUTH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-26, 0, 16),
  new THREE.Vector3(-12, 0, 14),
  new THREE.Vector3(2, 0, 12),
  new THREE.Vector3(16, 0, 14),
  new THREE.Vector3(26, 0, 16),
]);

export const BUILDING_SLOTS: BuildingSlot[] = [
  { x: -18, z: -8, width: 2.2, depth: 2.0, height: 5.5 },
  { x: -10, z: -10, width: 1.8, depth: 1.6, height: 7.2 },
  { x: -4, z: -9, width: 2.4, depth: 2.2, height: 4.8 },
  { x: 4, z: -11, width: 2.0, depth: 1.8, height: 6.5 },
  { x: 12, z: -8, width: 2.6, depth: 2.4, height: 5.0 },
  { x: 20, z: -10, width: 1.6, depth: 1.5, height: 4.2 },
  { x: -16, z: -14, width: 3.0, depth: 2.5, height: 8.0 },
  { x: 0, z: -14, width: 2.8, depth: 2.2, height: 6.8 },
  { x: 16, z: -13, width: 2.2, depth: 2.0, height: 5.5 },
];

export const PIN_SLOTS: PinSlot[] = [
  { x: -10, y: 7.5, z: -10, color: 0x12856b },
  { x: -4, y: 5.0, z: -9, color: 0x1eb88a },
  { x: 4, y: 6.8, z: -11, color: 0xf6ad55 },
  { x: 12, y: 5.5, z: -8, color: 0x12856b },
  { x: 0, y: 7.0, z: -14, color: 0x48bb78 },
];

/** Tree positions along south sidewalk outer edge. */
export function generateTreePositions(
  count: number,
): { x: number; z: number; kind: "palm" | "acacia" }[] {
  const out: { x: number; z: number; kind: "palm" | "acacia" }[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1);
    const pt = SIDEWALK_SOUTH.getPointAt(t);
    out.push({
      x: pt.x + Math.sin(i * 2.1) * 0.8,
      z: pt.z + 2.5 + Math.cos(i * 1.7) * 0.5,
      kind: i % 3 === 0 ? "acacia" : "palm",
    });
  }
  return out;
}
