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

// 1. FONDO E ILUMINACIÓN DE ENTORNO ENVOLVENTE
const sceneColor = new THREE.Color('#d4f1f4');
scene.background = sceneColor;
scene.fog = new THREE.FogExp2(sceneColor, 0.04);

// Crear un Domo/Cilindro gigante de fondo para simular un cielo/espacio infinito brillante
const domeGeometry = new THREE.CylinderGeometry(30, 30, 60, 32, 1, true);
const domeMaterial = new THREE.MeshBasicMaterial({
    color: 0xe6f9ff,          // Un tono blanco-celeste súper brillante
    side: THREE.BackSide,     // Renderizar las paredes internas del cilindro
    fog: true
});
const backgroundDome = new THREE.Mesh(domeGeometry, domeMaterial);
backgroundDome.rotation.x = Math.PI * 0.5; // Orientarlo de cara a la cámara
scene.add(backgroundDome);
// 2. ORBES DE AURA (Elementos de fondo para que las burbujas los refracten)
const envGeometry = new THREE.SphereGeometry(1, 32, 32);
const envMatGreen = new THREE.MeshBasicMaterial({ color: 0x88e1c6, transparent: true, opacity: 0.6 });
const envMatBlue = new THREE.MeshBasicMaterial({ color: 0x5bc0eb, transparent: true, opacity: 0.6 });
const envMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });

const bgOrbs: THREE.Mesh[] = [];

// Creamos 25 esferas grandes flotando en el fondo (lejos de la cámara)
for(let i = 0; i < 25; i++) {
    const isGreen = i % 3 === 0;
    const isWhite = i % 3 === 1;
    const mesh = new THREE.Mesh(envGeometry, isGreen ? envMatGreen : (isWhite ? envMatWhite : envMatBlue));
    
    // Posiciones muy al fondo y dispersas
    mesh.position.set(
        (Math.random() - 0.5) * 40, 
        (Math.random() - 0.5) * 40, 
        -10 - Math.random() * 20 // En el eje Z negativo (hacia el fondo)
    );
    // Escalas gigantes
    const scale = Math.random() * 4 + 2;
    mesh.scale.setScalar(scale);
    
    scene.add(mesh);
    bgOrbs.push(mesh); // Las guardamos para animarlas levemente luego
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

// --- ILUMINACIÓN REORGANIZADA ---
// Subimos la luz ambiental para que aclare uniformemente cualquier zona muerta del renderizado
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
scene.add(ambientLight);

// Luz direccional suave para generar el punto de brillo blanco (Highlight) controlado en la burbuja
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(5, 8, 5);
scene.add(directionalLight);

// Una luz difusa que simula el color del cielo brillante rodeando los objetos
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4f1f4, 1.0);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const cyanLight = new THREE.PointLight(0x00a3b3, 2, 12);
cyanLight.position.set(-2, 2, 2);
scene.add(cyanLight);

// --- SISTEMA DE BURBUJAS 3D ---
interface BubbleData {
    mesh: THREE.Mesh;
    speed: number;
    wobbleSpeed: number;
    offset: number;
    isPopping: boolean;
}
const bubbles: BubbleData[] = [];

// El material perfecto: Cristal transparente que reacciona limpiamente a las luces sin saturarse
const bubbleMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.0,           // Totalmente liso para reflejos limpios e hiperrealistas
    transmission: 0.98,       // Deja pasar casi el 100% de la luz interna del fondo 3D
    ior: 1.12,                // Refracción baja para que el contorno sea nítido y sin artefactos negros
    thickness: 0.0,           // Mantenemos grosor cero para evitar cálculos oscuros en los bordes
    side: THREE.FrontSide,    // Renderizar solo el frente evita el solapamiento interno de caras
    transparent: true,
    opacity: 0.4,             // Reducimos la opacidad base para que la esfera sea sutil y etérea

    // Capa de brillo superior de alta intensidad (Glossy Effect)
    clearcoat: 1.0,           
    clearcoatRoughness: 0.0,
    
    // Eliminamos 'emissive' para que dejen de brillar como esferas incandescentes con el Bloom.
    specularIntensity: 2.0,   // Multiplica la intensidad del destello reflejado por las luces
    specularColor: new THREE.Color('#ffffff')
});

// Usamos una esfera con bastantes segmentos para que se vea perfecta y no poligonal
const bubbleGeometry = new THREE.SphereGeometry(1, 32, 32);

