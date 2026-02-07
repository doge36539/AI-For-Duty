import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const SPEED = 15.0;
const JUMP_FORCE = 15.0;
const GRAVITY = 40.0;
const MAP_SCALE = 5; // Size of each voxel block

// --- SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.Fog(0x87CEEB, 0, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// --- PLAYER CONTROLS ---
const controls = new PointerLockControls(camera, document.body);
const instructions = document.getElementById('instructions');

instructions.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => instructions.style.display = 'none');
controls.addEventListener('unlock', () => instructions.style.display = 'block');

scene.add(controls.getObject());

// --- MAP GENERATION (SHIPMENT LAYOUT) ---
// 1 = Floor, 2 = Crate (Low), 3 = Crate (High), 4 = Boundary Wall
const floorGeo = new THREE.BoxGeometry(MAP_SCALE, 1, MAP_SCALE);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555 }); // Grey concrete

const crateGeo = new THREE.BoxGeometry(MAP_SCALE, MAP_SCALE, MAP_SCALE);
const crateMat = new THREE.MeshStandardMaterial({ color: 0x3e4a2e }); // OD Green
const crateMatRed = new THREE.MeshStandardMaterial({ color: 0x8b3a3a }); // Red Container

// Helper to add a block
function addBlock(x, y, z, type) {
    let mesh;
    if (type === 'floor') {
        mesh = new THREE.Mesh(floorGeo, floorMat);
        mesh.position.set(x * MAP_SCALE, 0, z * MAP_SCALE);
    } else if (type === 'crate') {
        mesh = new THREE.Mesh(crateGeo, crateMat);
        mesh.position.set(x * MAP_SCALE, (MAP_SCALE/2) + (y * MAP_SCALE), z * MAP_SCALE);
    } else if (type === 'red_crate') {
        mesh = new THREE.Mesh(crateGeo, crateMatRed);
        mesh.position.set(x * MAP_SCALE, (MAP_SCALE/2) + (y * MAP_SCALE), z * MAP_SCALE);
    }
    
    if (mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        // Add to collision array (simple physics)
        collidableMeshList.push(mesh);
    }
}

const collidableMeshList = [];

// GENERATE SHIPMENT
const mapSize = 16;
for (let x = -mapSize; x <= mapSize; x++) {
    for (let z = -mapSize; z <= mapSize; z++) {
        // Floor everywhere
        addBlock(x, 0, z, 'floor');

        // Boundary Walls
        if (x === -mapSize || x === mapSize || z === -mapSize || z === mapSize) {
            addBlock(x, 1, z, 'crate');
            addBlock(x, 2, z, 'crate');
        }

        // Center Cross (The chaotic middle of Shipment)
        if (Math.abs(x) < 2 && Math.abs(z) < 2) continue; // Leave center empty

        // Create the 4 quadrants of crates
        if (x % 4 === 0 && z % 4 === 0 && x !== 0 && z !== 0) {
             addBlock(x, 1, z, 'red_crate'); // Red containers
             addBlock(x+1, 1, z, 'crate');
        }
    }
}

// --- WEAPON (VOXEL GUN) ---
const gunGroup = new THREE.Group();
const gunGeo = new THREE.BoxGeometry(0.5, 0.5, 2);
const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const gunMesh = new THREE.Mesh(gunGeo, gunMat);
gunMesh.position.set(1.5, -1, -2); // Position relative to camera
gunGroup.add(gunMesh);
camera.add(gunGroup); // Attach gun to camera

// --- PHYSICS VARIABLES ---
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// --- KEYBOARD LISTENERS ---
const onKeyDown = function (event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': moveRight = true; break;
        case 'Space': if (canJump === true) velocity.y += JUMP_FORCE; canJump = false; break;
    }
};

const onKeyUp = function (event) {
    switch (event.code) {
        case 'ArrowUp': case 'KeyW': moveForward = false; break;
        case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
        case 'ArrowDown': case 'KeyS': moveBackward = false; break;
        case 'ArrowRight': case 'KeyD': moveRight = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- SHOOTING ---
document.addEventListener('click', () => {
    if (!controls.isLocked) return;
    
    // Recoil animation
    gunMesh.position.z += 0.5;
    setTimeout(() => { gunMesh.position.z -= 0.5; }, 100);

    // Raycast (Shooting logic)
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) {
        // Change color of block hit (Temporary effect)
        if(intersects[0].object.material.emissive) {
            intersects[0].object.material.emissive.setHex(0xff0000);
            setTimeout(() => { intersects[0].object.material.emissive.setHex(0x000000); }, 200);
        }
    }
});


// --- GAME LOOP ---
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked === true) {
        // Friction
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 10.0 * delta; // Gravity

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * SPEED * 100.0 * delta; // Speed adjusted
        if (moveLeft || moveRight) velocity.x -= direction.x * SPEED * 100.0 * delta;

        // Apply Movement
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        // Simple Floor Collision
        if (controls.getObject().position.y < 5) { // 5 is approx eye height standing on floor
            velocity.y = 0;
            controls.getObject().position.y = 5;
            canJump = true;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

animate();

// Resize Handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
