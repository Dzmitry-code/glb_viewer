import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// -------- Renderer / Scene / Camera --------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(2.5, 1.5, 3.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x334466, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(3, 5, 3);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
//scene.add(dir);

// Shadow plane
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.ShadowMaterial({ opacity: 0.2 })
);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// -------- Loaders --------
const manager = new THREE.LoadingManager();
const loader = new GLTFLoader(manager);

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
draco.setCrossOrigin('anonymous');
loader.setDRACOLoader(draco);

const ktx2 = new KTX2Loader();
ktx2.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/basis/');
ktx2.detectSupport(renderer);
loader.setKTX2Loader(ktx2);

// Progress UI
const bar = document.getElementById('bar');
manager.onProgress = (url, loaded, total) => {
  const pct = total ? (loaded / total) * 100 : 0;
  bar.style.width = `${pct.toFixed(1)}%`;
};
manager.onLoad = () => { setTimeout(() => (bar.style.width = '0%'), 400); };

const meta = document.getElementById('meta');

// -------- HDRI switching --------
const envSelect = document.getElementById('envSelect');
const showBg = document.getElementById('showBg');
const envIntensity = document.getElementById('envIntensity');

const HDRI_PRESETS = {
  none: null,
  studio: 'assets/studio1.hdr',
  sunset: 'assets/studio2.hdr',
  neutral: 'assets/studio3.hdr',
};

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const rgbe = new RGBELoader();

// Cache env maps so switching is instant
const envCache = new Map(); // name -> { envRT, envMap }
let currentEnvName = 'none';

function loadHDRI(url) {
  return new Promise((resolve, reject) => {
    rgbe.load(url, (hdrTex) => {
      hdrTex.mapping = THREE.EquirectangularReflectionMapping;
      const envRT = pmrem.fromEquirectangular(hdrTex);
      const envMap = envRT.texture;
      hdrTex.dispose();
      resolve({ envRT, envMap });
    }, undefined, reject);
  });
}

async function setEnvironment(name) {
  if (name === currentEnvName) return;
  currentEnvName = name;

  const url = HDRI_PRESETS[name];
  if (!url) {
    scene.environment = null;
    scene.background = new THREE.Color(0x0b0f14);
    updateEnvIntensity();
    return;
  }

  let entry = envCache.get(name);
  if (!entry) {
    try {
      entry = await loadHDRI(url);
      envCache.set(name, entry);
    } catch (e) {
      console.error('HDR load error:', e);
      meta.textContent = 'HDR load error: ' + (e?.message || e);
      return;
    }
  }

  scene.environment = entry.envMap;
  scene.background = showBg.checked ? entry.envMap : new THREE.Color(0x0b0f14);
  updateEnvIntensity();
}

function updateEnvIntensity() {
  const val = parseFloat(envIntensity.value);
  if (!current) return;
  current.traverse(o => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        if ('envMapIntensity' in m) m.envMapIntensity = val;
      });
    }
  });
}

// UI hooks
envSelect?.addEventListener('change', () => setEnvironment(envSelect.value));
showBg?.addEventListener('change', () => setEnvironment(envSelect.value));
envIntensity?.addEventListener('input', updateEnvIntensity);


// -------- Helpers --------
function disposeCurrent() {
  if (current) {
    scene.remove(current);
    current.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            for (const key in m) {
              const val = m[key];
              if (val && val.isTexture) val.dispose();
            }
            m.dispose?.();
          });
        }
      }
    });
    current = null;
  }
}

function fitCameraToObject(obj, fitOffset = 1.2) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxSize = Math.max(size.x, size.y, size.z);
  const fitHeightDistance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = fitOffset * Math.max(fitHeightDistance, fitWidthDistance);

  const dir = controls.target.clone()
    .sub(camera.position)
    .normalize()
    .multiplyScalar(distance);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  camera.position.copy(center);
  camera.position.x += distance;
  camera.position.y += distance * 0.5;
  camera.position.z += distance;
  controls.target.copy(center);
  controls.update();
}

function summarize(obj) {
  let tris = 0;
  obj.traverse(o => {
    if (o.isMesh && o.geometry) {
      const geom = o.geometry;
      if (geom.index) tris += geom.index.count / 3;
      else tris += geom.attributes.position.count / 3;
    }
  });
  return { triangles: Math.round(tris).toLocaleString() };
}

// -------- Load function --------
let current = null;

async function loadModel(url) {
  disposeCurrent();
  try {
    const gltf = await loader.loadAsync(url);
    current = gltf.scene;
    current.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(current);
    fitCameraToObject(current, 1.3);
    const info = summarize(current);
    
    updateEnvIntensity();
    console.log('GLTF loaded', gltf);
  } catch (err) {
    console.error('Failed to load model:', err);
    meta.textContent = 'Error: ' + (err?.message || err);
  }
}

// -------- File input & drag/drop --------
const fileInput = document.getElementById('file');
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadModel(url).then(() => URL.revokeObjectURL(url));
});

const drop = document.getElementById('drop');
['dragenter','dragover'].forEach(evt => {
  window.addEventListener(evt, e => { e.preventDefault(); drop.style.display = 'grid'; });
});
['dragleave','drop'].forEach(evt => {
  window.addEventListener(evt, e => { e.preventDefault(); drop.style.display = 'none'; });
});
window.addEventListener('drop', e => {
  e.stopPropagation();
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  loadModel(url).then(() => URL.revokeObjectURL(url));
});

// Default loader & URL param
document.getElementById('openDefault').addEventListener('click', e => {
  e.preventDefault();
  loadModel('assets/model.glb');
});

const params = new URLSearchParams(location.search);
const startUrl = params.get('model') || 'assets/model.glb';
// Attempt load default, ignore errors to allow user to drag & drop:
loadModel(startUrl).catch(() => {
  meta.textContent = 'Place your model at assets/model.glb or use ?model=...';
});

// Initialize default environment
setEnvironment('studio');
envSelect.value = 'studio';

// -------- Render loop --------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
