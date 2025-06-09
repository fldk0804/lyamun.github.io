import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const {
    Clock,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    SRGBColorSpace,
    MathUtils,
    Vector2,
    Vector3,
    MeshPhysicalMaterial,
    ShaderChunk,
    Color,
    Object3D,
    InstancedMesh,
    PMREMGenerator,
    SphereGeometry,
    AmbientLight,
    PointLight,
    ACESFilmicToneMapping,
    Raycaster,
    Plane
} = THREE;

class ThreeCanvas {
    #config;
    canvas;
    camera;
    cameraMinAspect;
    cameraMaxAspect;
    cameraFov;
    maxPixelRatio;
    minPixelRatio;
    scene;
    renderer;
    #postprocessing;
    size = { width: 0, height: 0, wWidth: 0, wHeight: 0, ratio: 0, pixelRatio: 0 };
    render = this.#render;
    onBeforeRender = () => { };
    onAfterRender = () => { };
    onAfterResize = () => { };
    #isIntersecting = false;
    #isAnimating = false;
    isDisposed = false;
    #intersectionObserver;
    #resizeObserver;
    #resizeTimeout;
    #clock = new Clock();
    #time = { elapsed: 0, delta: 0 };
    #animationFrame;

    constructor(config) {
        this.#config = { ...config };
        this.#initCamera();
        this.#initScene();
        this.#initRenderer();
        this.resize();
        this.#initObservers();
    }

    #initCamera() {
        this.camera = new PerspectiveCamera();
        this.cameraFov = this.camera.fov;
    }

    #initScene() {
        this.scene = new Scene();
    }

    #initRenderer() {
        if (this.#config.canvas) {
            this.canvas = this.#config.canvas;
        } else if (this.#config.id) {
            this.canvas = document.getElementById(this.#config.id);
        } else {
            console.error("Three: Missing canvas or id parameter");
        }

        this.canvas.style.display = "block";

        const rendererConfig = {
            canvas: this.canvas,
            powerPreference: "high-performance",
            ...(this.#config.rendererOptions ?? {}),
        };

        this.renderer = new WebGLRenderer(rendererConfig);
        this.renderer.outputColorSpace = SRGBColorSpace;
    }

    #initObservers() {
        if (!(this.#config.size instanceof Object)) {
            window.addEventListener("resize", this.#onResize.bind(this));
            if (this.#config.size === "parent" && this.canvas.parentNode) {
                this.#resizeObserver = new ResizeObserver(this.#onResize.bind(this));
                this.#resizeObserver.observe(this.canvas.parentNode);
            }
        }

        this.#intersectionObserver = new IntersectionObserver(this.#onIntersection.bind(this), {
            root: null,
            rootMargin: "0px",
            threshold: 0,
        });
        this.#intersectionObserver.observe(this.canvas);
        document.addEventListener("visibilitychange", this.#onVisibilityChange.bind(this));
    }

    #removeObservers() {
        window.removeEventListener("resize", this.#onResize.bind(this));
        this.#resizeObserver?.disconnect();
        this.#intersectionObserver?.disconnect();
        document.removeEventListener("visibilitychange", this.#onVisibilityChange.bind(this));
    }

    #onIntersection(entries) {
        this.#isIntersecting = entries[0].isIntersecting;
        this.#isIntersecting ? this.#startAnimation() : this.#stopAnimation();
    }

    #onVisibilityChange() {
        if (this.#isIntersecting) {
            document.hidden ? this.#stopAnimation() : this.#startAnimation();
        }
    }

    #onResize() {
        if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout);
        this.#resizeTimeout = setTimeout(this.resize.bind(this), 100);
    }

    resize() {
        let width, height;
        if (this.#config.size instanceof Object) {
            width = this.#config.size.width;
            height = this.#config.size.height;
        } else if (this.#config.size === "parent" && this.canvas.parentNode) {
            width = this.canvas.parentNode.offsetWidth;
            height = this.canvas.parentNode.offsetHeight;
        } else {
            width = window.innerWidth;
            height = window.innerHeight;
        }

        this.size.width = width;
        this.size.height = height;
        this.size.ratio = width / height;

        this.#updateCamera();
        this.#updateRenderer();
        this.onAfterResize(this.size);
    }

    #updateCamera() {
        this.camera.aspect = this.size.width / this.size.height;
        if (this.camera.isPerspectiveCamera && this.cameraFov) {
            if (this.cameraMinAspect && this.camera.aspect < this.cameraMinAspect) {
                this.#updateFov(this.cameraMinAspect);
            } else if (this.cameraMaxAspect && this.camera.aspect > this.cameraMaxAspect) {
                this.#updateFov(this.cameraMaxAspect);
            } else {
                this.camera.fov = this.cameraFov;
            }
        }
        this.camera.updateProjectionMatrix();
        this.updateWorldSize();
    }

    #updateFov(targetAspect) {
        const fov = Math.tan(MathUtils.degToRad(this.cameraFov / 2)) / (this.camera.aspect / targetAspect);
        this.camera.fov = 2 * MathUtils.radToDeg(Math.atan(fov));
    }

    updateWorldSize() {
        if (this.camera.isPerspectiveCamera) {
            const fov = (this.camera.fov * Math.PI) / 180;
            this.size.wHeight = 2 * Math.tan(fov / 2) * this.camera.position.length();
            this.size.wWidth = this.size.wHeight * this.camera.aspect;
        } else if (this.camera.isOrthographicCamera) {
            this.size.wHeight = this.camera.top - this.camera.bottom;
            this.size.wWidth = this.camera.right - this.camera.left;
        }
    }

    #updateRenderer() {
        this.renderer.setSize(this.size.width, this.size.height);
        this.#postprocessing?.setSize(this.size.width, this.size.height);

        let pixelRatio = window.devicePixelRatio;
        if (this.maxPixelRatio && pixelRatio > this.maxPixelRatio) {
            pixelRatio = this.maxPixelRatio;
        } else if (this.minPixelRatio && pixelRatio < this.minPixelRatio) {
            pixelRatio = this.minPixelRatio;
        }

        this.renderer.setPixelRatio(pixelRatio);
        this.size.pixelRatio = pixelRatio;
    }

    get postprocessing() {
        return this.#postprocessing;
    }

    set postprocessing(value) {
        this.#postprocessing = value;
        this.render = value.render.bind(value);
    }

    #startAnimation() {
        if (this.#isAnimating) return;

        const animate = () => {
            this.#animationFrame = requestAnimationFrame(animate);
            this.#time.delta = this.#clock.getDelta();
            this.#time.elapsed += this.#time.delta;
            this.onBeforeRender(this.#time);
            this.render();
            this.onAfterRender(this.#time);
        };

        this.#isAnimating = true;
        this.#clock.start();
        animate();
    }

    #stopAnimation() {
        if (this.#isAnimating) {
            cancelAnimationFrame(this.#animationFrame);
            this.#isAnimating = false;
            this.#clock.stop();
        }
    }

    #render() {
        this.renderer.render(this.scene, this.camera);
    }

    clear() {
        this.scene.traverse((object) => {
            if (object.isMesh && typeof object.material === "object" && object.material !== null) {
                Object.keys(object.material).forEach((key) => {
                    const value = object.material[key];
                    if (value !== null && typeof value === "object" && typeof value.dispose === "function") {
                        value.dispose();
                    }
                });
                object.material.dispose();
                object.geometry.dispose();
            }
        });
        this.scene.clear();
    }

    dispose() {
        this.#removeObservers();
        this.#stopAnimation();
        this.clear();
        this.#postprocessing?.dispose();
        this.renderer.dispose();
        this.isDisposed = true;
    }
}

