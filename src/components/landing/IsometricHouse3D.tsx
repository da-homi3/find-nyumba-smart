import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { useDeviceCapability, useMotionBudget } from "@/hooks/useDeviceCapability";

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (!mat) return;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  });
}

function HouseScene({ lite }: Readonly<{ lite: boolean }>) {
  const { scene } = useThree();
  const root = useRef<THREE.Group | null>(null);
  const dots = useRef<THREE.Points | null>(null);

  useEffect(() => {
    const group = new THREE.Group();
    group.position.set(0, -0.35, 0);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#1a3d2e",
      roughness: 0.65,
      metalness: 0.1,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: "#22c55e",
      roughness: 0.55,
      metalness: 0.15,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: "#ffd54f",
      roughness: 0.4,
      metalness: 0.2,
    });
    const baseMat = new THREE.MeshStandardMaterial({ color: "#0e0f14", roughness: 0.9 });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 32), baseMat);
    base.position.set(0, -0.55, 0);
    group.add(base);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 1.05), bodyMat);
    body.position.set(0, 0.15, 0);
    group.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.55, 4), roofMat);
    roof.position.set(0, 0.78, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.06), accentMat);
    door.position.set(0.55, 0.05, 0.54);
    group.add(door);

    const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.05), accentMat);
    windowPane.position.set(-0.3, 0.2, 0.54);
    group.add(windowPane);

    const count = lite ? 12 : 24;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 1.55 + (i % 3) * 0.12;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a * 2) * 0.25;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const dotsGeo = new THREE.BufferGeometry();
    dotsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const dotsMat = new THREE.PointsMaterial({
      size: 0.07,
      color: "#4ade80",
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const points = new THREE.Points(dotsGeo, dotsMat);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xecfdf5, 1.1);
    key.position.set(3, 4, 2);
    const fill = new THREE.PointLight(0xffd54f, 0.4);
    fill.position.set(-2, 1, -1);

    scene.add(ambient, key, fill, group, points);
    root.current = group;
    dots.current = points;

    return () => {
      scene.remove(ambient, key, fill, group, points);
      disposeObject(group);
      dotsGeo.dispose();
      dotsMat.dispose();
      root.current = null;
      dots.current = null;
    };
  }, [scene, lite]);

  useFrame((state) => {
    if (root.current) {
      root.current.rotation.y = state.clock.elapsedTime * 0.18;
      root.current.position.y = -0.35 + Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
    }
    if (dots.current) {
      dots.current.rotation.y = state.clock.elapsedTime * 0.4;
    }
  });

  return null;
}

function StaticHouseFallback() {
  return (
    <div
      className="relative mx-auto flex h-64 w-full max-w-sm items-end justify-center overflow-hidden rounded-3xl border border-border bg-linear-to-br from-emerald-950 via-background to-secondary"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.35),transparent_55%)]" />
      <div className="relative mb-8 flex flex-col items-center">
        <svg width="88" height="96" viewBox="0 0 88 96" className="text-emerald-500" aria-hidden>
          <polygon points="44,4 84,40 4,40" fill="currentColor" />
          <rect x="14" y="40" width="60" height="48" rx="2" className="fill-emerald-900" />
          <rect x="36" y="58" width="16" height="30" className="fill-amber-300/90" />
        </svg>
        <div className="mt-2 h-2 w-36 rounded-full bg-foreground/15" />
      </div>
    </div>
  );
}

export function IsometricHouse3D() {
  const capable = useDeviceCapability();
  const reduceMotion = useReducedMotion();
  const budget = useMotionBudget();
  const show3d = capable && !reduceMotion;

  if (!show3d) return <StaticHouseFallback />;

  const lite = budget === "lite";

  return (
    <div className="relative mx-auto h-64 w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-linear-to-br from-emerald-950/40 via-card to-secondary sm:h-72">
      <Canvas
        camera={{ position: [2.4, 1.8, 2.8], fov: 42 }}
        dpr={lite ? [1, 1.25] : [1, 1.6]}
        gl={{
          alpha: true,
          antialias: !lite,
          powerPreference: lite ? "low-power" : "default",
          failIfMajorPerformanceCaveat: false,
        }}
      >
        <HouseScene lite={lite} />
      </Canvas>
    </div>
  );
}

export function IsometricHouse3DGate() {
  return <IsometricHouse3D />;
}
