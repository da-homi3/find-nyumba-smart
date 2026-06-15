import * as THREE from "three";
import { ROAD_BACKWARD, ROAD_FORWARD } from "./nairobi-layout";

const GRASS_VERT = `
  varying vec2 vUv;
  varying float vFade;
  varying float vWorldZ;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float wave = sin(uTime * 1.2 + pos.x * 0.4 + pos.z * 0.3) * 0.08;
    pos.y += wave;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldZ = worldPos.z;
    vFade = smoothstep(-18.0, 8.0, worldPos.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const GRASS_FRAG = `
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vec3 base = mix(vec3(0.10, 0.30, 0.18), vec3(0.18, 0.42, 0.28), vUv.y);
    float alpha = vFade * 0.88;
    gl_FragColor = vec4(base, alpha);
  }
`;

export type TerrainSystem = {
  grassMaterial: THREE.ShaderMaterial;
  update: (time: number) => void;
  dispose: () => void;
};

function createRoadMesh(curve: THREE.CatmullRomCurve3, width: number, color: number): THREE.Mesh {
  const points = curve.getPoints(64);
  const geom = new THREE.BufferGeometry();
  const verts: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1);
    const pt = points[i]!;
    const tangent = curve.getTangentAt(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
    const left = pt.clone().add(side);
    const right = pt.clone().sub(side);
    verts.push(left.x, 0.02, left.z, right.x, 0.02, right.z);
    if (i > 0) {
      const base = i * 2;
      indices.push(base - 2, base - 1, base, base - 1, base + 1, base);
    }
  }

  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function createDashedCenterline(curve: THREE.CatmullRomCurve3): THREE.InstancedMesh {
  const count = 40;
  const geom = new THREE.PlaneGeometry(0.15, 0.8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    dummy.position.set(pt.x, 0.04, pt.z);
    dummy.rotation.y = Math.atan2(tangent.x, tangent.z);
    dummy.rotation.x = -Math.PI / 2;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createTerrain(scene: THREE.Scene): TerrainSystem {
  const grassMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
  });

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(70, 35, 32, 16), grassMaterial);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0, 4);
  grass.receiveShadow = true;
  scene.add(grass);

  const roadForward = createRoadMesh(ROAD_FORWARD, 5.5, 0x2a2a2a);
  const roadBackward = createRoadMesh(ROAD_BACKWARD, 5.5, 0x252525);
  scene.add(roadForward, roadBackward);

  const centerLine = createDashedCenterline(ROAD_FORWARD);
  scene.add(centerLine);

  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.9 });
  for (const [z, w] of [
    [-5, 3],
    [15, 3],
  ] as const) {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(58, w), sidewalkMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(0, 0.015, z);
    sw.receiveShadow = true;
    scene.add(sw);
  }

  const disposables: THREE.Object3D[] = [grass, roadForward, roadBackward, centerLine];

  return {
    grassMaterial,
    update: (time: number) => {
      grassMaterial.uniforms.uTime!.value = time;
    },
    dispose: () => {
      for (const obj of disposables) {
        scene.remove(obj);
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      }
      grassMaterial.dispose();
    },
  };
}
