"use client";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { FBXLoader, OrbitControls } from "three-stdlib";

export default function GlassDoorTestPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [weather, setWeather] = useState<"sunny" | "rainy" | "windy" | "foggy">("sunny");

  useEffect(() => {
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let controls: OrbitControls;
    let animationId: number;
    let rainParticles: THREE.Points | null = null;
    let windParticles: THREE.Points | null = null;
    let directionalLight: THREE.DirectionalLight;
    let shadowPlane: THREE.Mesh | null = null;

    function init() {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.set(0, 2, 6);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      mountRef.current!.appendChild(renderer.domElement);

      controls = new OrbitControls(camera, renderer.domElement);

      // Lighting
      directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(5, 10, 7.5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);

      // Ambient light
      scene.add(new THREE.AmbientLight(0xffffff, 0.5));

      // Load FBX Model
      const loader = new FBXLoader();
      loader.load(
        "/GlassDoorTestModel.fbx",
        (object) => {
          object.scale.set(0.01, 0.01, 0.01);
          object.traverse(function (child) {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(object);
        },
        undefined,
        (error) => {
          console.error("Error loading FBX model:", error);
        }
      );

      addWeatherEffect(weather);

      window.addEventListener("resize", onWindowResize, false);
    }

    function addWeatherEffect(type: "sunny" | "rainy" | "windy" | "foggy") {
      // Remove previous effects
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
      if (shadowPlane) {
        scene.remove(shadowPlane);
        shadowPlane.geometry.dispose();
        (shadowPlane.material as THREE.Material).dispose();
        shadowPlane = null;
      }
      scene.fog = null;

      // Sunny: bright light, black shadow
      if (type === "sunny") {
        directionalLight.intensity = 1.5;
        scene.background = new THREE.Color(0xbfd1e5);

        // Add shadow plane
        const planeGeometry = new THREE.PlaneGeometry(10, 10);
        const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.7 });
        shadowPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);
      }

      // Rainy: add rain particles, dim light
      if (type === "rainy") {
        directionalLight.intensity = 0.7;
        scene.background = new THREE.Color(0x7a7a7a);

        const rainGeo = new THREE.BufferGeometry();
        const rainCount = 1500;
        const rainPositions = [];
        for (let i = 0; i < rainCount; i++) {
          rainPositions.push(
            Math.random() * 10 - 5,
            Math.random() * 10,
            Math.random() * 10 - 5
          );
        }
        rainGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(rainPositions, 3)
        );
        const rainMaterial = new THREE.PointsMaterial({
          color: 0xaaaaaa,
          size: 0.05,
          transparent: true,
        });
        rainParticles = new THREE.Points(rainGeo, rainMaterial);
        scene.add(rainParticles);
      }

      // Windy: add moving particles, normal light
      if (type === "windy") {
        directionalLight.intensity = 1.2;
        scene.background = new THREE.Color(0xdbefff);

        const windGeo = new THREE.BufferGeometry();
        const windCount = 500;
        const windPositions = [];
        for (let i = 0; i < windCount; i++) {
          windPositions.push(
            Math.random() * 10 - 5,
            Math.random() * 10,
            Math.random() * 10 - 5
          );
        }
        windGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(windPositions, 3)
        );
        const windMaterial = new THREE.PointsMaterial({
          color: 0x99ccff,
          size: 0.07,
          transparent: true,
        });
        windParticles = new THREE.Points(windGeo, windMaterial);
        scene.add(windParticles);
      }

      // Foggy: add fog effect
      if (type === "foggy") {
        directionalLight.intensity = 0.8;
        scene.background = new THREE.Color(0xcfd8dc);
        scene.fog = new THREE.Fog(0xcfd8dc, 5, 15);
      }
    }

    function animate() {
      animationId = requestAnimationFrame(animate);

      // Animate rain
      if (rainParticles) {
        const positions = rainParticles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          let y = positions.getY(i) - 0.2;
          if (y < 0) y = 10;
          positions.setY(i, y);
        }
        positions.needsUpdate = true;
      }

      // Animate wind
      if (windParticles) {
        const positions = windParticles.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          let x = positions.getX(i) + 0.05 * Math.sin(Date.now() * 0.001 + i);
          if (x > 5) x = -5;
          positions.setX(i, x);
        }
        positions.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    }

    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }

    init();
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onWindowResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line
  }, [weather]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col text-black">
      <div className="flex justify-center gap-4 py-4 bg-white shadow">
        <button
          className={`px-4 py-2 rounded font-semibold ${
            weather === "sunny" ? "bg-yellow-400 text-white" : "bg-gray-200"
          }`}
          onClick={() => setWeather("sunny")}
        >
          Sunny
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold ${
            weather === "rainy" ? "bg-blue-400 text-white" : "bg-gray-200"
          }`}
          onClick={() => setWeather("rainy")}
        >
          Rainy
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold ${
            weather === "windy" ? "bg-green-400 text-white" : "bg-gray-200"
          }`}
          onClick={() => setWeather("windy")}
        >
          Windy
        </button>
        <button
          className={`px-4 py-2 rounded font-semibold ${
            weather === "foggy" ? "bg-gray-400 text-white" : "bg-gray-200"
          }`}
          onClick={() => setWeather("foggy")}
        >
          Foggy
        </button>
      </div>
      <div ref={mountRef} className="flex-1" />
    </div>
  );
}