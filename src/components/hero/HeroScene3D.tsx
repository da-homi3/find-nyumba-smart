import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionBudget } from "@/hooks/useDeviceCapability";

/** Deterministic PRNG for decorative particle layout (not crypto). */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function FloatingParticles({
  count,
  size,
  opacity,
}: Readonly<{ count: number; size: number; opacity: number }>) {
  const points = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const rnd = mulberry32(count * 9973 + 42);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rnd() - 0.5) * 12;
      positions[i * 3 + 1] = (rnd() - 0.5) * 8;
      positions[i * 3 + 2] = (rnd() - 0.5) * 6 - 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size,
      color: "#1EB88A",
      transparent: true,
      opacity,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return { geometry, material };
  }, [count, size, opacity]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.elapsedTime * 0.035;
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.2;
  });

  return <points ref={points} geometry={geometry} material={material} />;
}

function GlowOrb({
  position,
  color,
  scale = 1,
  opacity = 0.14,
}: Readonly<{
  position: [number, number, number];
  color: string;
  scale?: number;
  opacity?: number;
}>) {
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 24, 24);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return { geometry, material };
  }, [color, opacity]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.35;
  });

  return (
    <mesh
      ref={mesh}
      position={position}
      scale={scale}
      geometry={geometry}
      material={material}
    />
  );
}

function CameraRig({ intensity }: Readonly<{ intensity: number }>) {
  useFrame((state) => {
    state.camera.position.x +=
      (state.pointer.x * 0.4 * intensity - state.camera.position.x) * 0.02;
    state.camera.position.y +=
      (state.pointer.y * 0.2 * intensity - state.camera.position.y) * 0.02;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function HeroScene3D({ budget = "full" }: Readonly<{ budget?: MotionBudget }>) {
  const lite = budget === "lite";
  const particleCount = lite ? 40 : 95;
  const particleSize = lite ? 0.09 : 0.075;
  const particleOpacity = lite ? 0.82 : 0.72;
  const orbOpacity = lite ? 0.18 : 0.16;
  const backOrbScale = 2.4;

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      dpr={lite ? [1, 1.25] : [1, 1.75]}
      gl={{
        alpha: true,
        antialias: !lite,
        powerPreference: lite ? "low-power" : "default",
        failIfMajorPerformanceCaveat: false,
      }}
    >
      <CameraRig intensity={lite ? 0.35 : 1} />
      <FloatingParticles count={particleCount} size={particleSize} opacity={particleOpacity} />
      <GlowOrb position={[-3, 1, -2]} color="#1EB88A" scale={lite ? 2.1 : 2} opacity={orbOpacity} />
      <GlowOrb position={[3, -1, -3]} color="#F6AD55" scale={lite ? 1.5 : 1.4} opacity={orbOpacity} />
      <GlowOrb
        position={[0, 2, -4]}
        color="#12856B"
        scale={backOrbScale}
        opacity={orbOpacity * 0.9}
      />
    </Canvas>
  );
}
