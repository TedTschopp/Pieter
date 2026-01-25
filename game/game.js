import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/PointerLockControls.js";

/* ================= CONFIG ================= */
const CONFIG = {
    HEIGHT: 1.7,
    RADIUS: 0.3,
    SPEED: 0.19,
    GRAVITY: -0.015,
    JUMP: 0.29,
    BASE_HEIGHT: 10,
    CHUNK: 16,
    SIM: 2
};

/* ================= GAME MODES ================= */
let GAMEMODE = "survival"; // survival | creative
let FALL_MODE = "minecraft"; 
// minecraft | soft | realistic | hardcore

const PLAYER = {
    health: 20,
    maxHealth: 20,
    alive: true
};

let vy = 0;
let grounded = false;
let fallDistance = 0;

/* ================= SCENE ================= */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec0ff);
scene.fog = new THREE.Fog(0x7ec0ff, 40, 160);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.position = "fixed";
renderer.domElement.style.zIndex = "1";
document.body.appendChild(renderer.domElement);

/* ================= LIGHT ================= */
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(1, 2, 1);
scene.add(sun);

/* ================= CONTROLS ================= */
const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener("click", () => controls.lock());
document.addEventListener("contextmenu", e => e.preventDefault());

/* ================= INPUT ================= */
const keys = {};
addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

/* ================= UI — HEALTH ================= */
const healthBar = document.createElement("div");
healthBar.style.position = "fixed";
healthBar.style.top = "10px";
healthBar.style.left = "12px";
healthBar.style.fontSize = "24px";
healthBar.style.fontFamily = "monospace";
healthBar.style.color = "#ff4444";
healthBar.style.textShadow = "2px 2px 4px black";
healthBar.style.zIndex = "999999";
document.body.appendChild(healthBar);

function updateHealthUI() {
    let hearts = "";
    for (let i = 0; i < PLAYER.maxHealth; i++) {
        hearts += i < PLAYER.health ? "❤" : "♡";
    }
    healthBar.textContent = `❤ Health: ${hearts}`;
}
updateHealthUI();

/* ================= FALL MODE HUD ================= */
const fallHud = document.createElement("div");
fallHud.style.position = "fixed";
fallHud.style.top = "42px";
fallHud.style.left = "12px";
fallHud.style.fontSize = "14px";
fallHud.style.color = "white";
fallHud.style.textShadow = "1px 1px 3px black";
fallHud.style.zIndex = "999999";
document.body.appendChild(fallHud);

function updateFallHud() {
    fallHud.textContent = `Fall Mode: ${FALL_MODE.toUpperCase()}`;
}
updateFallHud();

/* ================= TOGGLES ================= */
document.addEventListener("keydown", e => {
    if (e.key === "g") {
        GAMEMODE = GAMEMODE === "creative" ? "survival" : "creative";
        alert("Mode: " + GAMEMODE.toUpperCase());
    }

    if (e.key === "f") {
        const modes = ["minecraft", "soft", "realistic", "hardcore"];
        FALL_MODE = modes[(modes.indexOf(FALL_MODE) + 1) % modes.length];
        updateFallHud();
        alert("Fall Damage Mode: " + FALL_MODE.toUpperCase());
    }
});

/* ================= TEXTURES ================= */
const loader = new THREE.TextureLoader();
const tex = {
    grassTop: loader.load("./Grass-top.PNG"),
    grassSide: loader.load("./Grass.webp"),
    dirt: loader.load("./dirt.webp"),
    stone: loader.load("./Stone.jpg")
};

Object.values(tex).forEach(t => {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
});

const MATERIALS = {
    grass: [
        new THREE.MeshLambertMaterial({ map: tex.grassSide }),
        new THREE.MeshLambertMaterial({ map: tex.grassSide }),
        new THREE.MeshLambertMaterial({ map: tex.grassTop }),
        new THREE.MeshLambertMaterial({ map: tex.dirt }),
        new THREE.MeshLambertMaterial({ map: tex.grassSide }),
        new THREE.MeshLambertMaterial({ map: tex.grassSide })
    ],
    dirt: new THREE.MeshLambertMaterial({ map: tex.dirt }),
    stone: new THREE.MeshLambertMaterial({ map: tex.stone })
};