const pointerMap = new Map();
const pointerPosition = new Vector2();
let hasPointerEvents = false;

function createPointerEvents(config) {
    const events = {
        position: new Vector2(),
        nPosition: new Vector2(),
        hover: false,
        onEnter() { },
        onMove() { },
        onClick() { },
        onLeave() { },
        ...config,
    };

    (function addPointerEvents(element, events) {
        if (!pointerMap.has(element)) {
            pointerMap.set(element, events);
            if (!hasPointerEvents) {
                document.body.addEventListener("pointermove", onPointerMove);
                document.body.addEventListener("pointerleave", onPointerLeave);
                document.body.addEventListener("click", onClick);
                hasPointerEvents = true;
            }
        }
    })(config.domElement, events);

    events.dispose = () => {
        const element = config.domElement;
        pointerMap.delete(element);
        if (pointerMap.size === 0) {
            document.body.removeEventListener("pointermove", onPointerMove);
            document.body.removeEventListener("pointerleave", onPointerLeave);
            hasPointerEvents = false;
        }
    };

    return events;
}

function onPointerMove(event) {
    pointerPosition.x = event.clientX;
    pointerPosition.y = event.clientY;

    for (const [element, events] of pointerMap) {
        const rect = element.getBoundingClientRect();
        if (isPointerInRect(rect)) {
            updatePointerPosition(events, rect);
            if (!events.hover) {
                events.hover = true;
                events.onEnter(events);
            }
            events.onMove(events);
        } else if (events.hover) {
            events.hover = false;
            events.onLeave(events);
        }
    }
}

