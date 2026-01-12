import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/PointerLockControls.js";

/* ================= CONFIG ================= */
const CONFIG = {
  RADIUS: 16,
  PLAYER_HEIGHT: 1.7,
  SPEED: 0.1,
  GRAVITY: -0.015,
  JUMP: 0.32,
  WORLD_HEIGHT: 10
};

/* ================= SCENE ================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec0ff);
scene.fog = new THREE.Fog(0x7ec0ff, 20, 80);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

/* ================= LIGHT ================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(1, 2, 1);
scene.add(sun);

/* ================= CONTROLS ================= */
const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener("click", () => controls.lock());
document.addEventListener("contextmenu", e => e.preventDefault());

/* ================= INPUT ================= */
const keys = {};
const mouse = {};
addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
addEventListener("mousedown", e => mouse[e.button] = true);
addEventListener("mouseup", e => mouse[e.button] = false);

/* ================= TEXTURES ================= */
const loader = new THREE.TextureLoader();

const grassTop = loader.load("/img/Grass-top.PNG");
const grassSide = loader.load("/img/Grass.webp");
const dirtTex = loader.load("/img/dirt.webp");
const stoneTex = loader.load("/img/Stone.jpg");

const materials = {
  grass: [
    new THREE.MeshLambertMaterial({ map: grassSide }),
    new THREE.MeshLambertMaterial({ map: grassSide }),
    new THREE.MeshLambertMaterial({ map: grassTop }),
    new THREE.MeshLambertMaterial({ map: dirtTex }),
    new THREE.MeshLambertMaterial({ map: grassSide }),
    new THREE.MeshLambertMaterial({ map: grassSide })
  ],
  dirt: new THREE.MeshLambertMaterial({ map: dirtTex }),
  stone: new THREE.MeshLambertMaterial({ map: stoneTex })
};

/* ================= WORLD STORAGE ================= */
const OFFSET = 512;
const pack = (x, y, z) => `${x + OFFSET},${y + OFFSET},${z + OFFSET}`;
const unpack = k => {
  const [x, y, z] = k.split(",").map(Number);
  return { x: x - OFFSET, y: y - OFFSET, z: z - OFFSET };
};

const world = new Map();

/* ================= GENERATE WORLD ================= */
for (let x = -CONFIG.RADIUS; x < CONFIG.RADIUS; x++) {
  for (let z = -CONFIG.RADIUS; z < CONFIG.RADIUS; z++) {

    const h = Math.floor(
      Math.sin(x * 0.1) * 3 +
      Math.cos(z * 0.1) * 3 +
      CONFIG.WORLD_HEIGHT
    );

    world.set(pack(x, h, z), "grass");

    for (let y = h - 1; y >= 0; y--) {
      if (y < h - 4) world.set(pack(x, y, z), "stone");
      else world.set(pack(x, y, z), "dirt");
    }
  }
}

/* ================= BUILD MESH ================= */
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
let worldGroup;
let dirty = true;

function rebuildWorld() {
  if (worldGroup) scene.remove(worldGroup);
  worldGroup = new THREE.Group();

  const buckets = { grass: [], dirt: [], stone: [] };

  for (const [k, type] of world) {
    const { x, y, z } = unpack(k);
    if (
      !world.has(pack(x+1,y,z)) ||
      !world.has(pack(x-1,y,z)) ||
      !world.has(pack(x,y+1,z)) ||
      !world.has(pack(x,y-1,z)) ||
      !world.has(pack(x,y,z+1)) ||
      !world.has(pack(x,y,z-1))
    ) {
      buckets[type].push({ x, y, z });
    }
  }

  for (const type in buckets) {
    const blocks = buckets[type];
    if (!blocks.length) continue;

    const mesh = new THREE.InstancedMesh(
      boxGeo,
      materials[type],
      blocks.length
    );

    const m = new THREE.Matrix4();
    blocks.forEach((b, i) => {
      m.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      mesh.setMatrixAt(i, m);
    });

    worldGroup.add(mesh);
  }

  scene.add(worldGroup);
}

/* ================= RAYCAST ================= */
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2();

function getHit() {
  if (!worldGroup) return null;
  raycaster.setFromCamera(center, camera);
  return raycaster.intersectObjects(worldGroup.children, false)[0];
}

function breakBlock() {
  const hit = getHit();
  if (!hit) return;

  const normal = hit.face.normal.clone().applyMatrix3(
    new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
  );

  const p = hit.point.clone().addScaledVector(normal, -0.01).floor();
  world.delete(pack(p.x, p.y, p.z));
  dirty = true;
}

function placeBlock() {
  const hit = getHit();
  if (!hit) return;

  const normal = hit.face.normal.clone().applyMatrix3(
    new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
  );

  const p = hit.point.clone().addScaledVector(normal, 0.01).floor();
  const k = pack(p.x, p.y, p.z);

  if (!world.has(k)) {
    world.set(k, "grass");
    dirty = true;
  }
}

/* ================= PLAYER ================= */
let vy = 0;
let grounded = false;
const radius = 0.3;

function solid(x, y, z) {
  return world.has(pack(Math.floor(x), Math.floor(y), Math.floor(z)));
}
function updatePlayer() {
  const dir = new THREE.Vector3();
  controls.getDirection(dir);

  // --- Horizontal movement ---
  let dx = 0, dz = 0;
  if (keys.w) { dx += dir.x; dz += dir.z; }
  if (keys.s) { dx -= dir.x; dz -= dir.z; }
  if (keys.a) { dx += dir.z; dz -= dir.x; }
  if (keys.d) { dx -= dir.z; dz += dir.x; }

  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx = (dx / len) * CONFIG.SPEED;
    dz = (dz / len) * CONFIG.SPEED;
  }

  const px = camera.position.x;
  const py = camera.position.y - CONFIG.PLAYER_HEIGHT;
  const pz = camera.position.z;

  // X axis collision
  if (!solid(px + dx + Math.sign(dx) * radius, py, pz)) {
    camera.position.x += dx;
  }

  // Z axis collision
  if (!solid(px, py, pz + dz + Math.sign(dz) * radius)) {
    camera.position.z += dz;
  }

  // --- Gravity ---
  vy += CONFIG.GRAVITY;
  let newY = camera.position.y + vy;

  if (solid(camera.position.x, newY - CONFIG.PLAYER_HEIGHT, camera.position.z)) {
    camera.position.y = Math.floor(newY - CONFIG.PLAYER_HEIGHT) + CONFIG.PLAYER_HEIGHT + 1;
    vy = 0;
    grounded = true;
  } else {
    camera.position.y = newY;
    grounded = false;
  }

  if (mouse[2]) placeBlock();
}

addEventListener("mousedown", e => {
  if (e.button === 0) breakBlock();
});

addEventListener("keydown", e => {
  if (e.code === "Space" && grounded) {
    vy = CONFIG.JUMP;
    grounded = false;
  }
});

/* ================= START ================= */
camera.position.set(0, CONFIG.WORLD_HEIGHT + 5, 0);

function animate() {
  requestAnimationFrame(animate);
  updatePlayer();
  if (dirty) rebuildWorld(), dirty = false;
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
