import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- GAME STATE ---
const gameState = {
    ammo: 30,
    totalAmmo: 90,
    health: 100,
    canShoot: true
};

// --- CONFIGURATION ---
const BLOCK_SIZE = 5; 
const PLAYER_HEIGHT = 9; // Eye level
const MOVEMENT_SPEED = 50.0; // Slightly slower for more control
const JUMP_FORCE = 35.0;

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky Blue
scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // Fog to hide the world edge

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Turn on shadows
document.body.appendChild(renderer.domElement);

// --- UI ELEMENTS ---
const uiAmmo = document.getElementById('ui').children[1];
const uiHealth = document.getElementById('ui').children[0];

function updateUI() {
    uiAmmo.innerText = `AMMO: ${gameState.ammo} / ${gameState.totalAmmo}`;
    uiHealth.innerText = `HEALTH: ${gameState.health}`;
}

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 200;
dirLight.shadow.mapSize.width = 2048; // High res shadows
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// --- COLLISION WORLD DATA ---
const solidBlocks = new Set(); 

function registerBlock(x, z) {
    // Round to nearest integer coordinate to make a "grid" key
    const key = `${Math.round(x)},${Math.round(z)}`;
    solidBlocks.add(key);
}

function checkCollision(x, z) {
    // Convert world position back to grid coordinates
    const gridX = Math.round(x / BLOCK_SIZE);
    const gridZ = Math.round(z / BLOCK_SIZE);
    const key = `${gridX},${gridZ}`;
    return solidBlocks.has(key);
}

// --- MATERIALS ---
const textureLoader = new THREE.TextureLoader();
const matFloor = new THREE.MeshStandardMaterial({ color: 0x555555 }); // Grey Floor
const matWall = new THREE.MeshStandardMaterial({ color: 0x2F4F4F });  // Dark Metal Outer Wall
const matCrateGreen = new THREE.MeshStandardMaterial({ color: 0x3e4a2e }); // Green Crate
const matCrateRed = new THREE.MeshStandardMaterial({ color: 0x8b3a3a });   // Red Crate

const geometryBlock = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const geometryFloor = new THREE.BoxGeometry(BLOCK_SIZE, 1, BLOCK_SIZE);

// --- MAP GENERATION (MANUAL LAYOUT) ---
// 0 = Walkable Floor
// 1 = Green Container (1 high)
// 2 = Red Container (Stacked - 2 high)
// 3 = Outer Wall (3 high - Unclimbable)
// 9 = Empty/Void

const levelLayout = [
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // Outer Wall
    [3, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 3], 
    [3, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 3], // Corner stacks
    [3, 0, 2, 2, 0, 1, 0, 1, 0, 2, 2, 0, 3], 
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], // Walking path
    [3, 1, 0, 1, 0, 2, 0, 2, 0, 1, 0, 1, 3], // Middle Mix
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], // Center Cross (Walking path)
    [3, 1, 0, 1, 0, 2, 0, 2, 0, 1, 0, 1, 3], 
    [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3], 
    [3, 0, 2, 2, 0, 1, 0, 1, 0, 2, 2, 0, 3], 
    [3, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 3], 
    [3, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 3], 
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]  // Outer Wall
];