function onClick(event) {
    pointerPosition.x = event.clientX;
    pointerPosition.y = event.clientY;

    for (const [element, events] of pointerMap) {
        const rect = element.getBoundingClientRect();
        updatePointerPosition(events, rect);
        if (isPointerInRect(rect)) events.onClick(events);
    }
}

function onPointerLeave() {
    for (const events of pointerMap.values()) {
        if (events.hover) {
            events.hover = false;
            events.onLeave(events);
        }
    }
}

function updatePointerPosition(events, rect) {
    const { position, nPosition } = events;
    position.x = pointerPosition.x - rect.left;
    position.y = pointerPosition.y - rect.top;
    nPosition.x = (position.x / rect.width) * 2 - 1;
    nPosition.y = (-position.y / rect.height) * 2 + 1;
}

function isPointerInRect(rect) {
    const { x, y } = pointerPosition;
    const { left, top, width, height } = rect;
    return x >= left && x <= left + width && y >= top && y <= top + height;
}

const { randFloat, randFloatSpread } = MathUtils;
const tempVector = new Vector3();
const positionVector = new Vector3();
const velocityVector = new Vector3();
const otherPositionVector = new Vector3();
const otherVelocityVector = new Vector3();
const diffVector = new Vector3();
const forceVector = new Vector3();
const lightPositionVector = new Vector3();
const lightTargetVector = new Vector3();

class Physics {
    constructor(config) {
        this.config = config;
        this.positionData = new Float32Array(3 * config.count).fill(0);
        this.velocityData = new Float32Array(3 * config.count).fill(0);
        this.sizeData = new Float32Array(config.count).fill(1);
        this.center = new Vector3();
        this.#initPositions();
        this.setSizes();
    }

    #initPositions() {
        const { config, positionData } = this;
        this.center.toArray(positionData, 0);
        for (let i = 1; i < config.count; i++) {
            const base = 3 * i;
            positionData[base] = randFloatSpread(2 * config.maxX);
            positionData[base + 1] = randFloatSpread(2 * config.maxY);
            positionData[base + 2] = randFloatSpread(2 * config.maxZ);
        }
    }

    setSizes() {
        const { config, sizeData } = this;
        sizeData[0] = config.size0;
        for (let i = 1; i < config.count; i++) {
            sizeData[i] = randFloat(config.minSize, config.maxSize);
        }
    }

    update(time) {
        const { config, center, positionData, sizeData, velocityData } = this;
        let startIdx = 0;

        if (config.controlSphere0) {
            startIdx = 1;
            tempVector.fromArray(positionData, 0);
            tempVector.lerp(center, 0.1).toArray(positionData, 0);
            velocityVector.set(0, 0, 0).toArray(velocityData, 0);
        }

        for (let idx = startIdx; idx < config.count; idx++) {
            const base = 3 * idx;
            positionVector.fromArray(positionData, base);
            velocityVector.fromArray(velocityData, base);
            velocityVector.y -= time.delta * config.gravity * sizeData[idx];
            velocityVector.multiplyScalar(config.friction);
            velocityVector.clampLength(0, config.maxVelocity);
            positionVector.add(velocityVector);
            positionVector.toArray(positionData, base);
            velocityVector.toArray(velocityData, base);
        }

        for (let idx = startIdx; idx < config.count; idx++) {
            const base = 3 * idx;
            positionVector.fromArray(positionData, base);
            velocityVector.fromArray(velocityData, base);
            const radius = sizeData[idx];

            for (let jdx = idx + 1; jdx < config.count; jdx++) {
                const otherBase = 3 * jdx;
                otherPositionVector.fromArray(positionData, otherBase);
                otherVelocityVector.fromArray(velocityData, otherBase);
                const otherRadius = sizeData[jdx];
                diffVector.copy(otherPositionVector).sub(positionVector);
                const dist = diffVector.length();
                const sumRadius = radius + otherRadius;

                if (dist < sumRadius) {
                    const overlap = sumRadius - dist;
                    forceVector.copy(diffVector).normalize().multiplyScalar(0.5 * overlap);
                    lightPositionVector.copy(forceVector).multiplyScalar(Math.max(velocityVector.length(), 1));
                    lightTargetVector.copy(forceVector).multiplyScalar(Math.max(otherVelocityVector.length(), 1));
                    positionVector.sub(forceVector);
                    velocityVector.sub(lightPositionVector);
                    positionVector.toArray(positionData, base);
                    velocityVector.toArray(velocityData, base);
                    otherPositionVector.add(forceVector);
                    otherVelocityVector.add(lightTargetVector);
                    otherPositionVector.toArray(positionData, otherBase);
                    otherVelocityVector.toArray(velocityData, otherBase);
                }
            }

            if (config.controlSphere0) {
                diffVector.copy(tempVector).sub(positionVector);
                const dist = diffVector.length();
                const sumRadius0 = radius + sizeData[0];
                if (dist < sumRadius0) {
                    const diff = sumRadius0 - dist;
                    forceVector.copy(diffVector.normalize()).multiplyScalar(diff);
                    lightPositionVector.copy(forceVector).multiplyScalar(Math.max(velocityVector.length(), 2));
                    positionVector.sub(forceVector);
                    velocityVector.sub(lightPositionVector);
                }
            }

            if (Math.abs(positionVector.x) + radius > config.maxX) {
                positionVector.x = Math.sign(positionVector.x) * (config.maxX - radius);
                velocityVector.x = -velocityVector.x * config.wallBounce;
            }

            if (config.gravity === 0) {
                if (Math.abs(positionVector.y) + radius > config.maxY) {
                    positionVector.y = Math.sign(positionVector.y) * (config.maxY - radius);
                    velocityVector.y = -velocityVector.y * config.wallBounce;
                }
            } else if (positionVector.y - radius < -config.maxY) {
                positionVector.y = -config.maxY + radius;
                velocityVector.y = -velocityVector.y * config.wallBounce;
            }

            const maxBoundary = Math.max(config.maxZ, config.maxSize);
            if (Math.abs(positionVector.z) + radius > maxBoundary) {
                positionVector.z = Math.sign(positionVector.z) * (config.maxZ - radius);
                velocityVector.z = -velocityVector.z * config.wallBounce;
            }

            positionVector.toArray(positionData, base);
            velocityVector.toArray(velocityData, base);
        }
    }
}

