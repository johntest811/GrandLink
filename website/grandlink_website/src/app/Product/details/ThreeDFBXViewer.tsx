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
  const mountRef = useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState<"sunny" | "rainy" | "windy" | "foggy">("sunny");

  useEffect(() => {
    if (!mountRef.current) return;

    // clear previous
    while (mountRef.current.firstChild) mountRef.current.removeChild(mountRef.current.firstChild);

    // scene + camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 5000);
    camera.position.set(400, 400, 400);

    // renderer: PBR-friendly settings
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // runtime-safe color management for different three.js versions
    const sRGB = (THREE as any).sRGBEncoding ?? (THREE as any).SRGBColorSpace ?? (THREE as any).SRGBEncoding;
    if ("outputEncoding" in renderer && sRGB !== undefined) {
      (renderer as any).outputEncoding = sRGB;
    } else if ("outputColorSpace" in renderer && sRGB !== undefined) {
      (renderer as any).outputColorSpace = sRGB;
    } else if ((THREE as any).ColorManagement) {
      // older/newer fallbacks
      (THREE as any).ColorManagement.enabled = true;
    }

    // runtime-safe physically correct lights flag
    if ("physicallyCorrectLights" in renderer) {
      (renderer as any).physicallyCorrectLights = true;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);

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
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    // reduce shadow acne / excessive silhouette by applying a small bias and radius
    sunLight.shadow.bias = -0.0005;
    try { (sunLight.shadow as any).radius = 2; } catch(e) {}
    const d = 1600;
    (sunLight.shadow.camera as THREE.OrthographicCamera).left = -d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).right = d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).top = d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).bottom = -d;
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

    // sun mesh for visuals
    const sunGeo = new THREE.SphereGeometry(60, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb9a, toneMapped: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    // small particle textures
    const createRainTexture = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      const grd = ctx.createLinearGradient(size / 2, 0, size / 2, size);
      grd.addColorStop(0, "rgba(255,255,255,0.98)");
      grd.addColorStop(0.6, "rgba(200,200,255,0.35)");
      grd.addColorStop(1, "rgba(200,200,255,0.05)");
      ctx.fillStyle = grd;
      ctx.fillRect(size / 2 - 1.5, 0, 3, size);
      ctx.globalAlpha = 0.15;
      ctx.fillRect(size / 2 - 3, 0, 6, size);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };
    const createWindTexture = () => {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
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
    let rainBaseOpacity = 0.55; // adjustable
    let windSystem: THREE.Points | null = null;
    let windVel: Float32Array | null = null;
    let windBaseOpacity = 0.65; // adjustable
    let fogMeshAdded = false;

    // PMREM + environment setup: render the scene into a cubemap then use PMREM for PBR envMap
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cubeCamera = new THREE.CubeCamera(1, 10000, cubeRenderTarget);
    // add cubeCamera to scene so it picks up background/lighting (not visible)
    scene.add(cubeCamera);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Apply weather adjustments
    const applyWeather = (type: string) => {
      // cleanup previous
      if (rainSystem) {
        scene.remove(rainSystem);
        rainSystem.geometry.dispose();
        (rainSystem.material as THREE.PointsMaterial).dispose();
        rainSystem = null;
        rainVelY = null;
        rainVelX = null;
      }
      if (windSystem) {
        scene.remove(windSystem);
        windSystem.geometry.dispose();
        (windSystem.material as THREE.PointsMaterial).dispose();
        windSystem = null;
        windVel = null;
      }
      scene.fog = null;
      fogMeshAdded = false;

      if (type === "sunny") {
        scene.background = new THREE.Color(0x87ceeb);
        ambient.intensity = 0.9;
        sunLight.intensity = 1.6;
        sunLight.color = new THREE.Color(0xfff1c0);
        sunMesh.visible = true;
        renderer.setClearColor(0x87ceeb, 1);
      } else if (type === "rainy") {
        scene.background = new THREE.Color(0xbfd1e5);
        ambient.intensity = 0.6;
        sunLight.intensity = 0.25;
        sunMesh.visible = false;
        renderer.setClearColor(0xbfd1e5, 1);
      } else if (type === "windy") {
        scene.background = new THREE.Color(0xdbe9ff);
        ambient.intensity = 0.9;
        sunLight.intensity = 0.9;
        sunMesh.visible = true;
        renderer.setClearColor(0xdbe9ff, 1);
      } else if (type === "foggy") {
        scene.background = new THREE.Color(0xd6dbe0);
        ambient.intensity = 0.5;
        sunLight.intensity = 0.4;
        scene.fog = new THREE.FogExp2(0xd6dbe0, 0.0009);
        sunMesh.visible = false;
        renderer.setClearColor(0xd6dbe0, 1);
      }

      // create particle sets
      if (type === "rainy") {
        // thunderstorm: substantial particle increase and stronger visual presence
        const rainCount = 35000; // heavy storm — tune for performance
        const positions = new Float32Array(rainCount * 3);
        rainVelY = new Float32Array(rainCount);
        rainVelX = new Float32Array(rainCount);
        for (let i = 0; i < rainCount; i++) {
          positions[i * 3 + 0] = Math.random() * 3600 - 1800; // x
          positions[i * 3 + 1] = Math.random() * 2600 + 200;  // y
          positions[i * 3 + 2] = Math.random() * 3600 - 1800; // z
          // faster drops for thunderstorm + variation
          rainVelY[i] = 16 + Math.random() * 26; // fall speed
          // horizontal drift to simulate strong wind gusts in storm
          rainVelX[i] = (Math.random() - 0.5) * (4 + Math.random() * 10);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: rainTexture,
          size: 14,
          sizeAttenuation: true,
          transparent: true,
          opacity: rainBaseOpacity,
          alphaTest: 0.005,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        rainSystem = new THREE.Points(geo, mat);
        rainSystem.frustumCulled = false;
        // push rain slightly in front of ground to avoid z-fighting with model edges
        rainSystem.renderOrder = 1;
        scene.add(rainSystem);
        // add a subtle screen-space mist for heavy rain
        scene.fog = new THREE.FogExp2(0xbfd1e5, 0.00045);
      }

      if (type === "windy") {
        // stronger visible wind: more particles, larger size and faster drift
        const windCount = 9000;
        const positions = new Float32Array(windCount * 3);
        windVel = new Float32Array(windCount * 3);
        for (let i = 0; i < windCount; i++) {
          positions[i * 3 + 0] = Math.random() * 4200 - 2100;
          positions[i * 3 + 1] = Math.random() * 1600 + 50;
          positions[i * 3 + 2] = Math.random() * 4200 - 2100;
          // stronger directional velocity, biased in x direction
          windVel[i * 3 + 0] = 4 + Math.random() * 10; // x speed
          windVel[i * 3 + 1] = (Math.random() - 0.5) * 0.6; // slight vertical jitter
          windVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6; // z jitter
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: windTexture,
          size: 16,
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
      }

      if (type === "foggy") {
        fogMeshAdded = true;
      }

      // regenerate environment map after weather changes to ensure reflections match sky
      // capture scene to cubemap then PMREM -> scene.environment
      cubeCamera.update(renderer, scene);
      const envMap = pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture;
      scene.environment = envMap;
    };
    applyWeather(weather);

    // FBX loader
    const loader = new FBXLoader();
    loader.load(
      fbxUrl,
      (object) => {
        // helper to convert an incoming material -> improved PBR material
        const upgradeMaterial = (orig: any) => {
          if (!orig) return null;

          // preserve textures & color where possible
          const baseColor = orig.color ? orig.color.clone() : new THREE.Color(0xffffff);
          let map = orig.map ?? null;
          const opacity = typeof orig.opacity === "number" ? orig.opacity : 1;
          const roughness = orig.roughness ?? (orig.specular ? 1 - (orig.specular.r ?? 0) : 0.6);
          const metalness = orig.metalness ?? 0;

          // ensure texture color space is correct
          if (map && map.isTexture) {
            try {
              // runtime-safe sRGB detection
              const sRGB = (THREE as any).sRGBEncoding ?? (THREE as any).SRGBColorSpace ?? (THREE as any).SRGBEncoding;
              if (sRGB !== undefined) map.encoding = sRGB;
            } catch (e) {}
          }

          // decide if this should be glass-like
          const name = ((orig && orig.name) || "").toString().toLowerCase();
          const isTransparentCandidate =
            name.includes("glass") ||
            (orig && ((orig.transparent && opacity < 0.95) || (orig.specular && orig.specular.r > 0.1)));

          if (isTransparentCandidate) {
            const mat = new THREE.MeshPhysicalMaterial({
              map,
              color: baseColor,
              metalness: 0.0,
              roughness: Math.min(0.2, roughness),
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
            // Transparent objects should not write depth (avoids z-sorting occlusion)
            mat.depthWrite = false;
            // help blending quality
            (mat as any).transparent = true;
            return mat;
          }

          // non-glass -> Standard/Physical for environment reflections
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

          // default shadow behavior for most meshes
          child.castShadow = true;
          child.receiveShadow = true;

          const orig = child.material;
          let isGlassMat = false;
          try {
            if (Array.isArray(orig)) {
              // replace each material in the array
              const newMats = orig.map((m: any) => {
                const nm = upgradeMaterial(m) || m;
                // detect glass-like material created by upgradeMaterial
                const isG = nm && nm.transmission && nm.transmission > 0.5;
                if (isG) isGlassMat = true;
                return nm;
              });
              child.material = newMats;
            } else {
              const nm = upgradeMaterial(orig);
              if (nm) {
                // detect glass-like material created by upgradeMaterial
                isGlassMat = nm instanceof THREE.MeshPhysicalMaterial && nm.transmission > 0.5;
                child.material = nm;
              }
            }

            // Glass-specific tweaks to avoid dark silhouettes / z-fighting:
            if (isGlassMat) {
              // do not let glass receive direct shadow from frames (avoids dark outlines)
              child.receiveShadow = false;
              // render glass after opaque geometry
              child.renderOrder = 2;
              // polygon offset helps avoid z-fighting between glass and frame geometry
              try {
                (child.material as any).polygonOffset = true;
                (child.material as any).polygonOffsetFactor = -1;
                (child.material as any).polygonOffsetUnits = -4;
                // depthWrite already set during material creation, ensure it's false
                (child.material as any).depthWrite = false;
              } catch (e) {}
            } else {
              // ensure opaque geometry still receives shadows normally
              child.receiveShadow = true;
              child.renderOrder = 0;
            }

            // Ensure envMap applied once available
            if (scene.environment) {
              if (Array.isArray(child.material)) {
                (child.material as any[]).forEach((m) => {
                  if (m) {
                    (m as any).envMap = scene.environment;
                    (m as any).envMapIntensity = (m as any).envMapIntensity ?? 1.0;
                    m.needsUpdate = true;
                  }
                });
              } else {
                (child.material as any).envMap = scene.environment;
                (child.material as any).envMapIntensity = (child.material as any).envMapIntensity ?? 1.0;
                (child.material as any).needsUpdate = true;
              }
            } else {
              child.material.needsUpdate = true;
            }
          } catch (e) {
            console.warn("material upgrade error", e);
          }
        });

        scene.add(object);

        // regenerate env map now that object exists for better PBR reflections
        cubeCamera.update(renderer, scene);
        const envMap2 = pmremGenerator.fromCubemap(cubeRenderTarget.texture).texture;

        // ensure envMap encoding set (runtime-safe)
        try {
          const sRGB = (THREE as any).sRGBEncoding ?? (THREE as any).SRGBColorSpace ?? (THREE as any).SRGBEncoding;
          if (sRGB !== undefined) (envMap2 as any).encoding = sRGB;
        } catch (e) {}

        scene.environment = envMap2;

        // re-apply envMap to all meshes (ensures reflection shows)
        object.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              (child.material as any[]).forEach((m) => {
                if (m) {
                  m.envMap = scene.environment;
                  m.envMapIntensity = m.envMapIntensity ?? 1.0;
                  m.needsUpdate = true;
                }
              });
            } else {
              (child.material as any).envMap = scene.environment;
              (child.material as any).envMapIntensity = (child.material as any).envMapIntensity ?? 1.0;
              (child.material as any).needsUpdate = true;
            }
          }
        });
      },
      undefined,
      (err) => {
        console.warn("FBX load error", err);
      }
    );

    // animation loop
    const animate = () => {
      // Rain animation: use direct array access for compatibility and performance
      if (rainSystem && rainVelY && rainVelX) {
        const posAttr = rainSystem.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const count = rainVelY.length;
        const timeFactor = (Date.now() % 10000) / 10000;
        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          // stronger horizontal motion during storm gusts (time varying)
          const gust = Math.sin(i * 0.01 + timeFactor * Math.PI * 2) * 0.5;
          let x = arr[idx + 0] + (rainVelX[i] * 0.6) + gust;
          let y = arr[idx + 1] - rainVelY[i] * (0.9 + Math.random() * 0.2);
          // respawn drops when falling out of view
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

      if (windSystem && windVel) {
        const positions = windSystem.geometry.attributes.position as THREE.BufferAttribute;
        const arr = positions.array as Float32Array;
        const count = windVel.length / 3;
        const t = Date.now() * 0.001;
        for (let i = 0; i < count; i++) {
          const base = i * 3;
          // stronger directional x movement and wave-like vertical motion
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
      requestAnimationFrame(animate);
    };
    animate();

    // cleanup
    return () => {
      if (rainSystem) {
        scene.remove(rainSystem);
        rainSystem.geometry.dispose();
        (rainSystem.material as THREE.PointsMaterial).dispose();
        rainSystem = null;
      }
      if (windSystem) {
        scene.remove(windSystem);
        windSystem.geometry.dispose();
        (windSystem.material as THREE.PointsMaterial).dispose();
        windSystem = null;
      }
      rainTexture.dispose();
      windTexture.dispose();
      sunMesh.geometry.dispose();
      (sunMesh.material as THREE.Material).dispose();
      scene.remove(sunLight);
      scene.remove(fill);
      scene.remove(hemi);
      scene.remove(ambient);

      // dispose PMREM + cubeRT
      try {
        pmremGenerator.dispose();
        cubeRenderTarget.dispose();
      } catch (e) {}

      while (mountRef.current && mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
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
              className={`px-4 py-2 rounded ${weather === w ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}
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