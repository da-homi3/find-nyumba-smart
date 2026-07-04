import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";

function FloatingParticles({ count = 60 }: Readonly<{ count?: number }>) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    if (!points.current) return;
    points.current.rotation.y = state.clock.elapsedTime * 0.02;
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#1EB88A" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function GlowOrb({
  position,
  color,
  scale = 1,
}: Readonly<{ position: [number, number, number]; color: string; scale?: number }>) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[0]) * 0.3;
  });
  return (
    <mesh ref={mesh} position={position} scale={scale}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.06} />
    </mesh>
  );
}

function CameraRig() {
  useFrame((state) => {
    state.camera.position.x += (state.pointer.x * 0.4 - state.camera.position.x) * 0.02;
    state.camera.position.y += (state.pointer.y * 0.2 - state.camera.position.y) * 0.02;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export function HeroScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      gl={{ alpha: true, antialias: true }}
    >
      <CameraRig />
      <FloatingParticles count={70} />
      <GlowOrb position={[-3, 1, -2]} color="#1EB88A" scale={1.8} />
      <GlowOrb position={[3, -1, -3]} color="#F6AD55" scale={1.2} />
      <GlowOrb position={[0, 2, -4]} color="#12856B" scale={2.2} />
    </Canvas>
  );
}
