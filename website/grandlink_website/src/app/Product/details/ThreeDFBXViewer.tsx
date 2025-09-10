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
    scene.background = new THREE.Color("#f0f0f0");

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(400, 400, 400);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);

    // Lighting
    let ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(400, 800, 400);
    scene.add(directional);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshPhongMaterial({ color: "#e0e0e0", depthWrite: false });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -10;
    scene.add(ground);

    // Weather particles
    let rainParticles: THREE.Points | null = null;
    let windParticles: THREE.Points | null = null;

    // Weather effects
    const applyWeather = (type: string) => {
      ambient.intensity = type === "sunny" ? 1.2 : 0.7;
      directional.intensity = type === "sunny" ? 1 : 0.5;
      scene.fog = null;
      if (type === "foggy") {
        scene.fog = new THREE.Fog(0xcccccc, 100, 2000);
      }
      renderer.setClearColor(type === "rainy" ? 0xbfd1e5 : "#f0f0f0", 1);

      // Remove previous particles
      if (rainParticles) {
        scene.remove(rainParticles);
        rainParticles.geometry.dispose();
        (rainParticles.material as THREE.Material).dispose();
        rainParticles = null;
      }
      if (windParticles) {
        scene.remove(windParticles);
        windParticles.geometry.dispose();
        (windParticles.material as THREE.Material).dispose();
        windParticles = null;
      }

      // Rainy: add rain particles (even wider area, more particles)
      if (type === "rainy") {
        const rainGeo = new THREE.BufferGeometry();
        const rainCount = 8000; // increase particle count
        const rainPositions = [];
        for (let i = 0; i < rainCount; i++) {
          rainPositions.push(
            Math.random() * 2400 - 1200, // wider X
            Math.random() * 1800,        // taller Y
            Math.random() * 2400 - 1200  // wider Z
          );
        }
        rainGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(rainPositions, 3)
        );
        const rainMaterial = new THREE.PointsMaterial({
          color: 0xaaaaaa,
          size: 4,
          transparent: true,
        });
        rainParticles = new THREE.Points(rainGeo, rainMaterial);
        scene.add(rainParticles);
      }

      // Windy: add wind particles (even wider area, more particles)
      if (type === "windy") {
        const windGeo = new THREE.BufferGeometry();
        const windCount = 4000; // increase particle count
        const windPositions = [];
        for (let i = 0; i < windCount; i++) {
          windPositions.push(
            Math.random() * 2400 - 1200, // wider X
            Math.random() * 1800,        // taller Y
            Math.random() * 2400 - 1200  // wider Z
          );
        }
        windGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(windPositions, 3)
        );
        const windMaterial = new THREE.PointsMaterial({
          color: 0x99ccff,
          size: 5,
          transparent: true,
        });
        windParticles = new THREE.Points(windGeo, windMaterial);
        scene.add(windParticles);
      }
    };
    applyWeather(weather);

    // Load FBX
    const loader = new FBXLoader();
    loader.load(fbxUrl, (object) => {
      object.traverse(function(child) {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = true;
          (child as THREE.Mesh).receiveShadow = true;
        }
      });
      scene.add(object);
      controls.target.set(0, 90, 0);
    });

    // Animation loop
    const animate = () => {
      // Animate rain
      if (rainParticles) {
        const positions = rainParticles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          let y = positions.getY(i) - 8;
          if (y < 0) y = 900;
          positions.setY(i, y);
        }
        positions.needsUpdate = true;
      }
      // Animate wind
      if (windParticles) {
        const positions = windParticles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          let x = positions.getX(i) + 6 * Math.sin(Date.now() * 0.001 + i);
          if (x > 600) x = -600;
          positions.setX(i, x);
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
      while (mountRef.current && mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
    };
  }, [fbxUrl, width, height, weather]);

  return (
    <div className="relative" style={{ width, height }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        {["sunny", "rainy", "windy", "foggy"].map(w => (
          <button
            key={w}
            className={`px-4 py-2 rounded ${weather === w ? "bg-black text-white" : "bg-gray-200 text-gray-700"}`}
            onClick={() => setWeather(w as any)}
          >
            {w.charAt(0).toUpperCase() + w.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}