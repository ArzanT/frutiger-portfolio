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
// Preparamos los arreglos para soportar hasta 5 clics al mismo tiempo
const MAX_RIPPLES = 5;
const initialPositions = [];
const initialTimes = [];
for (let i = 0; i < MAX_RIPPLES; i++) {
    initialPositions.push(new THREE.Vector2(0.5, 0.5));
    initialTimes.push(999.0); // Empezamos en 999 para que el shader las ignore al inicio
}

const waterUniforms = {
    tDiffuse: { value: profileTexture },
    time: { value: 0.0 },
    clickPositions: { value: initialPositions },
    clickTimes: { value: initialTimes }
};

const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
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
        uniform vec2 clickPositions[5]; // Arreglo de posiciones
        uniform float clickTimes[5];    // Arreglo de tiempos
        varying vec2 vUv;

        void main() {
            vec2 uv = vUv;
            
            // Efecto de ondulación base suave
            float wave = sin(uv.y * 5.0 + time * 0.5) * 0.0095;
            uv.x += wave;
            
            // Iterar sobre los posibles clics
            for(int i = 0; i < 5; i++) {
                float cTime = clickTimes[i];
                
                // Si el tiempo de esta onda es menor a 1.0 segundo, la dibujamos
                if (cTime < 1.0) {
                    vec2 center = clickPositions[i];
                    float dist = distance(uv, center);
                    
                    // --- CONTROL DE DEFORMACIÓN ---
                    // Reducimos la amplitud a 0.008 (antes era 0.015) para no deformar tu rostro.
                    // Multiplicamos por (1.0 - cTime) para que el efecto se desvanezca suavemente.
                    float amplitude = 0.015 * (1.0 - cTime);
                    float ripple = sin(dist * 80.0 - cTime * 20.0) * amplitude;
                    
                    // Creamos un anillo expansivo (dona) donde ocurre la onda
                    float innerRadius = cTime * 0.6 - 0.1;
                    float outerRadius = cTime * 0.6 + 0.1;
                    float mask = smoothstep(innerRadius, innerRadius + 0.05, dist) * (1.0 - smoothstep(outerRadius - 0.05, outerRadius, dist));
                    
                    uv += vec2(ripple * mask);
                }
            }

            // Obtener color con los UVs distorsionados
            vec4 color = texture2D(tDiffuse, uv);
            
            // Iluminación ajustada
            color.rgb *= vec3(0.9, 0.969, 1.15);            
            gl_FragColor = color;
        }
    `
});

const profileMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    waterMaterial // <-- 3. Usamos el nuevo material
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
if (welcomeElement) {
    setTimeout(() => {
        welcomeElement.classList.add('animated-text');
    }, 100); // Un pequeño retardo es suficiente
}
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 1. NUEVO: Evento para cambiar el cursor a una manito
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    if (profileMesh.visible) {
        const intersects = raycaster.intersectObject(profileMesh);
        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    } else {
        document.body.style.cursor = 'default';
    }
});

// 2. ÚNICO Evento Click para la foto 3D
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // Solo interactuar si la foto está visible
    if (profileMesh.visible) {
        const intersects = raycaster.intersectObjects([profileMesh]);

        if (intersects.length > 0) {
            const clickUV = intersects[0].uv;
            if (clickUV) {
                for (let i = 0; i < MAX_RIPPLES; i++) {
                    if (waterUniforms.clickTimes.value[i] >= 1.0) {
                        waterUniforms.clickPositions.value[i].copy(clickUV); 
                        waterUniforms.clickTimes.value[i] = 0.0; 
                        break; 
                    }
                }
            }

            if (!isProfileMoved) {
                isProfileMoved = true;
                
                targetPositionX = -2;   
                targetRotationY = 1.2;   
                targetRotationX = 0;  
                
                const welcomeElement = document.getElementById('welcome-text');
                if (welcomeElement && welcomeElement.classList.contains('visible')) {
                    welcomeElement.classList.remove('visible');
                    welcomeElement.classList.add('disappearing');
                }

                const menuElement = document.getElementById('menu-container');
                if (menuElement) {
                    menuElement.classList.remove('hidden-panel');
                    menuElement.classList.add('visible');
                }
            }
        }
    }
});


const clock = new THREE.Clock();
// Variables objetivo para la animación
let targetPositionX = 0; 
let targetRotationY = 0; // <-- Valor positivo la hace apuntar hacia la derecha
let targetRotationX = 0; // <-- Valor negativo inclina la parte superior hacia la cámara
let isProfileMoved = false;
// Variables para la transición combinada (Bloom 3D + Flash CSS)
let isBloomTransitioning = false;
let bloomTransitionProgress = 0;
const initialBloomStrength = 0.15;
let isFlashTriggered = false;

function tick() {
    const elapsedTime = clock.getElapsedTime();
    borderMesh.rotation.z = -elapsedTime * 0.5;
    waterUniforms.time.value = elapsedTime;
    
    for (let i = 0; i < MAX_RIPPLES; i++) {
        if (waterUniforms.clickTimes.value[i] < 1.0) {
            waterUniforms.clickTimes.value[i] += 0.015;
        }
    }

    profileMesh.position.x = THREE.MathUtils.lerp(profileMesh.position.x, targetPositionX, 0.05);
    profileMesh.rotation.y = THREE.MathUtils.lerp(profileMesh.rotation.y, targetRotationY, 0.05);
    profileMesh.rotation.x = THREE.MathUtils.lerp(profileMesh.rotation.x, targetRotationX, 0.05);
    
    borderMesh.position.x = THREE.MathUtils.lerp(borderMesh.position.x, targetPositionX, 0.05);
    borderMesh.rotation.y = THREE.MathUtils.lerp(borderMesh.rotation.y, targetRotationY, 0.05);
    borderMesh.rotation.x = THREE.MathUtils.lerp(borderMesh.rotation.x, targetRotationX, 0.05);

    // --- TRANSICIÓN COMBINADA: SOBRECARGA BLOOM -> FLASH GLOBAL ---
    if (isBloomTransitioning) {
        bloomTransitionProgress += 0.015; // Velocidad a la que carga el brillo la foto
        
        if (bloomTransitionProgress < 0.5) {
            // FASE 1: La foto brilla cada vez más (el Bloom sube de 0.3 hasta ~4.0)
            bloomPass.strength = initialBloomStrength + (bloomTransitionProgress * 2) * 4.0; 
        } else {
            // FASE 2: El Bloom llegó a su límite. Disparamos la explosión blanca de CSS.
            if (!isFlashTriggered) {
                isFlashTriggered = true; // Ponemos el seguro para que no se repita
                
                const flash = document.getElementById('flash-overlay');
                if (flash) {
                    // Activamos la ceguera total instantánea
                    flash.classList.add('flash-active');
                    
                    // Mientras estamos ciegos (400ms), hacemos el cambiazo en las sombras
                    setTimeout(() => {
                        // Desaparece el entorno 3D
                        profileMesh.visible = false;
                        borderMesh.visible = false;
                        
                        // Aparece la biografía HTML
                        const bio = document.getElementById('bio-section');
                        if (bio) {
                            bio.classList.remove('hidden-panel');
                            bio.classList.add('visible');
                        }
                        
                        // FASE 3: Empezamos a quitar la pantalla blanca (dura 1.1s por tu CSS)
                        flash.classList.remove('flash-active');
                        
                        // Restauramos la luz 3D a la normalidad para el fondo
                        bloomPass.strength = initialBloomStrength;
                        isBloomTransitioning = false; // Secuencia terminada
                    }, 500); 
                }
            }
        }
    }

    if (scene.background instanceof THREE.VideoTexture) {
        scene.background.needsUpdate = true;
    }        
    composer.render();
    requestAnimationFrame(tick);
}

// --- Navegación HTML ---
const btnBio = document.getElementById('btn-bio');
btnBio?.addEventListener('click', () => {
    // 1. Ocultar el menú
    const menu = document.getElementById('menu-container');
    if (menu) {
        menu.classList.remove('visible');
        menu.classList.add('hidden-panel');
    }
    
    // 2. Iniciar la recarga de energía del Bloom 3D
    isBloomTransitioning = true;
    bloomTransitionProgress = 0;
    isFlashTriggered = false; // Reseteamos el seguro del flash
});

tick();
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    composer.setSize(sizes.width, sizes.height);
});