function createVoxel(x, y, z, mat) {
    const mesh = new THREE.Mesh(geometryBlock, mat);
    mesh.position.set(x * BLOCK_SIZE, (y * BLOCK_SIZE) + (BLOCK_SIZE/2), z * BLOCK_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    
    // Add to collision registry
    registerBlock(x, z);
}

function buildMap() {
    // Calculate offset to center the map at (0,0)
    const offsetZ = Math.floor(levelLayout.length / 2);
    const offsetX = Math.floor(levelLayout[0].length / 2);

    for (let row = 0; row < levelLayout.length; row++) {
        for (let col = 0; col < levelLayout[row].length; col++) {
            const type = levelLayout[row][col];
            
            // Adjust coordinates so (0,0) is center of map
            const x = col - offsetX;
            const z = row - offsetZ;

            // 1. ALWAYS build floor first
            const floor = new THREE.Mesh(geometryFloor, matFloor);
            floor.position.set(x * BLOCK_SIZE, 0, z * BLOCK_SIZE);
            floor.receiveShadow = true;
            scene.add(floor);

            // 2. Build Objects on top
            if (type === 1) {
                // Green Crate (1 High)
                createVoxel(x, 1, z, matCrateGreen);
            } else if (type === 2) {
                // Red Stack (2 High)
                createVoxel(x, 1, z, matCrateRed);
                createVoxel(x, 2, z, matCrateRed);
            } else if (type === 3) {
                // Outer Wall (3 High - Impassable)
                createVoxel(x, 1, z, matWall);
                createVoxel(x, 2, z, matWall);
                createVoxel(x, 3, z, matWall);
            }
        }
    }
}

buildMap();

// --- PLAYER ---
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => instructions.style.display = 'none');
controls.addEventListener('unlock', () => instructions.style.display = 'block');

scene.add(controls.getObject());
// Spawn in center (safe zone)
controls.getObject().position.set(0, PLAYER_HEIGHT, 0); 

// --- WEAPON ---
const gunGeo = new THREE.BoxGeometry(0.5, 0.5, 2.5);
const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const gun = new THREE.Mesh(gunGeo, gunMat);
gun.position.set(2, -1.5, -2.5); // Gun position relative to camera
camera.add(gun);

// --- INPUTS ---
const keys = { w: false, a: false, s: false, d: false, space: false };
document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyD': keys.d = true; break;
        case 'Space': keys.space = true; break;
        case 'KeyR': reload(); break;
    }
});
document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyD': keys.d = false; break;
        case 'Space': keys.space = false; break;
    }
});

function reload() {
    if (gameState.totalAmmo > 0) {
        // Animation
        gun.rotation.x = -1;
        setTimeout(() => {
            gameState.ammo = 30;
            gameState.totalAmmo -= 30;
            updateUI();
            gun.rotation.x = 0;
        }, 1000);
    }
}

// --- SHOOTING ---
const raycaster = new THREE.Raycaster();
document.addEventListener('mousedown', () => {
    if (!controls.isLocked || gameState.ammo <= 0) return;

    gameState.ammo--;
    updateUI();

    // Visual Recoil
    gun.position.z += 0.3; 
    setTimeout(() => gun.position.z -= 0.3, 50);

    // Raycast
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const hit = intersects[0];
        
        // Spawn Spark at hit point
        const sparkGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Gold spark
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(hit.point);
        scene.add(spark);
        
        // Remove spark
        setTimeout(() => scene.remove(spark), 150);
    }
});

// --- PHYSICS LOOP ---
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;

    if (controls.isLocked) {
        // Gravity
        velocity.y -= 100.0 * delta; 

        // Input
        direction.z = Number(keys.w) - Number(keys.s);
        direction.x = Number(keys.d) - Number(keys.a);
        direction.normalize();

        const moveX = direction.x * MOVEMENT_SPEED * delta;
        const moveZ = direction.z * MOVEMENT_SPEED * delta;

        // --- X AXIS COLLISION ---
        controls.moveRight(moveX);
        const posX = controls.getObject().position.x;
        const posZ = controls.getObject().position.z;

        if (checkCollision(posX, posZ)) {
            controls.moveRight(-moveX); // Undo X move
        }

        // --- Z AXIS COLLISION ---
        controls.moveForward(moveZ);
        // Check new position after Z move
        if (checkCollision(controls.getObject().position.x, controls.getObject().position.z)) {
            controls.moveForward(-moveZ); // Undo Z move
        }

        // --- Y AXIS (Floor) ---
        controls.getObject().position.y += (velocity.y * delta);

        if (controls.getObject().position.y < PLAYER_HEIGHT) {
            velocity.y = 0;
            controls.getObject().position.y = PLAYER_HEIGHT;
            
            if (keys.space) {
                velocity.y = JUMP_FORCE;
            }
        }
    }

    renderer.render(scene, camera);
}

// Start
updateUI();
animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