/* ================= WORLD ================= */
const world = new Map();
const chunks = new Map();
const OFFSET = 4096;

const pack = (x, y, z) => `${x + OFFSET},${y + OFFSET},${z + OFFSET}`;
const ckey = (x, z) => `${x},${z}`;

function heightAt(x, z) {
    return Math.floor(Math.sin(x * 0.08) * 3 + Math.cos(z * 0.08) * 3 + CONFIG.BASE_HEIGHT);
}

/* ================= CHUNKS ================= */
function generateChunk(cx, cz) {
    if (chunks.has(ckey(cx, cz))) return;

    for (let x = 0; x < CONFIG.CHUNK; x++) {
        for (let z = 0; z < CONFIG.CHUNK; z++) {
            const wx = cx * CONFIG.CHUNK + x;
            const wz = cz * CONFIG.CHUNK + z;
            const h = heightAt(wx, wz);

            world.set(pack(wx, h, wz), "grass");
            for (let y = h - 1; y >= 0; y--) {
                world.set(pack(wx, y, wz), y < h - 4 ? "stone" : "dirt");
            }
        }
    }

    rebuildChunk(cx, cz);
}

function rebuildChunk(cx, cz) {
    const key = ckey(cx, cz);
    if (chunks.has(key)) scene.remove(chunks.get(key));

    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const buckets = { grass: [], dirt: [], stone: [] };

    for (const [k, t] of world) {
        const [x, y, z] = k.split(",").map(n => n - OFFSET);
        if (Math.floor(x / CONFIG.CHUNK) !== cx || Math.floor(z / CONFIG.CHUNK) !== cz) continue;
        buckets[t].push({ x, y, z });
    }

    for (const type in buckets) {
        const arr = buckets[type];
        if (!arr.length) continue;

        const mesh = new THREE.InstancedMesh(geo, MATERIALS[type], arr.length);
        const mat = new THREE.Matrix4();

        arr.forEach((b, i) => {
            mat.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5);
            mesh.setMatrixAt(i, mat);
        });

        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
    }

    scene.add(group);
    chunks.set(key, group);
}

/* ================= COLLISION ================= */
function solid(x, y, z) {
    return world.has(pack(Math.floor(x), Math.floor(y), Math.floor(z)));
}

function collides(x, y, z) {
    return solid(x, y, z) || solid(x, y + 0.9, z);
}

/* ================= FALL DAMAGE FORMULAS ================= */
function calculateFallDamage(distance) {
    if (GAMEMODE === "creative") return 0;

    if (FALL_MODE === "minecraft") {
        return Math.max(0, Math.floor(distance - 3));
    }

    if (FALL_MODE === "soft") {
        return Math.max(0, Math.floor((distance - 4) * 0.5));
    }

    if (FALL_MODE === "realistic") {
        return Math.max(0, Math.floor(distance * 0.9));
    }

    if (FALL_MODE === "hardcore") {
        return Math.max(0, Math.floor(distance * 1.5));
    }
}

/* ================= PLAYER ================= */
function updatePlayer() {
    const dir = new THREE.Vector3();
    controls.getDirection(dir);

    let dx = 0, dz = 0;
    if (keys.w) { dx += dir.x; dz += dir.z; }
    if (keys.s) { dx -= dir.x; dz -= dir.z; }
    if (keys.a) { dx += dir.z; dz -= dir.x; }
    if (keys.d) { dx -= dir.z; dz += dir.x; }

    const len = Math.hypot(dx, dz);
    if (len) {
        dx = dx / len * CONFIG.SPEED;
        dz = dz / len * CONFIG.SPEED;
    }

    const px = camera.position.x;
    const py = camera.position.y - CONFIG.HEIGHT;
    const pz = camera.position.z;
    const r = CONFIG.RADIUS;

    if (!collides(px + dx + Math.sign(dx) * r, py, pz)) camera.position.x += dx;
    if (!collides(px, py, pz + dz + Math.sign(dz) * r)) camera.position.z += dz;

    // Gravity
    vy += CONFIG.GRAVITY;

    if (!grounded) fallDistance += Math.abs(vy);

    const ny = camera.position.y + vy;

    if (solid(camera.position.x, ny - CONFIG.HEIGHT, camera.position.z)) {
        camera.position.y = Math.floor(ny - CONFIG.HEIGHT) + CONFIG.HEIGHT + 1;

        if (!grounded) {
            const dmg = calculateFallDamage(fallDistance);
            PLAYER.health -= dmg;
            updateHealthUI();
        }

        grounded = true;
        fallDistance = 0;
        vy = 0;
    } else {
        camera.position.y = ny;
        grounded = false;
    }
}