// Crear 20 burbujas distribuidas aleatoriamente
for (let i = 0; i < 20; i++) {
    const mesh = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
    
    const scale = Math.random() * 0.3 + 0.05; // Tamaños variados
    mesh.scale.set(scale, scale, scale);
    
    // Posiciones iniciales (abajo de la pantalla)
    mesh.position.x = (Math.random() - 0.5) * 12; // Repartidas a lo ancho
    mesh.position.y = -5 - Math.random() * 10;    // Repartidas hacia abajo
    mesh.position.z = (Math.random() - 0.5) * 4;  // Diferentes profundidades
    
    scene.add(mesh);
    
    bubbles.push({
        mesh: mesh,
        speed: Math.random() * 0.015 + 0.005, // Velocidad de subida
        wobbleSpeed: Math.random() * 2 + 1,   // Velocidad de tambaleo
        offset: Math.random() * Math.PI * 2,  // Desfase para que no se muevan igual
        isPopping: false
    });
}

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

// 1. Evento para cambiar el cursor a una manito (Ahora incluye burbujas)
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    let isHovering = false;

    // Chequear el perfil primero
    if (profileMesh.visible) {
        const intersects = raycaster.intersectObject(profileMesh);
        if (intersects.length > 0) isHovering = true;
    }
    
    // Chequear las burbujas
    const bubbleMeshes = bubbles.map(b => b.mesh);
    const bubbleIntersects = raycaster.intersectObjects(bubbleMeshes);
    if (bubbleIntersects.length > 0) isHovering = true;
    
    document.body.style.cursor = isHovering ? 'pointer' : 'default';
});

