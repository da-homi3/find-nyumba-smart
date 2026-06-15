import * as THREE from "three";

export function createBackdrop(
  scene: THREE.Scene,
  imageUrl: string,
): Promise<{ mesh: THREE.Mesh; dispose: () => void }> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const aspect = texture.image
          ? (texture.image as HTMLImageElement).width / (texture.image as HTMLImageElement).height
          : 1.5;
        const h = 55;
        const w = h * aspect;
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.85 }),
        );
        mesh.position.set(0, 18, -32);
        scene.add(mesh);
        resolve({
          mesh,
          dispose: () => {
            texture.dispose();
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            scene.remove(mesh);
          },
        });
      },
      undefined,
      reject,
    );
  });
}
