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
const PLAYER_HEIGHT = 10; // Eye level
const MOVEMENT_SPEED = 60.0;
const MAP_SIZE = 20; // 20x20 blocks

// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 150); // Hides the "void" edge

 camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- UI ELEMENTS ---
const uiAmmo = document.getElementById('ui').children[1];
const uiHealth = document.getElementById('ui').children[0];

function updateUI() {
    uiAmmo.innerText = `AMMO: ${gameState.ammo} / ${gameState.totalAmmo}`;
    uiHealth.innerText = `HEALTH: ${gameState.health}`;
}

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// --- COLLISION WORLD DATA ---
// We store every solid block in this Set to check against later
const solidBlocks = new Set(); 

function registerBlock(x, z) {
    // Round to nearest integer coordinate to make a "grid" key
    const key = `${Math.round(x)},${Math.round(z)}`;
    solidBlocks.add(key);
}

function checkCollision(x, z) {
    // Check if the coordinate we are trying to walk into is inside the Set
    const key = `${Math.round(x / BLOCK_SIZE)},${Math.round(z / BLOCK_SIZE)}`;
    return solidBlocks.has(key);
}

// --- MAP GENERATION (SHIPMENT) ---
const textureLoader = new THREE.TextureLoader();
// Using colors instead of textures for performance on Chromebook
const matFloor = new THREE.MeshStandardMaterial({ color: 0x555555 });
const matCrate = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // Green
const matCrateRed = new THREE.MeshStandardMaterial({ color: 0x8B0000 }); // Red
const geometryBlock = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const geometryFloor = new THREE.BoxGeometry(BLOCK_SIZE, 1, BLOCK_SIZE);

function createVoxel(x, y, z, type) {
    let mesh;
    
    if (type === 'floor') {
        mesh = new THREE.Mesh(geometryFloor, matFloor);
        mesh.position.set(x * BLOCK_SIZE, -0.5, z * BLOCK_SIZE); // Lower floor slightly
    } else {
        const mat = (type === 'red') ? matCrateRed : matCrate;
        mesh = new THREE.Mesh(geometryBlock, mat);
        mesh.position.set(x * BLOCK_SIZE, (BLOCK_SIZE/2), z * BLOCK_SIZE);
        
        // Register this block as SOLID so we can't walk through it
        registerBlock(x, z);
    }

    scene.add(mesh);
    return mesh;
}

// --- SHIPMENT LEVEL LAYOUT ---
// 0 = Void/Edge, 1 = Walkable Floor, 2 = Single Crate, 3 = Double Stack, 4 = Red Container
const levelLayout = [
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // Row 1 (Wall)
    [3, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 3], // Row 2
    [3, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 3], // Row 3 (Containers)
    [3, 1, 4, 4, 1, 2, 1, 1, 1, 2, 1, 4, 4, 1, 3], 
    [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3],
    [3, 2, 1, 1, 1, 3, 3, 1, 3, 3, 1, 1, 1, 2, 3], // Middle clusters
    [3, 1, 1, 1, 1, 3, 0, 0, 0, 3, 1, 1, 1, 1, 3], // Center (0 = open cross)
    [3, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 3], 
    [3, 1, 1, 1, 1, 3, 0, 0, 0, 3, 1, 1, 1, 1, 3], 
    [3, 2, 1, 1, 1, 3, 3, 1, 3, 3, 1, 1, 1, 2, 3], 
    [3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3], 
    [3, 1, 4, 4, 1, 2, 1, 1, 1, 2, 1, 4, 4, 1, 3], 
    [3, 1, 4, 4, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1, 3],
    [3, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 3],
    [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]  // Last Wall
];

// --- MAP BUILDER ---
const BLOCK_SIZE = 5; 

