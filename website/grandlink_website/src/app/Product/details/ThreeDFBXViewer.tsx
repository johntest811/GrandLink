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

    // Clean up previous children/renderers
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Scene setup
    const scene = new THREE.Scene();
    // default sky color (will be overridden per-weather in applyWeather)
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(400, 400, 400);

    // Renderer (enable shadows for realistic sun shadows)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting placeholders
    let ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    // sunLight will be the main directional "sun" source for Sunny mode (casts shadows)
    const sunLight = new THREE.DirectionalLight(0xfff1c0, 1.2);
    sunLight.position.set(1000, 1000, -800);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 5000;
    // configure an orthographic shadow camera large enough for the scene
    const d = 1600;
    (sunLight.shadow.camera as THREE.OrthographicCamera).left = -d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).right = d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).top = d;
    (sunLight.shadow.camera as THREE.OrthographicCamera).bottom = -d;
    scene.add(sunLight);

    // Small fill directional light to keep details
    const fill = new THREE.DirectionalLight(0xffffff, 0.4);
    fill.position.set(-400, 200, 400);
    scene.add(fill);

    // Hemilight for better material visibility
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(hemi);

    // Ground plane (receives shadows)
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshPhongMaterial({ color: "#dcdcdc", depthWrite: true });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add a simple sun mesh (billboard-like) to give visual sun
    const sunGeo = new THREE.SphereGeometry(60, 32, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffeb9a, toneMapped: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunLight.position);
    scene.add(sunMesh);

    // Particle holders/state
    let rainSystem: THREE.Points | null = null;
    let rainVel: Float32Array | null = null;
    let windSystem: THREE.Points | null = null;
    let windVel: Float32Array | null = null;
    let fogMeshAdded = false;

    // Create simple sprite textures (canvas) for particles — no external assets required
    const createRainTexture = () => {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      // vertical streak with soft edges
      const grd = ctx.createLinearGradient(size/2, 0, size/2, size);
      grd.addColorStop(0, "rgba(255,255,255,0.98)");
      grd.addColorStop(0.6, "rgba(200,200,255,0.35)");
      grd.addColorStop(1, "rgba(200,200,255,0.05)");
      ctx.fillStyle = grd;
      ctx.fillRect(size/2 - 1.5, 0, 3, size);
      // slight blur effect by drawing translucent wider streak
      ctx.globalAlpha = 0.15;
      ctx.fillRect(size/2 - 3, 0, 6, size);
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
      ctx.arc(size/2, size/2, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(180,200,255,0.95)";
      ctx.fill();
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const rainTexture = createRainTexture();
    const windTexture = createWindTexture();

    // Improved weather application (more "game-like")
    const applyWeather = (type: string) => {
      // Reset previous special elements
      if (rainSystem) {
        scene.remove(rainSystem);
        rainSystem.geometry.dispose();
        (rainSystem.material as THREE.PointsMaterial).dispose();
        rainSystem = null;
        rainVel = null;
      }
      if (windSystem) {
        scene.remove(windSystem);
        windSystem.geometry.dispose();
        (windSystem.material as THREE.PointsMaterial).dispose();
        windSystem = null;
        windVel = null;
      }
      // Fog management
      scene.fog = null;
      if (fogMeshAdded) {
        fogMeshAdded = false;
      }

      // default sky + lighting tweaks per weather
      if (type === "sunny") {
        scene.background = new THREE.Color(0x87ceeb); // clear blue sky
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

      // Rain: long streak sprites, faster fall, many particles
      if (type === "rainy") {
        const rainCount = 6000;
        const positions = new Float32Array(rainCount * 3);
        rainVel = new Float32Array(rainCount);
        for (let i = 0; i < rainCount; i++) {
          positions[i * 3 + 0] = Math.random() * 2400 - 1200;
          positions[i * 3 + 1] = Math.random() * 1800 + 100;
          positions[i * 3 + 2] = Math.random() * 2400 - 1200;
          // faster drops with slight x drift
          rainVel[i] = 6 + Math.random() * 6;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: rainTexture,
          size: 18,
          sizeAttenuation: true,
          transparent: true,
          alphaTest: 0.01,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });
        rainSystem = new THREE.Points(geo, mat);
        scene.add(rainSystem);
      }

      // Wind: drifting particles across wide area (use small round sprites)
      if (type === "windy") {
        const windCount = 3200;
        const positions = new Float32Array(windCount * 3);
        windVel = new Float32Array(windCount * 3); // x,y,z velocities
        for (let i = 0; i < windCount; i++) {
          positions[i * 3 + 0] = Math.random() * 3600 - 1800;
          positions[i * 3 + 1] = Math.random() * 1200 + 50;
          positions[i * 3 + 2] = Math.random() * 3600 - 1800;
          // stronger horizontal velocity and mild vertical bob
          windVel[i * 3 + 0] = 2 + Math.random() * 6; // x velocity
          windVel[i * 3 + 1] = (Math.random() - 0.5) * 0.4; // y velocity small
          windVel[i * 3 + 2] = (Math.random() - 0.5) * 0.4; // z velocity small
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          map: windTexture,
          size: 8,
          sizeAttenuation: true,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        windSystem = new THREE.Points(geo, mat);
        scene.add(windSystem);
      }

      // Foggy: add subtle ground fog plane for volumetric feel (not expensive)
      if (type === "foggy") {
        fogMeshAdded = true;
      }
    };
    applyWeather(weather);

    // Load FBX
    const loader = new FBXLoader();
    loader.load(
      fbxUrl,
      (object) => {
        scene.add(object);
        applyGlassMaterial(object);
      },
      undefined,
      (err) => {
        console.warn("FBX load error", err);
      }
    );

    // Animation loop
    const animate = () => {
      // Animate rain
      if (rainSystem && rainVel) {
        const positions = rainSystem.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rainVel.length; i++) {
          let y = positions.getY(i) - rainVel[i];
          let x = positions.getX(i) + (Math.sin((i + Date.now() * 0.002) * 0.01) * 0.6); // small sway
          if (y < -50) {
            y = 1400 + Math.random() * 600;
            x = Math.random() * 2400 - 1200;
          }
          positions.setY(i, y);
          positions.setX(i, x);
        }
        positions.needsUpdate = true;
      }
      // Animate wind
      if (windSystem && windVel) {
        const positions = windSystem.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < windVel.length / 3; i++) {
          const idxX = i * 3;
          const idxY = i * 3 + 1;
          const idxZ = i * 3 + 2;
          let x = positions.getX(i) + windVel[idxX] * 0.6;
          let y = positions.getY(i) + Math.sin((Date.now() * 0.001 + i) * 0.5) * 0.05 + windVel[idxY] * 0.02;
          let z = positions.getZ(i) + windVel[idxZ] * 0.02;
          // wrap around
          if (x > 1800) x = -1800;
          if (x < -1800) x = 1800;
          if (y < 10) y = 1200;
          positions.setX(i, x);
          positions.setY(i, y);
          positions.setZ(i, z);
        }
        positions.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      // dispose created textures and geometries / materials
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
      // dispose sun mesh
      sunMesh.geometry.dispose();
      (sunMesh.material as THREE.Material).dispose();
      // remove lights
      scene.remove(sunLight);
      scene.remove(fill);
      scene.remove(hemi);
      scene.remove(ambient);
      while (mountRef.current && mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    };
  }, [fbxUrl, width, height, weather]);

  // Apply glass material to loaded object
  function applyGlassMaterial(object: THREE.Object3D) {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // Detect glass by mesh or material name (adjust as needed)
        const isGlass =
          mesh.name.toLowerCase().includes("glass") ||
          ((mesh.material as any)?.name ?? "").toLowerCase().includes("glass");

        if (isGlass) {
          mesh.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, // White base color
            transparent: true,
            opacity: 0.2, // Lower opacity for better transparency
            transmission: 1, // Full transmission for clear glass
            roughness: 0.05, // Slight roughness for realistic glass
            metalness: 0, // No metallic properties
            ior: 1.5, // Index of refraction for glass
            thickness: 0.5, // Thickness of the glass
            clearcoat: 1, // Add clearcoat for reflective surface
            clearcoatRoughness: 0.05, // Slight roughness for clearcoat
            envMapIntensity: 1, // Enhance reflections
          });

          // Ensure material updates
          mesh.material.needsUpdate = true;
        }
      }
    });
  }

  return (
    <div className="relative" style={{ width, height }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* centered top controls — fixed to viewport so they stay visible on zoom/resize */}
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