addEventListener("keydown", e => {
    if (e.code === "Space" && grounded) {
        vy = CONFIG.JUMP;
        grounded = false;
    }
});

/* ================= MOBS ================= */
const mobs = [];
const mobGeo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
const mobMat = new THREE.MeshLambertMaterial({ color: 0x884444 });

function spawnMob(x, z) {
    const mesh = new THREE.Mesh(mobGeo, mobMat);
    mesh.position.set(x, heightAt(x, z) + 1, z);
    scene.add(mesh);

    mobs.push({
        mesh,
        health: 10,
        speed: 0.02,
        cooldown: 0
    });
}

/* ================= DEATH ================= */
function killPlayer() {
    alert("You died!");
    PLAYER.health = PLAYER.maxHealth;
    camera.position.set(0, CONFIG.BASE_HEIGHT + 6, 0);
    updateHealthUI();
}

/* ================= RAYCAST ================= */
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

function getHit() {
    raycaster.setFromCamera(center, camera);
    const meshes = [];
    chunks.forEach(g => g.children.forEach(m => meshes.push(m)));
    mobs.forEach(m => meshes.push(m.mesh));
    return raycaster.intersectObjects(meshes, true)[0];
}

addEventListener("mousedown", e => {
    const hit = getHit();
    if (!hit) return;

    // Mob hit
    for (const mob of mobs) {
        if (mob.mesh === hit.object) {
            mob.health -= 5;
            if (mob.health <= 0) {
                scene.remove(mob.mesh);
                mobs.splice(mobs.indexOf(mob), 1);
            }
            return;
        }
    }

    // Block hit
    const n = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
    const p = hit.point.clone().addScaledVector(n, e.button === 0 ? -0.01 : 0.01).floor();
    const k = pack(p.x, p.y, p.z);

    if (e.button === 0) world.delete(k);
    if (e.button === 2 && !world.has(k)) world.set(k, "grass");

    rebuildChunk(Math.floor(p.x / CONFIG.CHUNK), Math.floor(p.z / CONFIG.CHUNK));
});

/* ================= MAIN LOOP ================= */
camera.position.set(0, CONFIG.BASE_HEIGHT + 6, 0);

function animate() {
    requestAnimationFrame(animate);

    updatePlayer();

    const cx = Math.floor(camera.position.x / CONFIG.CHUNK);
    const cz = Math.floor(camera.position.z / CONFIG.CHUNK);

    for (let x = -CONFIG.SIM; x <= CONFIG.SIM; x++) {
        for (let z = -CONFIG.SIM; z <= CONFIG.SIM; z++) {
            generateChunk(cx + x, cz + z);
        }
    }

    // Spawn mobs
    if (mobs.length < 5) {
        spawnMob(
            camera.position.x + Math.random() * 40 - 20,
            camera.position.z + Math.random() * 40 - 20
        );
    }

    // Mob AI
    mobs.forEach(mob => {
        const p = camera.position;
        const m = mob.mesh.position;

        const dx = p.x - m.x;
        const dz = p.z - m.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.6) {
            m.x += dx / dist * mob.speed;
            m.z += dz / dist * mob.speed;
        }

        if (dist < 1.2 && mob.cooldown <= 0 && GAMEMODE === "survival") {
            PLAYER.health -= 1;
            updateHealthUI();
            mob.cooldown = 40;
        }

        mob.cooldown--;
    });

    if (PLAYER.health <= 0) killPlayer();

    renderer.render(scene, camera);
}

animate();
