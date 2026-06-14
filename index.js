import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";


const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 4;
// make canvas transparent
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(w, h);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .5;
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

// start rotated ~270 degrees around Y and a slight X tilt
pivot.rotation.y = 4 * Math.PI / 2; // ~270deg
pivot.rotation.x = -0.1;

// continuous spin setup
const clock = new THREE.Clock();
const spinSpeed = 0.5; // radians per second (adjust to taste)

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

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 2.5); // slightly stronger
scene.add(hemiLight);
// add ambient fill light (no directional light)
const ambient = new THREE.AmbientLight(0xffffff, 0.7); // slightly stronger
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

// Saturation post-process shader + composer (increase scene saturation)
const SaturationShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.3 } // >1 increases saturation (adjust to taste)
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float l = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 rgb = mix(vec3(l), color.rgb, saturation);
      gl_FragColor = vec4(rgb, color.a);
    }
  `
};

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const saturationPass = new ShaderPass(SaturationShader);
saturationPass.uniforms['saturation'].value = 1.3; // tweak here
composer.addPass(saturationPass);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // continuous spin around the pivot (which is the model's center)
  if (isRotating) {
    pivot.rotation.y += spinSpeed * delta;

    // keep the rotation value bounded to avoid large numbers accumulating
    if (pivot.rotation.y > Math.PI * 2) pivot.rotation.y -= Math.PI * 2;
    if (pivot.rotation.y < -Math.PI * 2) pivot.rotation.y += Math.PI * 2;
  }

  // update controls (damping) before render
  ctrls.update();
  // render via composer so saturation pass is applied
  composer.render();
}

animate();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);