function buildMap() {
    // Center the map so (0,0) is in the middle of the game
    const offset = (levelLayout.length * BLOCK_SIZE) / 2;

    for (let row = 0; row < levelLayout.length; row++) {
        for (let col = 0; col < levelLayout[row].length; col++) {
            const type = levelLayout[row][col];
            const x = (col * BLOCK_SIZE) - offset;
            const z = (row * BLOCK_SIZE) - offset;

            // ALWAYS build a floor under everything so you don't fall
            if (type !== 0) createVoxel(x/BLOCK_SIZE, 0, z/BLOCK_SIZE, 'floor');

            // Build stacks based on the number in the grid
            if (type === 2) {
                // Single Crate
                createVoxel(x/BLOCK_SIZE, 1, z/BLOCK_SIZE, 'crate');
            } 
            else if (type === 3) {
                // Double Stack (Wall)
                createVoxel(x/BLOCK_SIZE, 1, z/BLOCK_SIZE, 'crate');
                createVoxel(x/BLOCK_SIZE, 2, z/BLOCK_SIZE, 'crate');
                createVoxel(x/BLOCK_SIZE, 3, z/BLOCK_SIZE, 'crate'); // Make it 3 high so you can't jump over
            }
            else if (type === 4) {
                // Red Container
                createVoxel(x/BLOCK_SIZE, 1, z/BLOCK_SIZE, 'red');
                createVoxel(x/BLOCK_SIZE, 2, z/BLOCK_SIZE, 'red');
            }
        }
    }
}

// Run the builder
buildMap();

// --- PLAYER ---
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => instructions.style.display = 'none');
controls.addEventListener('unlock', () => instructions.style.display = 'block');

scene.add(controls.getObject());
// **Fix Spawn:** Start higher up so we don't clip, and in the center (0,0)
controls.getObject().position.set(0, PLAYER_HEIGHT, 0); 

// --- WEAPON ---
const gunGeo = new THREE.BoxGeometry(0.5, 0.5, 3);
const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const gun = new THREE.Mesh(gunGeo, gunMat);
gun.position.set(2, -1.5, -3); // Lower right of screen
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
        gameState.ammo = 30;
        gameState.totalAmmo -= 30;
        updateUI();
        // Simple reload animation (dip gun)
        gun.rotation.x = -0.5;
        setTimeout(() => gun.rotation.x = 0, 500);
    }
}

// --- SHOOTING LOGIC ---
const raycaster = new THREE.Raycaster();
document.addEventListener('mousedown', () => {
    if (!controls.isLocked || gameState.ammo <= 0) return;

    gameState.ammo--;
    updateUI();

    // Recoil
    gun.position.z += 0.5; 
    setTimeout(() => gun.position.z -= 0.5, 50);

    // Raycast center screen
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        const hit = intersects[0];
        // Create a Spark (Hit Marker) instead of changing color
        const sparkGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.copy(hit.point);
        scene.add(spark);
        
        // Remove spark after 0.2 seconds
        setTimeout(() => scene.remove(spark), 200);
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
        // 1. Gravity
        velocity.y -= 100.0 * delta; // Strong gravity

        // 2. Input Direction
        direction.z = Number(keys.w) - Number(keys.s);
        direction.x = Number(keys.d) - Number(keys.a);
        direction.normalize();

        // 3. Calculate "Desired" Move
        const speed = MOVEMENT_SPEED * delta;
        const moveX = direction.x * speed;
        const moveZ = direction.z * speed;

        // 4. COLLISION DETECTION (The Fix)
        // We predict where the player wants to go. If it's a wall, we allow 0 movement.
        const currentPos = controls.getObject().position;
        
        // Check X axis movement
        controls.moveRight(moveX);
        if (checkCollision(controls.getObject().position.x, currentPos.z)) {
            controls.moveRight(-moveX); // Undo move if hit wall
        }

        // Check Z axis movement
        controls.moveForward(moveZ); 
        // Note: moveForward uses local Z, so we need to check world position after the move
        if (checkCollision(currentPos.x, controls.getObject().position.z)) {
            controls.moveForward(-moveZ); // Undo move if hit wall
        }

        // 5. Floor Collision
        controls.getObject().position.y += (velocity.y * delta);

        if (controls.getObject().position.y < PLAYER_HEIGHT) {
            velocity.y = 0;
            controls.getObject().position.y = PLAYER_HEIGHT;
            
            if (keys.space) {
                velocity.y = 40; // Jump
            }
        }
    }

    renderer.render(scene, camera);
}

// Start
updateUI();
animate();

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