class ScatteringMaterial extends MeshPhysicalMaterial {
    constructor(config) {
        super(config);
        this.uniforms = {
            thicknessDistortion: { value: 0.1 },
            thicknessAmbient: { value: 0 },
            thicknessAttenuation: { value: 0.1 },
            thicknessPower: { value: 2 },
            thicknessScale: { value: 10 },
        };
        this.defines.USE_UV = "";
        this.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, this.uniforms);
            shader.fragmentShader = `
        uniform float thicknessPower;
        uniform float thicknessScale;
        uniform float thicknessDistortion;
        uniform float thicknessAmbient;
        uniform float thicknessAttenuation;
        ${shader.fragmentShader}
      `;
            shader.fragmentShader = shader.fragmentShader.replace(
                "void main() {",
                `
        void RE_Direct_Scattering(const in IncidentLight directLight, const in vec2 uv, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, inout ReflectedLight reflectedLight) {
          vec3 scatteringHalf = normalize(directLight.direction + (geometryNormal * thicknessDistortion));
          float scatteringDot = pow(saturate(dot(geometryViewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
          #ifdef USE_COLOR
            vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * vColor;
          #else
            vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * diffuse;
          #endif
          reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
        }

        void main() {
        `
            );
            const lightsFragment = ShaderChunk.lights_fragment_begin.replaceAll(
                "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
                `
          RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          RE_Direct_Scattering(directLight, vUv, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, reflectedLight);
        `
            );
            shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", lightsFragment);
            if (this.onBeforeCompile2) this.onBeforeCompile2(shader);
        };
    }
}

const X = {
    count: 200,
    colors: [0x000080, 0x000000, 0xFFFFFF],
    ambientColor: 0xFFFFFF,
    ambientIntensity: 0.5,
    lightIntensity: 300,
    materialParams: {
        metalness: 0.3,
        roughness: 0.4,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
    },
    minSize: 0.4,
    maxSize: 0.8,
    size0: 1,
    gravity: 1.0,
    friction: 0.99,
    wallBounce: 0.95,
    maxVelocity: 0.2,
    maxX: 5,
    maxY: 5,
    maxZ: 2,
    controlSphere0: false,
    followCursor: false,
};

const tempObject = new Object3D();

class Spheres extends InstancedMesh {
    constructor(renderer, config = {}) {
        const mergedConfig = { ...X, ...config };
        const environment = new RoomEnvironment();
        const envMap = new PMREMGenerator(renderer, 0.04).fromScene(environment).texture;
        const geometry = new SphereGeometry();
        const material = new ScatteringMaterial({ envMap, ...mergedConfig.materialParams });
        super(geometry, material, mergedConfig.count);
        this.config = mergedConfig;

        // Initialize lights first
        this.ambientLight = new AmbientLight(
            this.config.ambientColor,
            this.config.ambientIntensity
        );
        this.add(this.ambientLight);

        // Create and position the light before using it
        this.light = new PointLight(this.config.colors[0], this.config.lightIntensity);
        this.light.position.set(0, 0, 0); // Set initial position
        this.add(this.light);

        // Initialize physics after lights
        this.physics = new Physics(mergedConfig);

        // Set initial light position from physics data
        if (this.physics && this.physics.positionData && this.physics.positionData.length >= 3) {
            this.light.position.fromArray(this.physics.positionData, 0);
        }

        // Then set colors
        this.setColors(mergedConfig.colors);
    }

