import './style.css';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- Escena y Renderer ---
const canvas = document.querySelector('canvas.webgl')!;
const scene = new THREE.Scene();
// Obtener el elemento de video del HTML
const videoElement = document.getElementById('background-video') as HTMLVideoElement;

if (videoElement) {
    // Crear una textura a partir del video
    videoElement.play().catch(error => {
        console.warn("El video no pudo iniciarse automáticamente. Se requiere interacción del usuario.", error);
    });    
    const videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.colorSpace = THREE.SRGBColorSpace; // Corrección de color importante
    videoTexture.needsUpdate = true; // <<-- AÑADIR ESTA LÍNEA
    // Usar la textura del video como fondo de la escena
    scene.background = videoTexture;    
} else {
    // Si el video no se encuentra, usar un color de respaldo
    scene.background = new THREE.Color('#a8e6cf');
    console.warn('Elemento de video #background-video no encontrado. Usando color de fondo de respaldo.');
}
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 3;
scene.add(camera);

const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- Objetos de la Escena ---
const textureLoader = new THREE.TextureLoader();

// Foto de perfil (con efecto CRT)
const profileTexture = textureLoader.load('/profile.png');

// 1. Definimos los "uniforms" para nuestro shader.
// Estos son los parámetros que podemos pasar desde JavaScript al shader.
const crtUniforms = {
    tDiffuse: { value: profileTexture }, // La textura de la foto
    time: { value: 0.0 }, // Un contador de tiempo para la animación
    scanlineIntensity: { value: 0.3 }, // Qué tan oscuras son las líneas
    scanlineCount: { value: 400.0 } // Cuántas líneas hay
};

// 2. Creamos el nuevo material con nuestro shader personalizado.
const crtMaterial = new THREE.ShaderMaterial({
    uniforms: crtUniforms,
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float scanlineIntensity;
        uniform float scanlineCount;
        varying vec2 vUv;

        void main() {
            // Obtener el color original de la textura
            vec4 color = texture2D(tDiffuse, vUv);
            // ATENUAR EL BRILLO GENERAL DE LA IMAGEN
            color.rgb *= 0.72; // <<-- AÑADIR ESTA LÍNEA
            // Calcular la intensidad de la línea de escaneo
            float scanline = sin(vUv.y * scanlineCount + time) * scanlineIntensity;
            color.rgb -= scanline;

            // Añadir un poco de ruido animado
            float noise = (fract(sin(dot(vUv, vec2(12.9898, 78.233)) + time) * 43758.5453) - 0.5) * 0.15;
            color.rgb += noise;

            // Efecto Vignette para oscurecer los bordes
            float vignette = smoothstep(0.8, 0.4, length(vUv - 0.5));
            color.rgb *= vignette;

            gl_FragColor = color;
        }
    `
});

const profileMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    crtMaterial // <-- 3. Usamos el nuevo material
);
scene.add(profileMesh);

// Borde (brilla)
const borderMesh = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.2, 64),
    new THREE.MeshBasicMaterial({ color: 0xbbbbbb, side: THREE.DoubleSide }) // <-- Blanco brillante
);
scene.add(borderMesh);

// Texto de bienvenida (brilla)
const fontLoader = new FontLoader();
let welcomeText: THREE.Mesh | null = null;
fontLoader.load('/fonts/helvetiker_regular.typeface.json', (font) => {
    const textGeometry = new TextGeometry('Bienvenido', {
        font: font, size: 0.5, depth: 0.01, curveSegments: 12, bevelEnabled: false
    });
    textGeometry.center();
    const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // <-- Blanco brillante
    welcomeText = new THREE.Mesh(textGeometry, textMaterial);
    welcomeText.visible = false;
    scene.add(welcomeText);
});

// --- Post-Procesamiento (Método Simplificado) ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(sizes.width, sizes.height),
    0.3,  // strength: La intensidad del brillo
    0.5,  // radius: Qué tan difuminado es el brillo
    0.9   // threshold: Qué tan "brillante" debe ser un píxel para empezar a brillar
);
composer.addPass(bloomPass);

// --- Interacción y Animación (Método HTML) ---
const welcomeElement = document.getElementById('welcome-text');
let hasBeenClicked = false; // <-- 1. NUEVA VARIABLE DE ESTADO
if (welcomeElement) {
    setTimeout(() => {
        welcomeElement.classList.add('animated-text');
    }, 100); // Un pequeño retardo es suficiente
}
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    // Actualizar el raycaster y comprobar la intersección
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(profileMesh);

    if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }    
});
window.addEventListener('click', (event) => {
    if (hasBeenClicked) {
        return;
    }  
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([profileMesh]);

    // Usamos encadenamiento opcional (?.) para evitar la advertencia de "null"
    if (intersects.length > 0 && !welcomeElement?.classList.contains('visible')) {
        hasBeenClicked = true; // <-- 3. MARCAR COMO CLICKEADO
        showWelcomeAnimation();
    }
});

function showWelcomeAnimation() {
    if (!welcomeElement) return;

    // 1. Quitar la clase de desaparición (si la tuviera) y añadir la de aparición
    welcomeElement.classList.remove('disappearing');
    welcomeElement.classList.add('visible');

    // 2. Esperar 3 segundos
    setTimeout(() => {
        // 3. Quitar la clase de aparición y añadir la de desaparición
        welcomeElement.classList.remove('visible');
        welcomeElement.classList.add('disappearing');
    }, 3000);
}

const clock = new THREE.Clock();

function tick() {
    const elapsedTime = clock.getElapsedTime();
    borderMesh.rotation.z = -elapsedTime * 0.5;
    crtUniforms.time.value = elapsedTime;
    // Forzar la actualización del fondo en cada fotograma
    if (scene.background instanceof THREE.VideoTexture) {        scene.background.needsUpdate = true;
    }        
    composer.render(); // Usamos el composer para renderizar
    requestAnimationFrame(tick);
}

tick();
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    composer.setSize(sizes.width, sizes.height);
});