# 🫧 Frutiger Aero Portfolio 💧

<p align="center">
  <img src="https://img.shields.io/badge/WebGL-000000?style=for-the-badge&logo=webgl&logoColor=white" />
  <img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" />
  <img src="https://img.shields.io/badge/GSAP-88CE02?style=for-the-badge&logo=greensock&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
</p>

---

> **Vibe Check:** Un portafolio web interactivo de alto rendimiento inspirado en la estética *Frutiger Aero* (2004-2013). Diseñado con gráficos 3D acelerados por hardware en la GPU, efectos de distorsión líquida, burbujas dinámicas y una interfaz de usuario *glassmorphism* ultra brillante.

## 🌿 Características Principales

* **Renderizado WebGL de Alto Rendimiento:** Fondos interactivos procesados directamente en la tarjeta gráfica usando shaders personalizados, manteniendo la CPU libre y el rendimiento optimizado.
* **Transiciones Orgánicas entre Menús:** Integración de GSAP ScrollTrigger junto con un motor de scroll suavizado (*smooth scrolling*) para que la cámara interactúe con el movimiento del usuario.
* **Estética Nostálgica del Futuro:** Interfaz meticulosamente detallada con gradientes brillantes (tonos verde/azul aurora), transparencias cristalinas, reflejos de luz y físicas de partículas de agua.

---

## 🛠️ Stack Tecnológico

| Herramienta / Librería | Propósito en el Proyecto |
| :--- | :--- |
| **WebGL / Three.js** | Motor para renderizar la escena interactiva en 3D y simular los fluidos. |
| **GSAP (GreenSock)** | Orquestación de animaciones complejas y sincronización milimétrica con el scroll. |
| **Vite** | Entorno de desarrollo rápido y empaquetador ligero optimizado para producción. |
| **CSS Moderno / Variables** | Estilizado avanzado para replicar texturas tipo cristal brillante (*Glossy/Glassmorphism*). |

---

## 📂 Estructura del Proyecto

```text
├── 📁 public/              # Texturas, capas de agua y assets estáticos
├── 📁 src/
│   ├── 📁 components/      # Menús interactivos, tarjetas de proyectos y UI glossy
│   ├── 📁 shaders/         # Archivos GLSL (vertex y fragment shaders para WebGL)
│   ├── 📁 styles/          # Hojas de estilo inspiradas en Frutiger Aero
│   ├── 📜 main.js          # Configuración inicial del Canvas y la escena 3D
└── 📜 index.html           # Estructura base del portafolio