    setColors(colors) {
        if (Array.isArray(colors) && colors.length > 1) {
            const colorManager = (function (colors) {
                let colorArray, colorObjects;
                function setColors(colors) {
                    colorArray = colors;
                    colorObjects = [];
                    colorArray.forEach((color) => {
                        colorObjects.push(new Color(color));
                    });
                }
                setColors(colors);
                return {
                    setColors,
                    getColorAt: function (ratio, out = new Color()) {
                        const scaled = Math.max(0, Math.min(1, ratio)) * (colorArray.length - 1);
                        const idx = Math.floor(scaled);
                        const start = colorObjects[idx];
                        if (idx >= colorArray.length - 1) return start.clone();
                        const alpha = scaled - idx;
                        const end = colorObjects[idx + 1];
                        out.r = start.r + alpha * (end.r - start.r);
                        out.g = start.g + alpha * (end.g - start.g);
                        out.b = start.b + alpha * (end.b - start.b);
                        return out;
                    },
                };
            })(colors);

            for (let idx = 0; idx < this.count; idx++) {
                this.setColorAt(idx, colorManager.getColorAt(idx / this.count));
                if (idx === 0) {
                    this.light.color.copy(colorManager.getColorAt(idx / this.count));
                }
            }
            this.instanceColor.needsUpdate = true;
        }
    }

    update(time) {
        if (!this.physics) return;

        this.physics.update(time);
        for (let idx = 0; idx < this.count; idx++) {
            tempObject.position.fromArray(this.physics.positionData, 3 * idx);
            if (idx === 0 && this.config.followCursor === false) {
                tempObject.scale.setScalar(0);
            } else {
                tempObject.scale.setScalar(this.physics.sizeData[idx]);
            }
            tempObject.updateMatrix();
            this.setMatrixAt(idx, tempObject.matrix);
            if (idx === 0 && this.light) {
                this.light.position.copy(tempObject.position);
            }
        }
        this.instanceMatrix.needsUpdate = true;
    }
}

export function createBallpit(canvas, config = {}) {
    const three = new ThreeCanvas({
        canvas,
        size: "parent",
        rendererOptions: { antialias: true, alpha: true },
    });

    let spheres;
    three.renderer.toneMapping = ACESFilmicToneMapping;
    three.camera.position.set(0, 0, 20);
    three.camera.lookAt(0, 0, 0);
    three.cameraMaxAspect = 1.5;
    three.resize();
    initialize(config);

    const raycaster = new Raycaster();
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const intersectionPoint = new Vector3();
    let isPaused = false;

    const pointerEvents = createPointerEvents({
        domElement: canvas,
        onMove() {
            raycaster.setFromCamera(pointerEvents.nPosition, three.camera);
            three.camera.getWorldDirection(plane.normal);
            raycaster.ray.intersectPlane(plane, intersectionPoint);
            spheres.physics.center.copy(intersectionPoint);
            spheres.config.controlSphere0 = true;
        },
        onLeave() {
            spheres.config.controlSphere0 = false;
        },
    });

    function initialize(config) {
        if (spheres) {
            three.clear();
            three.scene.remove(spheres);
        }
        spheres = new Spheres(three.renderer, config);
        three.scene.add(spheres);
    }

    three.onBeforeRender = (time) => {
        if (!isPaused) spheres.update(time);
    };

    three.onAfterResize = (size) => {
        spheres.config.maxX = size.wWidth / 2;
        spheres.config.maxY = size.wHeight / 2;
    };

    return {
        three,
        get spheres() {
            return spheres;
        },
        setCount(count) {
            initialize({ ...spheres.config, count });
        },
        togglePause() {
            isPaused = !isPaused;
        },
        dispose() {
            pointerEvents.dispose();
            three.dispose();
        },
    };
}

export class Ballpit {
    constructor(canvas, config = {}) {
        this.instance = createBallpit(canvas, config);
    }

    setCount(count) {
        this.instance.setCount(count);
    }

    togglePause() {
        this.instance.togglePause();
    }

    dispose() {
        this.instance.dispose();
    }
} 