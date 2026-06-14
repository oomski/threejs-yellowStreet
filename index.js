import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";


const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 3;;
// make canvas transparent
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(w, h);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
// ensure clear color is fully transparent
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
// ensure page background is transparent
document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';

const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;

// use Vite to resolve the glb URL
// import AstronautUrl from './assets/Astronaut.glb?url';
const gltfLoader = new GLTFLoader();
// import ChinatownUrl from './assets/chinatown.glb?url';
// const chinatownGlb = await gltfLoader.loadAsync(ChinatownUrl);
const yellowStreetGlb = await gltfLoader.loadAsync(
  `${import.meta.env.BASE_URL}Day 13 - Yellow Street Things.glb`
);
const yellowStreet = yellowStreetGlb.scene;

yellowStreet.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
});

// ensure world matrices are correct before measuring
yellowStreet.updateMatrixWorld(true);

// compute bounds and scale so the model's largest dimension equals `targetSize`
let box = new THREE.Box3().setFromObject(yellowStreet);
const size = box.getSize(new THREE.Vector3());
const maxDim = Math.max(size.x, size.y, size.z);
const targetSize = 4; // world units you want the model to fit in
if (maxDim > 0) {
  const scale = targetSize / maxDim;
  yellowStreet.scale.setScalar(scale);
  yellowStreet.updateMatrixWorld(true); // update after scaling
}

// recompute bounds and get center
box = new THREE.Box3().setFromObject(yellowStreet);
const center = box.getCenter(new THREE.Vector3());

// create a pivot at the world origin and add the model offset so its center is at pivot
const pivot = new THREE.Group();
scene.add(pivot);
yellowStreet.position.sub(center); // move model so its center is at (0,0,0) relative to pivot
pivot.add(yellowStreet);

// start rotated 270 degrees around Y
pivot.rotation.y = 3 * Math.PI / 2.2; // 270deg
pivot.rotation.x = -0.1

// bounce setup: 180° total (min = 270° - 180° = 90°, max = 270°)
const clock = new THREE.Clock();
const rotationSpeed = 0.3; // radians per second (~0.005 per frame at 60fps)
const startAngle = pivot.rotation.y; // 270deg
const fullRange = 0.8 * Math.PI; // 180° in radians
const minAngle = startAngle - fullRange; // 90deg
const maxAngle = startAngle; // 270deg
let rotationDirection = -1; // start moving away from 270° in the same direction as before

// update controls target to the pivot center
ctrls.target.set(0, 0, 0);
ctrls.update();

// stop / resume auto-rotation on pointer press/release
let isRotating = true;
const canvas = renderer.domElement;

// stop rotation while pointer is down on the canvas
canvas.addEventListener('pointerdown', () => {
  isRotating = false;
}, { passive: true });

// resume rotation when pointer is released
canvas.addEventListener('pointerup', () => {
  isRotating = true;
}, { passive: true });

// handle cancel/leave to ensure rotation resumes
canvas.addEventListener('pointercancel', () => { isRotating = true; }, { passive: true });
canvas.addEventListener('pointerout', () => { isRotating = true; }, { passive: true });
canvas.addEventListener('pointerleave', () => { isRotating = true; }, { passive: true });

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({
  color: 0xffff00,
});
const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 0.5);
scene.add(hemiLight);
// add ambient fill light (no directional light)
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

// Sprites BG
// const gradientBackground = getLayer({
//   hue: 0.5,
//   numSprites: 8,
//   opacity: 0.2,
//   radius: 10,
//   size: 24,
//   z: -15.5,
// });
// scene.add(gradientBackground);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // bounce between minAngle and maxAngle when allowed
  if (isRotating) {
    pivot.rotation.y += rotationDirection * rotationSpeed * delta;

    if (pivot.rotation.y <= minAngle) {
      pivot.rotation.y = minAngle;
      rotationDirection = 1;
    } else if (pivot.rotation.y >= maxAngle) {
      pivot.rotation.y = maxAngle;
      rotationDirection = -1;
    }
  }

  // update controls (damping) before render
  ctrls.update();
  renderer.render(scene, camera);
}

animate();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);