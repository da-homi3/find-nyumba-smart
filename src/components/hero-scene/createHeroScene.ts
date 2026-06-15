import * as THREE from "three";
import { getHeroSceneBudget, targetFps } from "@/lib/motion/performance";
import { createBackdrop } from "./backdrop";
import { createBuildings } from "./buildings";
import { createInteraction, raycastPins } from "./interaction";
import { createListingPins } from "./listing-pins";
import { addSceneLighting } from "./lighting";
import { createPedestrians } from "./pedestrians";
import { createTerrain } from "./terrain";
import { createTraffic } from "./traffic";
import { createVegetation } from "./vegetation";

export type HeroSceneHandle = {
  dispose: () => void;
};

export async function createHeroScene(
  canvas: HTMLCanvasElement,
  backdropUrl: string,
): Promise<HeroSceneHandle> {
  const budget = getHeroSceneBudget();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const setSize = () => {
    const w = canvas.parentElement?.clientWidth ?? globalThis.innerWidth;
    const h = canvas.parentElement?.clientHeight ?? globalThis.innerHeight;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2));
  };
  setSize();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a5c47, 0.006);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(0, 14, 32);
  camera.lookAt(0, 3, 0);

  const lighting = addSceneLighting(scene);
  const terrain = createTerrain(scene);
  const buildings = createBuildings(scene);
  const vegetation = createVegetation(scene, budget.trees);
  const traffic = createTraffic(scene, budget.cars);
  const pedestrians = createPedestrians(scene, budget.peds);
  const pins = createListingPins(scene);
  const interaction = createInteraction();

  let backdropDispose: (() => void) | null = null;
  try {
    const backdrop = await createBackdrop(scene, backdropUrl);
    backdropDispose = backdrop.dispose;
  } catch (err) {
    console.warn("[hero-scene] backdrop load failed:", err);
  }

  const pointer = new THREE.Vector2();
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    interaction.state.mouseX = pointer.x;
    interaction.state.mouseY = pointer.y;
    interaction.state.hoveredPinIndex = raycastPins(
      interaction.raycaster,
      camera,
      pointer,
      pins.heads,
    );
  };

  canvas.addEventListener("pointermove", onPointerMove);

  const fps = targetFps();
  let frameId = 0;
  let lastFrame = 0;
  let lastTime = performance.now();
  const baseCamX = 0;
  const baseCamZ = 32;
  const baseCamY = 14;

  const animate = (timestamp: number) => {
    frameId = requestAnimationFrame(animate);
    if (timestamp - lastFrame < 1000 / fps) return;
    const delta = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;
    lastFrame = timestamp;

    const time = timestamp / 1000;

    // Subtle cinematic drift
    camera.position.x = baseCamX + Math.sin(time * 0.08) * 1.5 + interaction.state.mouseX * 0.8;
    camera.position.y = baseCamY + interaction.state.mouseY * 0.4;
    camera.position.z = baseCamZ + Math.cos(time * 0.06) * 0.8;
    interaction.applyParallax(camera);

    terrain.update(time);
    buildings.update(time);
    vegetation.update(time);
    traffic.update(delta);
    pedestrians.update(delta);
    pins.update(time, interaction.state.hoveredPinIndex);

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

  return {
    dispose: () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointermove", onPointerMove);
      ro.disconnect();
      globalThis.removeEventListener("resize", setSize);
      terrain.dispose();
      buildings.dispose();
      vegetation.dispose();
      traffic.dispose();
      pedestrians.dispose();
      pins.dispose();
      lighting.dispose();
      backdropDispose?.();
      interaction.dispose();
      renderer.dispose();
    },
  };
}
