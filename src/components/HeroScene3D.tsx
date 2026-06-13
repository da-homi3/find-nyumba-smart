import * as THREE from "three";
import { useEffect, useRef } from "react";
import {
  isMobileViewport,
  prefersReducedMotion,
  shouldUseHeavy3D,
  targetFps,
} from "@/lib/motion/performance";

export function HeroScene3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldUseHeavy3D()) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const setSize = () => {
      const w = canvas.parentElement?.clientWidth ?? globalThis.innerWidth;
      const h = canvas.parentElement?.clientHeight ?? globalThis.innerHeight;
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
    };
    setSize();
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a5c47, 0.008);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 25, 40);
    camera.lookAt(0, 0, 0);

    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, isMobileViewport() ? 20 : 50, isMobileViewport() ? 20 : 50),
      new THREE.MeshStandardMaterial({
        color: 0x0d1a14,
        roughness: 0.9,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    grid.rotation.x = -Math.PI / 2;
    grid.receiveShadow = true;
    scene.add(grid);

    const gridHelper = new THREE.GridHelper(100, 50, 0x1eb88a, 0x0f2d1e);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const buildingPositions: [number, number, number][] = [
      [-8, 3, -10],
      [-5, 6, -8],
      [-2, 4, -12],
      [3, 8, -9],
      [6, 5, -11],
      [10, 3, -7],
      [-12, 2, -5],
      [-9, 4, -3],
      [8, 6, -5],
      [12, 3, -3],
      [-6, 2, 2],
      [-3, 5, 0],
      [1, 3, 3],
      [5, 7, 1],
      [9, 4, 4],
    ];
    const pinHeads: THREE.Mesh[] = [];
    const pulseRings: THREE.Mesh[] = [];

    for (const [x, h, z] of buildingPositions) {
      const w = 0.8 + Math.random() * 0.8;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, w),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.42, 0.3, 0.08 + Math.random() * 0.08),
          roughness: 0.7,
          metalness: 0.3,
        }),
      );
      building.position.set(x, h / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
    }

    const pinPositions = [
      { x: -8, z: -8, color: 0x12856b },
      { x: 4, z: -6, color: 0xf6ad55 },
      { x: -2, z: 2, color: 0x12856b },
      { x: 9, z: 0, color: 0x12856b },
      { x: -12, z: 4, color: 0x48bb78 },
    ];

    for (const { x, z, color } of pinPositions) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 2, 8),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }),
      );
      stem.position.set(x, 1, z);
      scene.add(stem);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.9,
        }),
      );
      head.position.set(x, 2.2, z);
      scene.add(head);
      pinHeads.push(head);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.5, 32),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, z);
      scene.add(ring);
      pulseRings.push(ring);
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const sunLight = new THREE.DirectionalLight(0xffd4a3, 1.5);
    sunLight.position.set(20, 30, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);
    const greenFill = new THREE.PointLight(0x1eb88a, 0.8, 50);
    greenFill.position.set(-10, 10, 0);
    scene.add(greenFill);

    const particleCount = isMobileViewport() ? 100 : 300;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeom,
      new THREE.PointsMaterial({
        color: 0x1eb88a,
        size: 0.15,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      }),
    );
    scene.add(particles);

    const fps = targetFps();
    let frameId = 0;
    let lastFrame = 0;
    const startedAt = performance.now();

    const animate = (timestamp: number) => {
      frameId = requestAnimationFrame(animate);
      if (timestamp - lastFrame < 1000 / fps) return;
      lastFrame = timestamp;

      const t = (performance.now() - startedAt) / 1000;
      camera.position.x = Math.sin(t * 0.05) * 40;
      camera.position.z = Math.cos(t * 0.05) * 40;
      camera.lookAt(0, 0, 0);

      for (const head of pinHeads) {
        const s = 1 + 0.15 * Math.sin(t * 2 + head.position.x);
        head.scale.setScalar(s);
      }
      for (const ring of pulseRings) {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const scale = 1 + ((t * 0.5) % 2);
        ring.scale.setScalar(scale);
        mat.opacity = Math.max(0, 0.5 - ((t * 0.25) % 1));
      }
      particles.rotation.y = t * 0.02;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    };
    animate(0);

    const ro = new ResizeObserver(setSize);
    ro.observe(canvas.parentElement ?? canvas);
    globalThis.addEventListener("resize", setSize);

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      globalThis.removeEventListener("resize", setSize);
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose();
        }
      });
      particleGeom.dispose();
      renderer.dispose();
    };
  }, []);

  if (prefersReducedMotion() || !shouldUseHeavy3D()) return null;

  return (
    <div className="absolute inset-0 h-full w-full" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