// 2. Eventos de Clic (Foto 3D y reventar burbujas)
window.addEventListener('click', (event) => {
    mouse.x = (event.clientX / sizes.width) * 2 - 1;
    mouse.y = - (event.clientY / sizes.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // A. Lógica para reventar burbujas
    const bubbleMeshes = bubbles.map(b => b.mesh);
    const bubbleIntersects = raycaster.intersectObjects(bubbleMeshes);
    
    if (bubbleIntersects.length > 0) {
        // Encontramos la burbuja específica que el usuario clickeó
        const clickedMesh = bubbleIntersects[0].object;
        const bubbleData = bubbles.find(b => b.mesh === clickedMesh);
        
        if (bubbleData && !bubbleData.isPopping) {
            bubbleData.isPopping = true; // Iniciamos la explosión
        }
    }
    
    // B. Lógica original para la foto de perfil
    if (profileMesh.visible) {
        const intersects = raycaster.intersectObject(profileMesh);
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
let targetRotationY = 0; 
let targetRotationX = 0; 
let isProfileMoved = false;

// Variables para la transición combinada (Bloom 3D + Flash CSS)
let isBloomTransitioning = false;
let bloomTransitionProgress = 0;
const initialBloomStrength = 0.15;
let isFlashTriggered = false;
let activeSectionTarget = ''; // <--- NUEVA VARIABLE: Nos dirá qué sección abrir

function tick() {
const elapsedTime = clock.getElapsedTime();

    // Animación de los orbes del fondo
    bgOrbs.forEach((orb, i) => {
        orb.position.y += Math.sin(elapsedTime * 0.5 + i) * 0.01;
        orb.rotation.y += 0.005;
    });

    borderMesh.rotation.z = -elapsedTime * 0.5;
    waterUniforms.time.value = elapsedTime;
    for (let i = 0; i < MAX_RIPPLES; i++) {
        if (waterUniforms.clickTimes.value[i] < 1.0) {
            waterUniforms.clickTimes.value[i] += 0.015;
        }
    }

    // --- LÓGICA DE ANIMACIÓN DE BURBUJAS ---
    bubbles.forEach(bubble => {
        if (bubble.isPopping) {
            // Animación de reventar: Se encogen rapidísimo y se aplanan un poco
            bubble.mesh.scale.multiplyScalar(0.75);
            bubble.mesh.scale.y *= 0.8; 
            
            // Cuando ya no se ven, hacemos "respawn" en el fondo
            if (bubble.mesh.scale.x < 0.01) {
                bubble.isPopping = false;
                bubble.mesh.position.y = -5 - Math.random() * 3;
                bubble.mesh.position.x = (Math.random() - 0.5) * 12;
                
                // Restaurar la forma y asignar nuevo tamaño
                const scale = Math.random() * 0.3 + 0.05;
                bubble.mesh.scale.set(scale, scale, scale);
            }
        } else {
            // Movimiento natural flotando hacia arriba
            bubble.mesh.position.y += bubble.speed;
            // Tambaleo horizontal usando senos
            bubble.mesh.position.x += Math.sin(elapsedTime * bubble.wobbleSpeed + bubble.offset) * 0.005;
            
            // Si la burbuja se sale muy arriba de la pantalla, la reciclamos enviándola al fondo
            if (bubble.mesh.position.y > 6) {
                bubble.mesh.position.y = -5 - Math.random() * 2;
                bubble.mesh.position.x = (Math.random() - 0.5) * 12;
            }
        }
        // Dentro de la función tick()
        if (scene.background instanceof THREE.VideoTexture) {
            scene.background.needsUpdate = true;
        }
    });

    profileMesh.position.x = THREE.MathUtils.lerp(profileMesh.position.x, targetPositionX, 0.05);
    profileMesh.rotation.y = THREE.MathUtils.lerp(profileMesh.rotation.y, targetRotationY, 0.05);
    profileMesh.rotation.x = THREE.MathUtils.lerp(profileMesh.rotation.x, targetRotationX, 0.05);
    
    borderMesh.position.x = THREE.MathUtils.lerp(borderMesh.position.x, targetPositionX, 0.05);
    borderMesh.rotation.y = THREE.MathUtils.lerp(borderMesh.rotation.y, targetRotationY, 0.05);
    borderMesh.rotation.x = THREE.MathUtils.lerp(borderMesh.rotation.x, targetRotationX, 0.05);

    // --- TRANSICIÓN COMBINADA: SOBRECARGA BLOOM -> FLASH GLOBAL ---
    if (isBloomTransitioning) {
        bloomTransitionProgress += 0.015; 
        
        if (bloomTransitionProgress < 0.5) {
            bloomPass.strength = initialBloomStrength + (bloomTransitionProgress * 2) * 4.0; 
        } else {
            if (!isFlashTriggered) {
                isFlashTriggered = true; 
                
                const flash = document.getElementById('flash-overlay');
                if (flash) {
                    flash.classList.add('flash-active');
                    
                    setTimeout(() => {
                        // Ocultamos el entorno 3D
                        profileMesh.visible = false;
                        borderMesh.visible = false;
                        
                        // Capturamos TODAS las secciones
                        const bio = document.getElementById('bio-section');
                        const skills = document.getElementById('skills-section');
                        const detail = document.getElementById('skill-detail-section');
                        
                        // 1. Ocultamos TODO por defecto para limpiar la pantalla
                        if (bio) { bio.classList.remove('visible'); bio.classList.add('hidden-panel'); bio.style.opacity = '0'; bio.style.pointerEvents = 'none'; }
                        if (skills) { skills.classList.remove('visible'); skills.classList.add('hidden-panel'); skills.style.opacity = '0'; skills.style.pointerEvents = 'none'; }
                        if (detail) { detail.classList.remove('visible'); detail.classList.add('hidden-panel'); detail.style.opacity = '0'; detail.style.pointerEvents = 'none'; }
                        
                        // 2. Mostramos SOLO la sección que el usuario pidió
                        if (activeSectionTarget === 'bio' && bio) {
                            bio.classList.remove('hidden-panel');
                            bio.classList.add('visible');
                            bio.style.opacity = '1';
                            bio.style.pointerEvents = 'auto';
                        } else if (activeSectionTarget === 'skills' && skills) {
                            skills.classList.remove('hidden-panel');
                            skills.classList.add('visible');
                            skills.style.opacity = '1';
                            skills.style.pointerEvents = 'auto';
                        }
                        
                        // Quitamos el flash y reseteamos el ciclo
                        flash.classList.remove('flash-active');
                        bloomPass.strength = initialBloomStrength;
                        isBloomTransitioning = false; 
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
// ===================================================
// FUNCIONES AUXILIARES DE NAVEGACIÓN DE PANELES
// ===================================================

function hidePanel(element: HTMLElement | null) {
    if (!element) return;
    element.classList.remove('visible');
    element.classList.add('hidden-panel');
    element.style.opacity = '';
    element.style.pointerEvents = '';
    element.style.transform = '';
}

function showPanel(element: HTMLElement | null) {
    if (!element) return;
    element.classList.remove('hidden-panel');
    element.classList.add('visible');
    element.style.opacity = '';
    element.style.pointerEvents = '';
    element.style.transform = '';
}

// ===================================================
// CONTROLADORES DE INTERFAZ Y NAVEGACIÓN (VERSIÓN ÚNICA)
// ===================================================

const menu = document.getElementById('menu-container');
const btnBio = document.getElementById('btn-bio');
const btnSkills = document.getElementById('btn-skills');

const bioSection = document.getElementById('bio-section');
const skillsSection = document.getElementById('skills-section');
const skillDetailSection = document.getElementById('skill-detail-section');

// 1. Abrir Autobiografía desde el Menú
btnBio?.addEventListener('click', () => {
    hidePanel(menu);
    activeSectionTarget = 'bio';
    isBloomTransitioning = true;
    bloomTransitionProgress = 0;
    isFlashTriggered = false; 
});

// 2. Abrir Panel de Habilidades desde el Menú
btnSkills?.addEventListener('click', () => {
    hidePanel(menu);
    activeSectionTarget = 'skills';
    isBloomTransitioning = true;
    bloomTransitionProgress = 0;
    isFlashTriggered = false;
});

// 3. Hover en Skill Items (Actualización de Paneles Laterales)
const skillItems = document.querySelectorAll('.skill-item');
const txtTechDesc = document.getElementById('txt-tech-desc');
const txtAppDesc = document.getElementById('txt-app-desc');

skillItems.forEach(item => {
    item.addEventListener('mouseenter', (e) => {
        const target = e.currentTarget as HTMLElement;
        const techName = target.getAttribute('data-tech') || '';
        const techDesc = target.getAttribute('data-desc-tech') || '';
        const appDesc = target.getAttribute('data-desc-app') || '';

        if (txtTechDesc) txtTechDesc.innerHTML = `<strong>${techName}:</strong> ${techDesc}`;
        if (txtAppDesc) txtAppDesc.innerHTML = appDesc;
    });
});

// 4. Click en una Habilidad (Ir a Vista Detalle)
skillItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const techName = target.getAttribute('data-tech') || '';
        
        const detailTitle = document.getElementById('detail-title');
        const detailDesc = document.getElementById('detail-desc');
        
        if (detailTitle) detailTitle.innerText = `Dashboard de Ejecución: ${techName}`;
        if (detailDesc) detailDesc.innerText = `Entorno operativo y métricas estables. Esta captura ilustra la implementación funcional utilizando arquitectura limpia basada en las especificaciones del stack core.`;

        // Efecto de Zoom Out en el panel general
        if (skillsSection) {
            skillsSection.style.transform = 'translate(-50%, -50%) scale(1.3)';
            skillsSection.style.opacity = '0';
            skillsSection.style.pointerEvents = 'none';
        }

        setTimeout(() => {
            hidePanel(skillsSection);
            showPanel(skillDetailSection);
        }, 300);
    });
});

// 5. Botón: "Volver al Panel" (Desde la Vista Detalle hacia la Grilla de Habilidades)
const btnBackSkills = document.getElementById('btn-back-skills');
btnBackSkills?.addEventListener('click', () => {
    hidePanel(skillDetailSection);

    setTimeout(() => {
        showPanel(skillsSection);
    }, 200);
});

// 6. Botón: "Volver al Menú" (Desde Habilidades hacia el Menú / 3D)
const btnBackSkillsMenu = document.getElementById('btn-back-skills-menu');
btnBackSkillsMenu?.addEventListener('click', () => {
    hidePanel(skillsSection);

    setTimeout(() => {
        profileMesh.visible = true;
        borderMesh.visible = true;
        showPanel(menu);
    }, 200);
});

// 7. Botón: "Volver al Inicio" (Desde Autobiografía hacia el Menú / 3D)
const btnBackBio = document.getElementById('btn-back-bio');
btnBackBio?.addEventListener('click', () => {
    hidePanel(bioSection);

    setTimeout(() => {
        profileMesh.visible = true;
        borderMesh.visible = true;
        showPanel(menu);
    }, 200);
});

// --- INICIALIZACIÓN ---
tick();
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    composer.setSize(sizes.width, sizes.height);
});