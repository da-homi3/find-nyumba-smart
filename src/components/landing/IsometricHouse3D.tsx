import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "framer-motion";
import { useDeviceCapability, useMotionBudget } from "@/hooks/useDeviceCapability";

function HouseMesh() {
  const group = useRef<THREE.Group>(null);
  const materials = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#1a3d2e", roughness: 0.65, metalness: 0.1 }),
      roof: new THREE.MeshStandardMaterial({ color: "#22c55e", roughness: 0.55, metalness: 0.15 }),
      accent: new THREE.MeshStandardMaterial({ color: "#ffd54f", roughness: 0.4, metalness: 0.2 }),
      base: new THREE.MeshStandardMaterial({ color: "#0e0f14", roughness: 0.9 }),
    }),
    [],
  );

  useEffect(
    () => () => {
      materials.body.dispose();
      materials.roof.dispose();
      materials.accent.dispose();
      materials.base.dispose();
    },
    [materials],
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = state.clock.elapsedTime * 0.18;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.06;
  });

  return (
    <group ref={group} position={[0, -0.35, 0]}>
      <mesh position={[0, -0.55, 0]} material={materials.base}>
        <cylinderGeometry args={[1.35, 1.35, 0.08, 32]} />
      </mesh>
      <mesh position={[0, 0.15, 0]} material={materials.body}>
        <boxGeometry args={[1.2, 0.85, 1.05]} />
      </mesh>
      <mesh position={[0, 0.78, 0]} rotation={[0, Math.PI / 4, 0]} material={materials.roof}>
        <coneGeometry args={[0.95, 0.55, 4]} />
      </mesh>
      <mesh position={[0.55, 0.05, 0.54]} material={materials.accent}>
        <boxGeometry args={[0.22, 0.35, 0.06]} />
      </mesh>
      <mesh position={[-0.3, 0.2, 0.54]} material={materials.accent}>
        <boxGeometry args={[0.28, 0.28, 0.05]} />
      </mesh>
    </group>
  );
}

function OrbitDots({ count }: Readonly<{ count: number }>) {
  const points = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 1.55 + (i % 3) * 0.12;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = Math.sin(a * 2) * 0.25;
      positions[i * 3 + 2] = Math.sin(a) * r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.07,
      color: "#4ade80",
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.elapsedTime * 0.4;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

function HouseScene({ lite }: Readonly<{ lite: boolean }>) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 2]} intensity={1.1} color="#ecfdf5" />
      <pointLight position={[-2, 1, -1]} intensity={0.4} color="#ffd54f" />
      <HouseMesh />
      <OrbitDots count={lite ? 12 : 24} />
    </>
  );
}

function StaticHouseFallback() {
  return (
    <div
      className="relative mx-auto flex h-64 w-full max-w-sm items-end justify-center overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-950 via-background to-secondary"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_30%_20%,rgba(34,197,94,0.35),transparent_55%)]" />
      <div className="relative mb-8 flex flex-col items-center">
        <div className="h-0 w-0 border-x-[42px] border-b-[36px] border-x-transparent border-b-emerald-500" />
        <div className="flex h-20 w-[88px] items-end justify-center rounded-sm bg-emerald-900 ring-1 ring-emerald-700/60">
          <div className="mb-0 h-10 w-7 rounded-t-sm bg-amber-300/90" />
        </div>
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
    <div className="relative mx-auto h-64 w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-950/40 via-card to-secondary sm:h-72">
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

