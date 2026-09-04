// Entry point for the avatar/character component sandbox.
// Build the component here, in isolation from blackjack-pwa. Once it's
// solid, port this src/ tree into blackjack-pwa/ui/ (same TS + Vite
// tooling, so it should be a near-direct drop-in) and wire it up there.

import * as THREE from "three";

const container = document.getElementById("app");
if (!container) {
  throw new Error("#app container not found");
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 1.5, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(2, 4, 3);
scene.add(light, new THREE.AmbientLight(0xffffff, 0.4));

// Placeholder mesh — swap for the actual character rig/model.
const placeholder = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.4, 1, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0x4f8ef7 }),
);
scene.add(placeholder);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tick(): void {
  placeholder.rotation.y += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
