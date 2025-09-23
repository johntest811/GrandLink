"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader, OrbitControls } from "three-stdlib";

type Props = {
  fbxUrl: string;
  width?: number;
  height?: number;
};

export default function ThreeDFBXViewer({ fbxUrl, width = 1200, height = 700 }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [weather, setWeather] = useState<"sunny" | "rainy" | "windy" | "foggy">("sunny");

  useEffect(() => {
    if (!mountRef.current) return;

    // --- adaptive performance helpers ---
    const hwConcurrency = (navigator as any).hardwareConcurrency || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const performanceFactor = Math.min(1, hwConcurrency / 4) * (1 / dpr);

    // particle budgets (scaled)
    const BASE_RAIN = Math.round(8000 * performanceFactor); // safe default
    const STORM_RAIN = Math.round(22000 * performanceFactor); // thunderstorm
    const BASE_WIND = Math.round(2500 * performanceFactor);
    const STRONG_WIND = Math.round(7000 * performanceFactor);

    // rendering size - use container size if available
    const container = mountRef.current;
    const renderWidth = Math.floor(container.clientWidth || width);
    const renderHeight = Math.floor(container.clientHeight || height);

    // clear previous children
    while (container.firstChild) container.removeChild(container.firstChild);

    // scene + camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(45, renderWidth / renderHeight, 1, 5000);
    camera.position.set(400, 400, 400);

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(renderWidth, renderHeight);
    renderer.setPixelRatio(dpr);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // runtime-safe color management
    const sRGB = (THREE as any).sRGBEncoding ?? (THREE as any).SRGBColorSpace ?? (THREE as any).SRGBEncoding;
    try {
      if ("outputEncoding" in renderer && sRGB !== undefined) (renderer as any).outputEncoding = sRGB;
      else if ("outputColorSpace" in renderer && sRGB !== undefined) (renderer as any).outputColorSpace = sRGB;
    } catch (e) {}
    if ("physicallyCorrectLights" in renderer) try { (renderer as any).physicallyCorrectLights = true; } catch(e){}

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff1c0, 1.2);
    sunLight.position.set(1000, 1000, -800);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    sunLight.shadow.bias = -0.0005;
    try { (sunLight.shadow as any).radius = 1.5; } catch (e) {}
    const d = 1600;
    try {
      (sunLight.shadow.camera as THREE.OrthographicCamera).left = -d;
      (sunLight.shadow.camera as THREE.OrthographicCamera).right = d;
      (sunLight.shadow.camera as THREE.OrthographicCamera).top = d;
      (sunLight.shadow.camera as THREE.OrthographicCamera).bottom = -d;
    } catch (e) {}
    scene.add(sunLight);

    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-400, 200, 400);
    scene.add(fill);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);

    // ground
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#dcdcdc", roughness: 0.9, metalness: 0.0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    ground.receiveShadow = true;
    scene.add(ground);

    // sun mesh
    const sunGeo = new THREE.SphereGeometry(60, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb9a, toneMapped: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    // small particle textures (smaller canvases for perf)
    const createRainTexture = () => {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      const grd = ctx.createLinearGradient(size / 2, 0, size / 2, size);
      grd.addColorStop(0, "rgba(255,255,255,0.98)");
      grd.addColorStop(0.6, "rgba(200,200,255,0.5)");
      grd.addColorStop(1, "rgba(200,200,255,0.05)");
      ctx.fillStyle = grd;
      ctx.fillRect(size / 2 - 1, 0, 2, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };
    const createWindTexture = () => {
      const size = 24;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180,200,255,0.95)";
      ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const rainTexture = createRainTexture();
    const windTexture = createWindTexture();

    // particle holders
    let rainSystem: THREE.Points | null = null;
    let rainVelY: Float32Array | null = null;
    let rainVelX: Float32Array | null = null;
    let rainBaseOpacity = 0.6;
    let windSystem: THREE.Points | null = null;
    let windVel: Float32Array | null = null;
    let windBaseOpacity = 0.7;
    let fogMeshAdded = false;

    // PMREM + environment
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCamera = new THREE.CubeCamera(1, 10000, cubeRenderTarget);
    scene.add(cubeCamera);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // frame skip to throttle heavy updates
    let frameCounter = 0;

    const applyWeather = (type: string) => {
      // cleanup previous
      if (rainSystem) {
        try {
          scene.remove(rainSystem);
          rainSystem.geometry.dispose();
          (rainSystem.material as THREE.PointsMaterial).dispose();
        } catch (e) {}
        rainSystem = null;
        rainVelY = null;
        rainVelX = null;
      }
      if (windSystem) {
        try {
          scene.remove(windSystem);
          windSystem.geometry.dispose();
          (windSystem.material as THREE.PointsMaterial).dispose();
        } catch (e) {}
        windSystem = null;
        windVel = null;
      }
      scene.fog = null;
      fogMeshAdded = false;

      if (type === "sunny") {
        scene.background = new THREE.Color(0x87ceeb);
        ambient.intensity = 0.9;
        sunLight.intensity = 1.6;
        sunMesh.visible = true;
        renderer.setClearColor(0x87ceeb, 1);
      } else if (type === "rainy") {
        scene.background = new THREE.Color(0xbfd1e5);
        ambient.intensity = 0.55;
        sunLight.intensity = 0.18;
        sunMesh.visible = false;
        renderer.setClearColor(0xbfd1e5, 1);

        // choose count based on performanceFactor
        const rainCount = performanceFactor > 0.6 ? STORM_RAIN : BASE_RAIN;

        const positions = new Float32Array(rainCount * 3);
        rainVelY = new Float32Array(rainCount);
        rainVelX = new Float32Array(rainCount);
        for (let i = 0; i < rainCount; i++) {
          positions[i * 3 + 0] = Math.random() * 3600 - 1800;
          positions[i * 3 + 1] = Math.random() * 2600 + 200;
          positions[i * 3 + 2] = Math.random() * 3600 - 1800;
          rainVelY[i] = (12 + Math.random() * 18) * (1 + (1 - performanceFactor)); // scale speed lightly
          rainVelX[i] = (Math.random() - 0.5) * (2 + Math.random() * 6);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: rainTexture,
          size: Math.max(8, 12 * performanceFactor),
          sizeAttenuation: true,
          transparent: true,
          opacity: rainBaseOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        rainSystem = new THREE.Points(geo, mat);
        rainSystem.frustumCulled = false;
        rainSystem.renderOrder = 1;
        scene.add(rainSystem);

        // subtle fog for heavy rain, lower density on weak devices
        const fogDensity = performanceFactor > 0.5 ? 0.00045 : 0.00025;
        scene.fog = new THREE.FogExp2(0xbfd1e5, fogDensity);
      } else if (type === "windy") {
        scene.background = new THREE.Color(0xdbe9ff);
        ambient.intensity = 0.9;
        sunLight.intensity = 0.9;
        sunMesh.visible = true;
        renderer.setClearColor(0xdbe9ff, 1);

        const windCount = performanceFactor > 0.6 ? STRONG_WIND : BASE_WIND;
        const positions = new Float32Array(windCount * 3);
        windVel = new Float32Array(windCount * 3);
        for (let i = 0; i < windCount; i++) {
          positions[i * 3 + 0] = Math.random() * 4200 - 2100;
          positions[i * 3 + 1] = Math.random() * 1600 + 50;
          positions[i * 3 + 2] = Math.random() * 4200 - 2100;
          windVel[i * 3 + 0] = 4 + Math.random() * 8;
          windVel[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
          windVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: windTexture,
          size: Math.max(10, 16 * performanceFactor),
          sizeAttenuation: true,
          transparent: true,
          opacity: windBaseOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        windSystem = new THREE.Points(geo, mat);
        windSystem.frustumCulled = false;
        windSystem.renderOrder = 1;
        scene.add(windSystem);
      } else if (type === "foggy") {
        scene.background = new THREE.Color(0xd6dbe0);
        ambient.intensity = 0.5;
        sunLight.intensity = 0.4;
        scene.fog = new THREE.FogExp2(0xd6dbe0, 0.0009);
        sunMesh.visible = false;
        renderer.setClearColor(0xd6dbe0, 1);
        fogMeshAdded = true;
      }

      // regenerate environment map (cheap size)
      try {
        cubeCamera.update(renderer, scene);
        const envMap = pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture;
        if (envMap) {
          try {
            if ((envMap as any).encoding === undefined && sRGB !== undefined) (envMap as any).encoding = sRGB;
          } catch (e) {}
          scene.environment = envMap;
        }
      } catch (e) {
        console.warn("envmap generation failed", e);
      }
    };

    applyWeather(weather);

    // FBX loader and material upgrade (keeps glass/transmission)
    const loader = new FBXLoader();
    loader.load(
      fbxUrl,
      (object) => {
        const upgradeMaterial = (orig: any) => {
          if (!orig) return null;
          const baseColor = orig.color ? orig.color.clone() : new THREE.Color(0xffffff);
          let map = orig.map ?? null;
          const opacity = typeof orig.opacity === "number" ? orig.opacity : 1;
          const roughness = orig.roughness ?? (orig.specular ? 1 - (orig.specular.r ?? 0) : 0.6);
          const metalness = orig.metalness ?? 0;

          if (map && map.isTexture) {
            try {
              if (sRGB !== undefined) map.encoding = sRGB;
            } catch (e) {}
          }

          const name = ((orig && orig.name) || "").toString().toLowerCase();
          const isTransparentCandidate =
            name.includes("glass") ||
            (orig && ((orig.transparent && opacity < 0.95) || (orig.specular && orig.specular.r > 0.1)));

          if (isTransparentCandidate) {
            const mat = new THREE.MeshPhysicalMaterial({
              map,
              color: baseColor,
              metalness: 0.0,
              roughness: Math.max(0.02, Math.min(0.4, roughness)),
              transmission: 0.95,
              transparent: true,
              opacity: Math.max(0.05, opacity),
              ior: 1.45,
              thickness: 0.6,
              clearcoat: 0.2,
              clearcoatRoughness: 0.05,
              envMapIntensity: 2.0,
              side: THREE.DoubleSide,
            });
            mat.depthWrite = false;
            (mat as any).transparent = true;
            return mat;
          }

          const mat = new THREE.MeshStandardMaterial({
            map,
            color: baseColor,
            metalness: metalness,
            roughness: Math.max(0.05, roughness),
            envMapIntensity: 1.0,
          });
          return mat;
        };

        object.traverse((child: any) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          const orig = child.material;
          try {
            if (Array.isArray(orig)) {
              const newMats = orig.map((m: any) => upgradeMaterial(m) || m);
              child.material = newMats;
            } else {
              const nm = upgradeMaterial(orig);
              if (nm) child.material = nm;
            }

            // glass tweaks
            const matCheck = Array.isArray(child.material) ? child.material[0] : child.material;
            if (matCheck && (matCheck as any).transmission && (matCheck as any).transmission > 0.5) {
              child.receiveShadow = false;
              child.renderOrder = 2;
              try {
                (child.material as any).polygonOffset = true;
                (child.material as any).polygonOffsetFactor = -1;
                (child.material as any).polygonOffsetUnits = -4;
                (child.material as any).depthWrite = false;
              } catch (e) {}
            } else {
              child.receiveShadow = true;
              child.renderOrder = 0;
            }

            if (scene.environment) {
              if (Array.isArray(child.material)) {
                (child.material as any[]).forEach((m) => {
                  if (m) { (m as any).envMap = scene.environment; (m as any).envMapIntensity = (m as any).envMapIntensity ?? 1.0; m.needsUpdate = true; }
                });
              } else {
                (child.material as any).envMap = scene.environment;
                (child.material as any).envMapIntensity = (child.material as any).envMapIntensity ?? 1.0;
                child.material.needsUpdate = true;
              }
            } else child.material.needsUpdate = true;
          } catch (e) {
            console.warn("material upgrade error", e);
          }
        });

        scene.add(object);

        // regenerate envMap now that object exists
        try {
          cubeCamera.update(renderer, scene);
          const envMap2 = pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture;
          if (envMap2 && sRGB !== undefined) try { (envMap2 as any).encoding = sRGB; } catch (e) {}
          scene.environment = envMap2;
        } catch (e) {
          console.warn("envmap regeneration failed", e);
        }
      },
      undefined,
      (err) => {
        console.warn("FBX load error", err);
      }
    );

    // animation loop with throttling
    let rafId = 0;
    const animate = () => {
      frameCounter++;
      // only update heavy particle movement every other frame (tweakable)
      const heavyStep = frameCounter % 2 === 0;

      if (heavyStep && rainSystem && rainVelY && rainVelX) {
        const posAttr = rainSystem.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const count = rainVelY.length;
        const timeFactor = (Date.now() % 10000) / 10000;
        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          const gust = Math.sin(i * 0.01 + timeFactor * Math.PI * 2) * 0.5;
          let x = arr[idx + 0] + (rainVelX[i] * 0.5) + gust;
          let y = arr[idx + 1] - rainVelY[i] * (0.85 + Math.random() * 0.2);
          if (y < -300) {
            y = 1800 + Math.random() * 800;
            x = Math.random() * 3600 - 1800;
            arr[idx + 2] = Math.random() * 3600 - 1800;
          }
          if (x > 2200) x = -2200;
          if (x < -2200) x = 2200;
          arr[idx + 0] = x;
          arr[idx + 1] = y;
        }
        posAttr.needsUpdate = true;
      }

      if (heavyStep && windSystem && windVel) {
        const positions = windSystem.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        const count = windVel.length / 3;
        const t = Date.now() * 0.001;
        for (let i = 0; i < count; i++) {
          const base = i * 3;
          let x = arr[base + 0] + windVel[base + 0] * (0.6 + Math.sin(t + i * 0.01) * 0.2);
          let y = arr[base + 1] + Math.sin(t * 2 + i * 0.02) * 0.8 + windVel[base + 1] * 0.02;
          let z = arr[base + 2] + windVel[base + 2] * 0.02;
          if (x > 2600) x = -2600;
          if (x < -2600) x = 2600;
          if (y < 20) y = 1600;
          arr[base + 0] = x;
          arr[base + 1] = y;
          arr[base + 2] = z;
        }
        positions.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    // cleanup
    return () => {
      cancelAnimationFrame(rafId);
      try { controls.dispose(); } catch(e) {}
      try { renderer.dispose(); } catch(e) {}
      try { pmremGenerator.dispose(); } catch(e) {}
      try { cubeRenderTarget.dispose(); } catch(e) {}
      try { rainTexture.dispose(); } catch(e) {}
      try { windTexture.dispose(); } catch(e) {}
      while (container && container.firstChild) container.removeChild(container.firstChild);
    };
  }, [fbxUrl, width, height, weather]);

  return (
    <div className="relative" style={{ width, height }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      <div className="pointer-events-none">
        <div
          className="fixed top-4 left-1/2 z-[9999] flex gap-2 transform -translate-x-1/2 pointer-events-auto"
          style={{ maxWidth: "calc(100% - 32px)", overflow: "auto" }}
        >
          {["sunny", "rainy", "windy", "foggy"].map((w) => (
            <button
              key={w}
              className={`px-4 py-2 rounded ${weather === w ? "bg-black text-white" : "bg-gray-200 text-black"}`}
              onClick={() => setWeather(w as any)}
              aria-label={w}
            >
              {w.charAt(0).toUpperCase() + w.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}