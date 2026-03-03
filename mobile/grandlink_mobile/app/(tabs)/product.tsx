import '../../utils/polyfills';
// Force reload
import React, { useEffect, useState, useRef } from 'react';
import { Asset } from 'expo-asset';
import { View, Text, Image as RNImage, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, PanResponder, Modal, Alert, Platform, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

// Lazy load expo-gl to prevent startup errors
let GLView: any = null;
let ExpoWebGLRenderingContext: any = null;
try {
  const expoGL = require('expo-gl');
  GLView = expoGL.GLView;
  ExpoWebGLRenderingContext = expoGL.ExpoWebGLRenderingContext;
} catch (error) {
  console.warn('expo-gl not available:', error);
}

// @ts-ignore
import * as THREE from 'three';
import { GLTFLoader, DRACOLoader, FBXLoader } from 'three-stdlib';
// import { RGBELoader } from 'three-stdlib';
import BottomNavBar from "@BottomNav/../components/BottomNav";

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProductViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Weather state
  const [weatherMode, setWeatherMode] = useState<'sunny' | 'rainy' | 'foggy' | 'night'>('sunny');

  // Measurements State
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurementUnit, setMeasurementUnit] = useState<'mm' | 'cm'>('mm');
  const [modelDimensions, setModelDimensions] = useState<{ width: number, height: number, depth: number } | null>(null);
  const [measurementLabels, setMeasurementLabels] = useState<Array<{ text: string, x: number, y: number }>>([]);
  const measurementGroupRef = useRef<THREE.Group | null>(null);

  // Custom Skybox & Color State (Supabase)
  const [skyboxData, setSkyboxData] = useState<Record<string, string> | null>(null);
  const skyboxDataRef = useRef<Record<string, string> | null>(null);
  // Active skybox URL for the current weather – drives the native RNImage layer
  const [activeSkyboxUrl, setActiveSkyboxUrl] = useState<string | null>(null);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [activeColor, setActiveColor] = useState<string>('#ORIGINAL');
  const [colorPickerModalVisible, setColorPickerModalVisible] = useState(false); // Modal for color picker
  const activeColorRef = useRef<string>('#ORIGINAL');

  // Keep skyboxDataRef in sync and re-apply current weather when skybox data changes
  useEffect(() => {
    skyboxDataRef.current = skyboxData;
    
    // Clear cached textures so new URLs are loaded fresh
    skyboxTextureCache.current.forEach((tex) => {
      try { tex.dispose(); } catch { }
    });
    skyboxTextureCache.current.clear();
    envMapCache.current.clear();

    // IMPORTANT: If 3D viewer is open AND we now have skybox data, re-apply current weather
    if (skyboxData && sceneRef.current && rendererRef.current) {
      setupWeatherLighting(sceneRef.current, weatherMode);
    }
  }, [skyboxData, weatherMode]);

  // React to weather mode changes and update 3D environment
  useEffect(() => {
    if (sceneRef.current && rendererRef.current) {
      setupWeatherLighting(sceneRef.current, weatherMode);
      
      // Force a render to show the new skybox immediately
      if (cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  }, [weatherMode, skyboxData]); // Also depend on skyboxData so it re-renders when data arrives

  // 3D model cache and references
  const modelCache = useRef<Map<string, THREE.Object3D>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Environment and effects
  const envMapRef = useRef<THREE.Texture | null>(null);
  // Cache for solid-color fallbacks per weather type
  const envMapCache = useRef<Map<string, THREE.Color>>(new Map());
  // Separate cache for actual Supabase skybox textures per weather type
  const skyboxTextureCache = useRef<Map<string, THREE.Texture>>(new Map());
  const fogRef = useRef<THREE.Fog | null>(null);

  // Rain particle reference - using LineSegments for realistic streaks
  const rainRef = useRef<THREE.LineSegments | null>(null);
  const rainVelocities = useRef<Float32Array | null>(null);

  // Persistent lights for instant weather switching (reused, not recreated)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight | null>(null);
  const pointLight1Ref = useRef<THREE.PointLight | null>(null);
  const groundPlaneRef = useRef<THREE.Mesh | null>(null); // Ground plane for shadow visibility

  // Skybox and Sun refs
  const skyboxRef = useRef<THREE.Mesh | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);

  // Store the expo-gl context for WebGL operations and texture management
  const glRef = useRef<any>(null);

  // Create realistic rain streaks
  const createRain = (scene: THREE.Scene) => {
    if (rainRef.current) {
      return;
    }
    const count = 3500; // Massively increased for intense rain coverage
    const positions = new Float32Array(count * 6); // 2 points per line = 6 values (x1,y1,z1,x2,y2,z2)
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {

      // Position rain across MASSIVE area - covers entire possible view
      // Create rain in an enormous area to ensure full coverage
      const x = (Math.random() - 0.5) * 900;
      const y = Math.random() * 1000 - 200; // Range from -200 to +800 for full vertical coverage
      const z = (Math.random() - 0.5) * 900;

      // Each raindrop is a vertical line segment (streak)
      const streakLength = 6.0 + Math.random() * 6.0; // MUCH BIGGER streaks (6.0-10.0 units)
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y - streakLength;
      positions[i * 6 + 5] = z;

      // Extremely fast falling speeds - intense downpour
      velocities[i] = 1.2 + Math.random() * 10; // Extremely fast (1.2-1.6)
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create blue rain streaks for realistic rain effect
    const mat = new THREE.LineBasicMaterial({
      color: 0x4da6ff, // Light blue color for rain
      transparent: true,
      opacity: 0.7, // Semi-transparent
      linewidth: 3, // Thicker lines
      depthTest: true,
      depthWrite: false
    });

    const lines = new THREE.LineSegments(geom, mat);
    lines.frustumCulled = false; // Always render
    lines.renderOrder = 999; // Render on top
    rainRef.current = lines;
    rainVelocities.current = velocities;
    scene.add(lines);
  };
  const removeRain = (scene: THREE.Scene) => {
    if (!rainRef.current) {
      return;
    }
    scene.remove(rainRef.current);
    try {
      (rainRef.current.geometry as any).dispose();
      (rainRef.current.material as any).dispose();
    } catch { }
    rainRef.current = null;
    rainVelocities.current = null;
  };

  // Memoize expensive weather color calculations
  const weatherColors = React.useMemo(() => ({
    sunny: 0x87CEEB,
    rainy: 0xBFD1E5,
    foggy: 0xD6DBE0,
    night: 0x0B1020,
  }), []);

  // SKYBOX: Load texture from URL and apply as background sphere
  const loadAndApplySkybox = async (weatherType: 'sunny' | 'rainy' | 'foggy' | 'night'): Promise<void> => {
    const skyUrl = skyboxDataRef.current?.[weatherType]?.trim();
    
    // Remove any existing skybox
    removeSkybox();
    
    if (!skyUrl) {
      if (rendererRef.current) {
        const colors = { sunny: 0x87ceeb, rainy: 0xbfd1e5, foggy: 0xd6dbe0, night: 0x0b1020 };
        rendererRef.current.setClearColor(colors[weatherType] || 0x87ceeb, 1);
      }
      return;
    }
    
    if (!sceneRef.current || !rendererRef.current || !glRef.current) {
      return;
    }
    
    try {
      
      // Step 1: Get image dimensions
      const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
        RNImage.getSize(
          skyUrl, 
          (w, h) => {
            resolve({ width: w, height: h });
          },
          () => resolve({ width: 2048, height: 1024 })
        );
      });
      
      // Step 2: Download image file to local filesystem
      const asset = Asset.fromURI(skyUrl);
      await asset.downloadAsync();
      
      if (!asset.localUri) {
        throw new Error('Asset download failed - no localUri');
      }
      
      // Step 3: Create a native WebGL texture directly via expo-gl
      // expo-gl's C++ texImage2D reads localUri from any JS object and decodes with stb_image
      const gl = glRef.current;
      const nativeTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, nativeTexture);
      
      // Set texture parameters BEFORE uploading data
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // Upload image data - expo-gl's native layer reads localUri and decodes the image
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        { localUri: asset.localUri } as any  // expo-gl reads this in C++ via stb_image
      );
      
      gl.bindTexture(gl.TEXTURE_2D, null);
      
      console.log(`Native GL texture created and uploaded`);
      
      // Step 4: Create a THREE.Texture wrapper that uses our native texture
      const texture = new THREE.Texture();
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.flipY = false;
      
      // CRITICAL: Tell THREE.js this texture is already uploaded to the GPU
      // By setting __webglTexture directly on the renderer's texture properties,
      // THREE.js will skip its own upload and use our native texture
      const renderer = rendererRef.current;
      const textureProperties = renderer.properties.get(texture);
      textureProperties.__webglTexture = nativeTexture;
      textureProperties.__webglInit = true;
      
      console.log(`THREE.Texture linked to native GL texture`);
      
      // Step 5: Create skybox sphere
      const geometry = new THREE.SphereGeometry(500, 64, 32);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        depthTest: false,
      });
      
      const skyboxMesh = new THREE.Mesh(geometry, material);
      skyboxMesh.name = 'SkyboxSphere';
      skyboxMesh.renderOrder = -1000;
      skyboxMesh.frustumCulled = false;
      skyboxMesh.scale.set(1, -1, 1); // Flip vertically — expo-gl loads textures upside down
      
      sceneRef.current.add(skyboxMesh);
      skyboxRef.current = skyboxMesh;
      
      // Transparent clear so the sphere shows
      renderer.setClearColor(0x000000, 0);
      renderer.setClearAlpha(0);
      
      // Force render
      if (cameraRef.current) {
        renderer.render(sceneRef.current, cameraRef.current);
      }
      
      console.log(`Skybox visible for ${weatherType}!`);
      
    } catch (error) {
      console.error(`Failed to load skybox for ${weatherType}:`, error);
      if (rendererRef.current) {
        const colors = { sunny: 0x87ceeb, rainy: 0xbfd1e5, foggy: 0xd6dbe0, night: 0x0b1020 };
        rendererRef.current.setClearColor(colors[weatherType] || 0x87ceeb, 1);
      }
    }
  };

  // Remove existing skybox sphere
  const removeSkybox = () => {
    if (skyboxRef.current && sceneRef.current) {
      sceneRef.current.remove(skyboxRef.current);
      
      // Dispose resources
      try {
        (skyboxRef.current.geometry as any).dispose();
        if ((skyboxRef.current.material as any).map) {
          (skyboxRef.current.material as any).map.dispose();
        }
        (skyboxRef.current.material as any).dispose();
      } catch (e) {
        console.warn('Disposal warning:', e);
      }
      
      skyboxRef.current = null;
    }
  };

  // Enhanced fog effects with better visibility  
  const setupFogEffects = (scene: THREE.Scene, weatherType: 'sunny' | 'rainy' | 'foggy' | 'night') => {
    // Remove existing fog
    scene.fog = null;

    switch (weatherType) {
      case 'foggy':
        // Very light fog that only appears in the distance
        // Near: 80 (fog starts very far), Far: 400 (very gentle fade)
        scene.fog = new THREE.Fog(0xD6DBE0, 80, 400);
        break;
      case 'rainy':
        // No fog for rainy mode - clear visibility for rain particles
        scene.fog = null;
        break;
      case 'night':
        // Very minimal fog for night atmosphere
        scene.fog = new THREE.Fog(0x0B1020, 100, 500);
        break;
      case 'sunny':
      default:
        // Clear visibility
        scene.fog = null;
        break;
    }
  };

  // 3D controls - Orbit (Start Front View ~90 deg)
  const [rotation, setRotation] = useState({ x: Math.PI / 2, y: 0 });
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  const [cameraDistance, setCameraDistance] = useState(5.0);
  const cameraDistanceRef = useRef(cameraDistance);
  useEffect(() => { cameraDistanceRef.current = cameraDistance; }, [cameraDistance]);

  // Store the calculated "optimal" distance for reset
  const defaultDistanceRef = useRef(5.0);

  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const lastRotation = useRef({ x: 0, y: 0 });

  const resetViewerTransform = () => {
    setRotation({ x: Math.PI / 2, y: 0 });
    setCameraDistance(defaultDistanceRef.current);
  };

  // NOTE: 'features' useMemo has been moved earlier to preserve hook order
  // Normalize additional features into an array for display
  const features: string[] = React.useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.additional_features_array) && product.additional_features_array.length > 0) {
      return product.additional_features_array;
    }
    if (product.additional_features_text) {
      return product.additional_features_text.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
    }
    const raw = product?.raw?.additional_features ?? product?.raw?.features ?? '';
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (typeof raw === 'object') return Object.entries(raw).map(([k, v]) => `${k}: ${v}`);
    return String(raw).split(/\r?\n|,/).map((s: string) => s.trim()).filter(Boolean);
  }, [product]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        console.log(`Fetching product with ID: ${id}`);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Supabase error:', error);
          setLoading(false);
          return;
        }

        console.log('Raw product data from Supabase:', {
          id: data?.id,
          name: data?.name,
          skyboxes: data?.skyboxes,
          skyboxesType: typeof data?.skyboxes,
          allFields: Object.keys(data || {})
        });

        // Normalize product fields so UI always uses same keys
        const normalizeProduct = (raw: any) => {
          // Check for GLB/GLTF URLs first, then fallback to FBX fields (assuming they might contain GLB now)
          const model_raw = raw?.glb_url ?? raw?.glb_urls ?? raw?.model_url ?? raw?.model_urls ?? raw?.fbx_url ?? raw?.fbx_urls ?? '';
          let glb_urls: string[] = [];

          // accept comma-separated, JSON array string, or single URL
          if (typeof model_raw === 'string') {
            const trimmed = model_raw.trim();
            if (trimmed.startsWith('[')) {
              try { glb_urls = JSON.parse(trimmed); } catch { glb_urls = trimmed.split(',').map(s => s.trim()).filter(Boolean); }
            } else {
              glb_urls = trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
          } else if (Array.isArray(model_raw)) {
            glb_urls = model_raw.filter(Boolean);
          }

          // Filter for valid URLs (basic check)
          glb_urls = glb_urls.filter(url => url && url.length > 5);

          const images: string[] = [];
          if (raw?.image1) images.push(raw.image1);
          if (raw?.image2) images.push(raw.image2);
          if (raw?.images && Array.isArray(raw.images)) images.push(...raw.images.filter(Boolean));


          // collect any plausible features/specs field names
          const featuresRaw =
            raw?.additional_features ??
            raw?.features ??
            raw?.specifications ??
            raw?.specs ??
            raw?.attributes ??
            raw?.feature_list ??
            '';

          // normalize features into array and readable text
          const normalizeFeatures = (input: any): { list: string[]; text: string } => {
            if (!input && typeof input !== 'number') return { list: [], text: '' };

            // If already an array
            if (Array.isArray(input)) {
              const arr = input.map((v: any) => String(v).trim()).filter(Boolean);
              return { list: arr, text: arr.join('\n') };
            }

            // If object/map -> convert entries to "Key: Value"
            if (typeof input === 'object') {
              const entries = Object.entries(input).map(([k, v]) => `${k}: ${v}`);
              return { list: entries, text: entries.join('\n') };
            }

            // it's a string - try JSON parse first
            let s = String(input).trim();
            if (!s) return { list: [], text: '' };

            if (s.startsWith('[')) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) {
                  const arr = parsed.map((v: any) => String(v).trim()).filter(Boolean);
                  return { list: arr, text: arr.join('\n') };
                }
              } catch {
                // fallthrough to splitting
              }
            }

            // split by newline, semicolon or comma
            const parts = s.split(/\r?\n|;|,/).map(p => p.trim()).filter(Boolean);
            return { list: parts, text: parts.join('\n') };
          };

          const { list: additional_features_array, text: additional_features_text } = normalizeFeatures(featuresRaw);

          return {
            id: raw?.id,
            name: raw?.name ?? raw?.title ?? 'Untitled',
            sku: raw?.sku ?? raw?.code ?? raw?.id,
            price: raw?.price ?? 0,
            stock: (typeof raw?.inventory === 'number' ? raw.inventory : (raw?.stock ?? 0)) ?? 0,
            reserved_stock: typeof raw?.reserved_stock === 'number' ? raw.reserved_stock : 0,
            description: raw?.description ?? raw?.short_description ?? '',
            short_description: raw?.short_description ?? raw?.description ?? '',
            additional_features: raw?.additional_features ?? raw?.features ?? '',
            additional_features_array,
            additional_features_text,
            notes: raw?.notes ?? '',
            category: raw?.category ?? '',
            material: raw?.material ?? '',
            width: raw?.width ?? raw?.w ?? null,
            height: raw?.height ?? raw?.h ?? null,
            thickness: raw?.thickness ?? raw?.thick ?? null,
            type: raw?.type ?? '',
            images,
            image1: images[0] ?? null,
            glb_urls,
            skyboxes: raw?.skyboxes ?? null, // Expecting JSON object: { "sunny": "url", "rainy": "url", ... }
            colors: raw?.colors ?? raw?.available_colors ?? [], // Expecting array of hex strings or objects
            raw,
          };
        };

        const normalized = normalizeProduct(data);

        setProduct(normalized);

        // Set skybox and color data from normalized product
        if (normalized.skyboxes) {
          console.log('SKYBOX DATA FOUND in Supabase:', normalized.skyboxes);
          console.log('Skybox type:', typeof normalized.skyboxes);
          console.log('Skybox stringified:', JSON.stringify(normalized.skyboxes));
          
          // Handle string JSON skyboxes data
          let skyboxData = normalized.skyboxes;
          if (typeof skyboxData === 'string') {
            try {
              skyboxData = JSON.parse(skyboxData);
              console.log('Parsed skybox JSON:', skyboxData);
            } catch (e) {
              console.error('Failed to parse skybox JSON:', e);
              skyboxData = null;
            }
          }
          
          if (skyboxData && typeof skyboxData === 'object') {
            setSkyboxData(skyboxData);
            
            // FORCE IMMEDIATE SKYBOX LOAD FOR TESTING
            const testWeather = 'sunny';
            const testUrl = skyboxData[testWeather];
            if (testUrl) {
              console.log(`FORCING immediate skybox load: ${testWeather} -> ${testUrl}`);
              // Update ref immediately so loadAndApplySkybox can use it
              skyboxDataRef.current = skyboxData;
              // Force load it after a short delay to ensure everything is initialized
              setTimeout(() => {
                console.log('Delayed skybox load triggered!');
                loadAndApplySkybox(testWeather).catch(err => {
                  console.error('Forced skybox load failed:', err);
                });
              }, 2000);
            } else {
              console.log('No sunny URL found in skybox data');
            }
          } else {
            console.warn('Invalid skybox data format');
            setSkyboxData(null);
          }
        } else {
          console.log('No skybox data found in database yet - waiting for admin to upload backgrounds');
          setSkyboxData(null);
        }

        if (normalized.colors && Array.isArray(normalized.colors) && normalized.colors.length > 0) {
          console.log('Setting product colors:', normalized.colors);
          const colors = normalized.colors.map((c: any) => typeof c === 'string' ? c : c.hex || c.color).filter(Boolean);
          setProductColors(colors);
          setActiveColor(colors[0]); // Set first color as default
        } else {
          console.log('No colors found in product data, using frame colors');
          // Frame colors based on the image: Default (original model color), Matte Black, Matte Gray, Narra, Walnut
          const frameColors = [
            '#ORIGINAL', // Special marker for original color - will be handled differently
            '#1a1a1a',   // Matte Black
            '#6b6b6b',   // Matte Gray
            '#8B4513',   // Narra (brown)
            '#5C4033',   // Walnut (dark brown)
          ];
          setProductColors(frameColors);
          setActiveColor(frameColors[0]);
        }

        setSelectedModelIndex(0);
        setLoading(false);

        // Preload first GLB if present
        if (normalized.glb_urls && normalized.glb_urls.length > 0) {
          // Preload all models for quick switching
          normalized.glb_urls.forEach((u: string) => preloadModel(u, normalized));
        } else {
          console.warn(`No valid GLB URLs found for product: ${normalized.name}`);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      // Clean up skybox
      removeSkybox();
      // Clean up texture cache
      skyboxTextureCache.current.forEach((tex) => {
        try { tex.dispose(); } catch { }
      });
      skyboxTextureCache.current.clear();
      // Clean up renderer and scene
      if (rendererRef.current) rendererRef.current.dispose();
      if (sceneRef.current) sceneRef.current.clear();
    };
  }, [id]);

  // Enhanced GLB model loader (preferred for mobile)
  const loadSupabaseGLBModel = async (glbUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
        // Validate URL before proceeding
        if (!glbUrl || typeof glbUrl !== 'string' || glbUrl.trim() === '') {
          throw new Error('Invalid GLB URL provided');
        }

        if (typeof TextDecoder === 'undefined') {
          console.error('TextDecoder is NOT available. GLB loading will fail.');
        }

        const loader = new GLTFLoader();

        // Optional: Add DRACO compression support for even smaller files
        const dracoLoader = new DRACOLoader();
        try {
          // Use a reliable CDN for the decoder
          dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          loader.setDRACOLoader(dracoLoader);
          console.log('DRACO compression support enabled');
        } catch (e) {
          console.log('DRACO loader not available, using standard GLB');
        }

        loader.load(
          glbUrl,
          (gltf: any) => {
            const model = gltf.scene;

            // GLB models are usually properly scaled, but ensure visibility
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log('Raw Model Center:', center);
            console.log('Raw Model Size:', size);

            // Enable shadows and enhance materials for better reflections (like web version)
            model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Enhance material reflections like web version
                if (child.material) {
                  const materials = Array.isArray(child.material) ? child.material : [child.material];
                  materials.forEach((mat: any) => {
                    if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                      // Boost environment map intensity for better reflections (web uses 2.0-4.0)
                      mat.envMapIntensity = 2.0;

                      // Ensure proper roughness for reflections
                      if (mat.roughness !== undefined) {
                        mat.roughness = Math.max(0.05, mat.roughness);
                      }

                      mat.needsUpdate = true;
                    }
                  });
                }
                // Tag material to preserve it
                if ((child as THREE.Mesh).material) {
                  ((child as THREE.Mesh).material as any).userData = { ...((child as THREE.Mesh).material as any).userData, isGLB: true };
                }
              }
            });
            // Also tag the root
            model.userData.isGLB = true;

            console.log(`GLB model ready: ${gltf.animations.length} animations, ${gltf.scenes.length} scenes`);
            resolve(model);
          },
          (progress: any) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setLoadingProgress(percent);
            console.log(`GLB loading progress: ${percent}%`);
          },
          (error: any) => {
            console.error(`GLB loading failed for product ${productId}:`, error);
            reject(error);
          }
        );
      } catch (error) {
        console.error(`GLB loader setup failed:`, error);
        reject(error);
      }
    });
  };



  // GLB model loader - only format we support
  const loadGLBModel = async (modelUrl: string, productId: string): Promise<THREE.Object3D> => {
    // Validate input
    if (!modelUrl || typeof modelUrl !== 'string' || modelUrl.trim() === '') {
      throw new Error('Invalid GLB model URL provided');
    }

    return await loadSupabaseGLBModel(modelUrl, productId);
  };


  // Simple fallback model
  const createFallbackModel = (productData?: any) => {
    // Create a more visible fallback model
    const group = new THREE.Group();

    // Main body - a larger box
    const geometry = new THREE.BoxGeometry(2, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4444, // Bright red
      metalness: 0.3,
      roughness: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    group.add(mesh);

    // Add a small indicator cube on top
    const topGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x44ff44, // Bright green
      metalness: 0.3,
      roughness: 0.7
    });
    const topMesh = new THREE.Mesh(topGeometry, topMaterial);
    topMesh.position.set(0, 1, 0);
    group.add(topMesh);

    // Enable shadows
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;

    return group;
  };

  // Preload GLB model for faster viewing
  const preloadModel = async (modelUrl: string, productData?: any) => {
    if (!modelUrl || typeof modelUrl !== 'string' || (modelUrl as string).trim() === '') {
      console.warn('Invalid modelUrl provided to preloadModel');
      return;
    }

    if (modelCache.current.has(modelUrl)) return;

    try {
      // Load GLB model (only format we support)
      const model3D = await loadGLBModel(modelUrl, productData?.id || 'unknown');
      modelCache.current.set(modelUrl, model3D);
    } catch (error) {
      console.warn('GLB loading failed, using fallback:', error);
      // Use fallback model if GLB loading fails
      const fallbackModel = createFallbackModel();
      modelCache.current.set(modelUrl, fallbackModel);
    }
  };

  // Enhanced glass material with environment mapping
  const createGlassMaterial = (envMap?: THREE.Texture | null): THREE.Material => {
    // For Android/mobile, use simpler material that works with WebGL 1
    if (Platform.OS === 'android') {
      const materialProps: any = {
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.02,
        metalness: 0.0,
        side: THREE.DoubleSide,
        flatShading: false,
      };

      if (envMap) {
        materialProps.envMap = envMap;
        materialProps.envMapIntensity = 2.0;
      }

      const mat = new THREE.MeshStandardMaterial(materialProps);
      return mat as THREE.Material;
    }

    // iOS/Web: Advanced glass material with transmission
    const materialProps: any = {
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.01,
      metalness: 0.0,
      side: THREE.DoubleSide,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    };

    if (envMap) {
      materialProps.envMap = envMap;
      materialProps.envMapIntensity = 2.5;
    }

    const mat = new (THREE as any).MeshPhysicalMaterial(materialProps);

    try {
      // Advanced features for WebGL2
      (mat as any).transmission = 0.98;
      (mat as any).ior = 1.52;
      (mat as any).thickness = 0.1;
      (mat as any).attenuationDistance = 0.5;
      (mat as any).attenuationColor = new THREE.Color(0xffffff);
    } catch (e) {
      // Advanced glass features not available, using fallback
    }

    return mat as unknown as THREE.Material;
  };

  // Enhanced frame material with PBR
  const createFrameMaterial = (envMap?: THREE.Texture | null): THREE.Material => {
    const materialProps: any = {
      color: 0x2a2a2a,
      metalness: 0.95,
      roughness: 0.15,
    };

    if (envMap) {
      materialProps.envMap = envMap;
      materialProps.envMapIntensity = 1.8;
    }

    const mat = new THREE.MeshStandardMaterial(materialProps);
    return mat as THREE.Material;
  };

  // Create enhanced default material with environment mapping
  const createDefaultMaterial = (envMap?: THREE.Texture | null): THREE.Material => {
    const materialProps: any = {
      color: 0xcccccc,
      metalness: 0.1,
      roughness: 0.7,
    };

    if (envMap) {
      materialProps.envMap = envMap;
      materialProps.envMapIntensity = 1.0;
    }

    const mat = new THREE.MeshStandardMaterial(materialProps);
    return mat as THREE.Material;
  };

  // Heuristics to detect glass-like meshes by name/material
  const isGlassLike = (mesh: THREE.Mesh, material: any): boolean => {
    const names: string[] = [
      (mesh.name || '').toLowerCase(),
      (material?.name || '').toLowerCase(),
    ];
    const joined = names.join(' ');
    if (/glass|pane|window|glazing|mirror/.test(joined)) return true;
    // If source material already intended to be transparent
    if (typeof material?.opacity === 'number' && material.opacity < 0.75) return true;
    return false;
  };

  // Heuristics to detect frame-like meshes by name/material  
  const isFrameLike = (mesh: THREE.Mesh, material: any): boolean => {
    const names: string[] = [
      (mesh.name || '').toLowerCase(),
      (material?.name || '').toLowerCase(),
    ];
    const joined = names.join(' ');
    return /frame|alumi|metal|steel|hinge|handle|rail|support|bar|edge|border/.test(joined);
  };

  // Simple material processing for GLB models (preserve existing materials)
  const processGLBMaterials = (object: THREE.Object3D) => {
    // GLB models already have proper materials, just enable shadows
    object.traverse((child: THREE.Object3D) => {
      if ((child as any).isMesh) {
        const mesh = child as unknown as THREE.Mesh;
        // Enable shadows for better realism
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  };

  // Initialize persistent lights once
  const initializeLights = (scene: THREE.Scene) => {
    // Ensure ambient light is in the scene
    if (!ambientLightRef.current) {
      ambientLightRef.current = new THREE.AmbientLight(0xffffff, 1.0);
    }
    if (ambientLightRef.current.parent !== scene) {
      scene.add(ambientLightRef.current);
    }

    // Hemisphere light for natural sky/ground lighting (like web version)
    if (!hemisphereLightRef.current) {
      hemisphereLightRef.current = new THREE.HemisphereLight(
        0xffffff, // Sky color
        0x444444, // Ground color
        1.0       // Intensity
      );
    }
    if (hemisphereLightRef.current.parent !== scene) {
      scene.add(hemisphereLightRef.current);
    }

    // Add subtle ground plane for shadow visibility  
    if (!groundPlaneRef.current) {
      const planeGeometry = new THREE.PlaneGeometry(100, 100); // Smaller ground plane for better proportions
      const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
      groundPlaneRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      groundPlaneRef.current.rotation.x = -Math.PI / 2; // Make horizontal
      groundPlaneRef.current.position.y = -6; // Default position (will be auto-adjusted per model)
      groundPlaneRef.current.receiveShadow = true;
      scene.add(groundPlaneRef.current);
      console.log('Shadow-receiving ground plane added (will auto-position per model)');
    }

    // Ensure directional light is in the scene
    if (!directionalLightRef.current) {
      directionalLightRef.current = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLightRef.current.position.set(5, 10, 5);
      directionalLightRef.current.lookAt(0, 0, 0); // Always point at model center
      directionalLightRef.current.castShadow = true;
      scene.add(directionalLightRef.current);
    }
    if (directionalLightRef.current.parent !== scene) {
      scene.add(directionalLightRef.current);
    }

    // Ensure point light is initialized (used for night mode)
    if (!pointLight1Ref.current) {
      pointLight1Ref.current = new THREE.PointLight(0xffffff, 0, 25);
      pointLight1Ref.current.position.set(0, 8, 5);
      pointLight1Ref.current.castShadow = true;
    }
    if (pointLight1Ref.current.parent !== scene) {
      scene.add(pointLight1Ref.current);
    }
  };



  // Create consistent environment mapping for lighting (simplified to avoid shader errors)
  const setupStudioEnvironment = (scene: THREE.Scene, renderer: THREE.WebGLRenderer) => {
    try {
      // Use a simple approach that doesn't cause WebGL shader compilation issues
    } catch (error) {
      console.warn('Studio environment setup failed:', error);
    }
  };

  // Utility function to set texture color space safely (from React.js reference)
  const setTexColorSpace = (tex: THREE.Texture) => {
    if (!tex) return;
    try {
      const anyTHREE: any = THREE;
      if ('colorSpace' in tex && anyTHREE.SRGBColorSpace !== undefined) {
        (tex as any).colorSpace = anyTHREE.SRGBColorSpace;
      } else if ('encoding' in tex && anyTHREE.sRGBEncoding !== undefined) {
        (tex as any).encoding = anyTHREE.sRGBEncoding;
      }
    } catch (e) {
      console.warn('Color space setting failed:', e);
    }
  };

  // Active skybox tracking (from React.js reference)
  const activeSkyboxUrlRef = useRef<string | null>(null);



  // Create a visible Sun mesh
  const createSun = (scene: THREE.Scene) => {
    if (sunMeshRef.current) return;

    // Create a glowing sun sphere
    const geometry = new THREE.SphereGeometry(1.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.9,
    });
    const sun = new THREE.Mesh(geometry, material);

    // Position sun to match directional light (high and far for natural look)
    sun.position.set(100, 150, 50); // Match web version sun position
    sun.name = 'Sun';

    // Add a glow effect (larger semi-transparent sphere)
    const glowGeometry = new THREE.SphereGeometry(2.5, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.4,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    sun.add(glow);

    sunMeshRef.current = sun;
    scene.add(sun);
  };

  // Store original material colors
  const originalColorsRef = useRef<Map<string, THREE.Color>>(new Map());

  // Apply color to model materials
  const applyModelColor = (model: THREE.Object3D, colorHex: string) => {
    if (!model || !colorHex) return;

    // Special case: #ORIGINAL means restore the original model colors
    if (colorHex === '#ORIGINAL') {
      model.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const originalColor = originalColorsRef.current.get(child.uuid);
          if (originalColor && (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) {
            child.material.color.copy(originalColor);
          }
        }
      });
      return;
    }

    const color = new THREE.Color(colorHex);

    model.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Skip skybox and sun
        if (child.name === 'Skybox' || child.name === 'Sun') return;

        // Dont color glass or transparent materials usually
        // Heuristic: check if material name implies "paint" or "body" or just apply to everything that isn't glass/chrome
        const matName = (child.material.name || '').toLowerCase();
        const meshName = (child.name || '').toLowerCase();

        if (matName.includes('glass') || meshName.includes('glass') ||
          matName.includes('window') || meshName.includes('window') ||
          child.material.transparent) {
          return;
        }

        // Store original color if not already stored
        if (!originalColorsRef.current.has(child.uuid) &&
          (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial)) {
          originalColorsRef.current.set(child.uuid, child.material.color.clone());
        }

        // Simple approach: Apply to all standard/physical materials that aren't glass
        if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
          child.material.color.set(color);
        }
      }
    });
  };

  // Optimize color application effect to prevent unnecessary re-renders
  useEffect(() => {
    activeColorRef.current = activeColor;
    // Only apply colors if we have an active scene and model
    if (activeColor && sceneRef.current && currentModelRef.current) {
      applyModelColor(currentModelRef.current, activeColor);
    }
  }, [activeColor]);

  const removeSun = (scene: THREE.Scene) => {
    if (!sunMeshRef.current) return;
    scene.remove(sunMeshRef.current);
    try {
      (sunMeshRef.current.geometry as any).dispose();
      (sunMeshRef.current.material as any).dispose();
    } catch { }
    sunMeshRef.current = null;
  };

  // Optimized Weather Lighting System 
  const setupWeatherLighting = (scene: THREE.Scene, weather: string, gl?: any) => {
    // Initialize lights if first time
    initializeLights(scene);

    // Remove sun by default, add only if sunny
    removeSun(scene);

    // Load and apply skybox from Supabase URLs
    if (skyboxDataRef.current) {
      loadAndApplySkybox(weather as 'sunny' | 'rainy' | 'foggy' | 'night');
    } else {
      // Fallback colors if no skybox data
      const weatherColors: Record<string, number> = {
        sunny: 0x87ceeb, rainy: 0xbfd1e5, foggy: 0xd6dbe0, night: 0x0b1020
      };
      if (rendererRef.current) {
        rendererRef.current.setClearColor(weatherColors[weather] || 0x87ceeb, 1);
      }
    }

    // Setup fog effects
    setupFogEffects(scene, weather as any);

    // Note: Skybox sphere loading happens async in loadAndApplySkybox

    // Configure lighting based on weather
    switch (weather) {
      case 'sunny':
        createSun(scene);
        ambientLightRef.current!.color.setHex(0xfff5e0);
        ambientLightRef.current!.intensity = 1.5; // Enhanced from 1.4
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.color.setHex(0xb0d8ff);
          (hemisphereLightRef.current as any).groundColor?.setHex(0xc8b89a);
          hemisphereLightRef.current.intensity = 1.7; // Enhanced from 1.6
        }
        directionalLightRef.current!.color.setHex(0xfff1c0);
        directionalLightRef.current!.intensity = 4.2; // Enhanced sunlight from 3.8
        directionalLightRef.current!.position.set(8, 12, 8); // Closer, angled position for visible shadows
        directionalLightRef.current!.target.position.set(0, 0, 0); // Target center of model
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.color.setHex(0x88bbff);
        pointLight1Ref.current!.intensity = 2.0; // Enhanced from 1.8
        pointLight1Ref.current!.distance = 600;
        pointLight1Ref.current!.position.set(-80, 40, -60);
        pointLight1Ref.current!.castShadow = true; // Enable shadows for sunny fill light
        removeRain(scene);
        if (rendererRef.current) {
          rendererRef.current.setClearColor(0x87ceeb, 1);
        }
        break;

      case 'rainy':
        ambientLightRef.current!.color.setHex(0xffffff);
        ambientLightRef.current!.intensity = 0.6; // Enhanced from 0.5
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.intensity = 0.6; // Enhanced from 0.5
        }
        directionalLightRef.current!.color.setHex(0xffffff);
        directionalLightRef.current!.intensity = 1.4; // Enhanced from 1.2
        directionalLightRef.current!.position.set(-6, 10, 6); // Better angle for visible shadows
        directionalLightRef.current!.target.position.set(-10, -10, -10); // Target center of model
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.color.setHex(0x9bb3d1);
        pointLight1Ref.current!.intensity = 0.3; // Add subtle fill light
        pointLight1Ref.current!.distance = 400;
        pointLight1Ref.current!.position.set(50, 30, 40);
        pointLight1Ref.current!.castShadow = true; // Enable shadows for rainy fill light
        createRain(scene);
        if (rendererRef.current) {
          rendererRef.current.setClearColor(0xbfd1e5, 1);
        }
        break;

      case 'foggy':
        ambientLightRef.current!.color.setHex(0xffffff);
        ambientLightRef.current!.intensity = 1.0; // Enhanced from 0.9
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.intensity = 0.8; // Enhanced from 0.7
        }
        directionalLightRef.current!.color.setHex(0xffffff);
        directionalLightRef.current!.intensity = 0.9; // Enhanced from 0.8
        directionalLightRef.current!.position.set(5, 8, 5); // Angled position instead of directly overhead
        directionalLightRef.current!.target.position.set(0, 0, 0); // Target center of model
        directionalLightRef.current!.castShadow = true; // Enable shadows for foggy weather
        pointLight1Ref.current!.color.setHex(0xe6eef7);
        pointLight1Ref.current!.intensity = 0.2; // Add subtle diffused light
        pointLight1Ref.current!.distance = 300;
        pointLight1Ref.current!.position.set(20, 25, 30);
        pointLight1Ref.current!.castShadow = true; // Enable shadows for point light
        removeRain(scene);
        if (rendererRef.current) {
          rendererRef.current.setClearColor(0xd6dbe0, 1);
        }
        break;

      case 'night':
        ambientLightRef.current!.color.setHex(0x7788aa);
        ambientLightRef.current!.intensity = 0.8; // Enhanced from 0.6 for more 3D visibility
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.intensity = 0.5; // Enhanced from 0.4
        }
        directionalLightRef.current!.color.setHex(0xbdd1ff);
        directionalLightRef.current!.intensity = 1.4; // Enhanced from 1.2
        directionalLightRef.current!.position.set(-7, 12, 7); // Better moonlight angle for dramatic shadows
        directionalLightRef.current!.target.position.set(0, 0, 0); // Target center of model
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.color.setHex(0x4d6699); // Cool blue moonlight
        pointLight1Ref.current!.intensity = 0.8; // Add realistic moonlight for 3D effect
        pointLight1Ref.current!.distance = 500;
        pointLight1Ref.current!.position.set(-40, 60, -30);
        pointLight1Ref.current!.castShadow = true; // Enable shadows for moonlight
        removeRain(scene);
        if (rendererRef.current) {
          rendererRef.current.setClearColor(0x0b1020, 1);
        }
        break;

      default:
        ambientLightRef.current!.color.setHex(0xffffff);
        ambientLightRef.current!.intensity = 1.0;
        directionalLightRef.current!.color.setHex(0xffffeb);
        directionalLightRef.current!.intensity = 1.2;
        directionalLightRef.current!.position.set(6, 10, 6); // Angled position for visible shadows
        directionalLightRef.current!.target.position.set(0, 0, 0); // Target center of model
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.intensity = 0;
        pointLight1Ref.current!.castShadow = false; // Disable shadows when no intensity
        removeRain(scene);
    }

    // Enhanced shadow configuration for realistic weather effects
    if (rendererRef.current) {
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current.shadowMap.autoUpdate = true;

      // Weather-specific shadow settings
      if (directionalLightRef.current!.castShadow) {
        switch (weather) {
          case 'sunny':
            // Sharp, high-quality shadows for sunny weather
            directionalLightRef.current!.shadow.mapSize.width = 2048;
            directionalLightRef.current!.shadow.mapSize.height = 2048;
            directionalLightRef.current!.shadow.camera.near = 0.5;
            directionalLightRef.current!.shadow.camera.far = 100;
            directionalLightRef.current!.shadow.camera.left = -45; // Match 90x90 ground plane
            directionalLightRef.current!.shadow.camera.right = 45;
            directionalLightRef.current!.shadow.camera.top = 45;
            directionalLightRef.current!.shadow.camera.bottom = -45;
            directionalLightRef.current!.shadow.bias = -0.0002;
            directionalLightRef.current!.shadow.normalBias = 0.02;
            break;

          case 'rainy':
            // Softer shadows for overcast conditions
            directionalLightRef.current!.shadow.mapSize.width = 1536;
            directionalLightRef.current!.shadow.mapSize.height = 1536;
            directionalLightRef.current!.shadow.camera.near = 0.5;
            directionalLightRef.current!.shadow.camera.far = 60;
            directionalLightRef.current!.shadow.camera.left = -45; // Match 90x90 ground plane
            directionalLightRef.current!.shadow.camera.right = 45;
            directionalLightRef.current!.shadow.camera.top = 45;
            directionalLightRef.current!.shadow.camera.bottom = -45;
            directionalLightRef.current!.shadow.bias = -0.0001;
            directionalLightRef.current!.shadow.normalBias = 0.01;
            break;

          case 'foggy':
            // Very soft, diffused shadows
            directionalLightRef.current!.shadow.mapSize.width = 1024;
            directionalLightRef.current!.shadow.mapSize.height = 1024;
            directionalLightRef.current!.shadow.camera.near = 0.5;
            directionalLightRef.current!.shadow.camera.far = 40;
            directionalLightRef.current!.shadow.camera.left = -45; // Match 90x90 ground plane
            directionalLightRef.current!.shadow.camera.right = 45;
            directionalLightRef.current!.shadow.camera.top = 45;
            directionalLightRef.current!.shadow.camera.bottom = -45;
            directionalLightRef.current!.shadow.bias = -0.00005;
            directionalLightRef.current!.shadow.normalBias = 0.005;
            break;

          case 'night':
            // Dramatic shadows for moonlight
            directionalLightRef.current!.shadow.mapSize.width = 1536;
            directionalLightRef.current!.shadow.mapSize.height = 1536;
            directionalLightRef.current!.shadow.camera.near = 0.5;
            directionalLightRef.current!.shadow.camera.far = 80;
            directionalLightRef.current!.shadow.camera.left = -45; // Match 90x90 ground plane
            directionalLightRef.current!.shadow.camera.right = 45;
            directionalLightRef.current!.shadow.camera.top = 45;
            directionalLightRef.current!.shadow.camera.bottom = -45;
            directionalLightRef.current!.shadow.bias = -0.0003;
            directionalLightRef.current!.shadow.normalBias = 0.015;
            break;

          default:
            // Default shadow settings
            directionalLightRef.current!.shadow.mapSize.width = 1024;
            directionalLightRef.current!.shadow.mapSize.height = 1024;
            directionalLightRef.current!.shadow.camera.near = 0.5;
            directionalLightRef.current!.shadow.camera.far = 50;
            directionalLightRef.current!.shadow.bias = -0.0001;
            break;
        }
        
        // Update shadow camera projection matrix after all configuration changes
        directionalLightRef.current!.shadow.camera.updateProjectionMatrix();
      }

      // Configure point light shadows for enhanced lighting
      if (pointLight1Ref.current!.castShadow && pointLight1Ref.current!.intensity > 0) {
        pointLight1Ref.current!.shadow.mapSize.width = 512;
        pointLight1Ref.current!.shadow.mapSize.height = 512;
        pointLight1Ref.current!.shadow.camera.near = 0.5;
        pointLight1Ref.current!.shadow.camera.far = pointLight1Ref.current!.distance || 100;
        pointLight1Ref.current!.shadow.bias = -0.0001;
      }
    }

    // Ensure directional light target is added to scene and properly positioned
    if (directionalLightRef.current && directionalLightRef.current.target) {
      if (!scene.children.includes(directionalLightRef.current.target)) {
        scene.add(directionalLightRef.current.target);
      }
      directionalLightRef.current.target.updateMatrixWorld();
    }
  };

  // Re-apply weather lighting whenever mode changes (keeps viewer responsive)
  useEffect(() => {
    if (sceneRef.current && rendererRef.current && cameraRef.current) {
      // setupWeatherLighting is synchronous – apply weather effects immediately,
      // skybox texture loads in the background and self-renders when ready.
      setupWeatherLighting(sceneRef.current, weatherMode);
      sceneRef.current.updateMatrixWorld(true);
      try {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      } catch (e) {
        console.warn('Manual render failed:', e);
      }
    }
  }, [weatherMode]);

  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const dimsRef = useRef<{ width: number, height: number, depth: number, labelPoints: { name: string, vec: THREE.Vector3, val: number }[] } | null>(null);
  const unitRef = useRef(measurementUnit);

  useEffect(() => {
    unitRef.current = measurementUnit;
  }, [measurementUnit]);

  // Use ref to keep product fresh in animation loop
  const productRef = useRef(product);
  useEffect(() => {
    productRef.current = product;
  }, [product]);

  // Update measurement lines when toggle changes or model loads
  const updateMeasurementLines = () => {
    const scene = sceneRef.current;
    const model = currentModelRef.current;

    if (!scene) return;

    // Remove existing lines safely from wherever they are attached
    if (measurementGroupRef.current) {
      if (measurementGroupRef.current.parent) {
        measurementGroupRef.current.parent.remove(measurementGroupRef.current);
      }
      measurementGroupRef.current.clear();
      measurementGroupRef.current = null;
    }

    if (!showMeasurements || !model) {
      setMeasurementLabels([]);
      return;
    }

    try {
      // Use WORLD SPACE coordinates from the scaled modelGroup
      // This gives us complete control over line size
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      const min = scaledBox.min;
      const max = scaledBox.max;
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);

      // Pre-calculate label 3D positions (World Coordinates)
      const pushFactor = 0.05;
      const zOffset = max.z + (scaledSize.z * pushFactor);
      const widthY = min.y;
      const widthMid = new THREE.Vector3(center.x, widthY, zOffset);

      const xOffset = min.x - (scaledSize.x * pushFactor);
      const heightMid = new THREE.Vector3(xOffset, center.y, max.z);

      const depthMid = new THREE.Vector3(max.x, min.y, center.z);

      // Dimensions for UI display
      const dims = {
        width: scaledSize.x, height: scaledSize.y, depth: scaledSize.z,
        labelPoints: [
          { name: 'Width', vec: widthMid, val: scaledSize.x },
          { name: 'Height', vec: heightMid, val: scaledSize.y },
          { name: 'Thickness', vec: depthMid, val: scaledSize.z }
        ]
      };
      setModelDimensions(dims);
      dimsRef.current = dims;

      const group = new THREE.Group();

      // Helper function to create a thick line (Cylinder)
      const createThickLine = (start: THREE.Vector3, end: THREE.Vector3, color: number) => {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        const thickness = 0.015 * (scaledSize.length() / 3); // Make relative to SCALED model size

        const geometry = new THREE.CylinderGeometry(thickness, thickness, length, 8, 1);
        geometry.translate(0, length / 2, 0);
        geometry.rotateX(Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.copy(start);
        mesh.lookAt(end);
        return mesh;
      };

      const lineColor = 0x3b82f6; // Blue

      // 1. Width Line (Bottom Front) - WORLD COORDINATES
      group.add(createThickLine(
        new THREE.Vector3(min.x, widthY, zOffset),
        new THREE.Vector3(max.x, widthY, zOffset),
        lineColor
      ));

      // Width Ticks
      const tickSize = Math.min(scaledSize.x, scaledSize.y, scaledSize.z) * 0.1;
      group.add(createThickLine(
        new THREE.Vector3(min.x, widthY - tickSize / 2, zOffset),
        new THREE.Vector3(min.x, widthY + tickSize / 2, zOffset),
        lineColor
      ));
      group.add(createThickLine(
        new THREE.Vector3(max.x, widthY - tickSize / 2, zOffset),
        new THREE.Vector3(max.x, widthY + tickSize / 2, zOffset),
        lineColor
      ));

      // 2. Height Line (Left Side) - WORLD COORDINATES
      group.add(createThickLine(
        new THREE.Vector3(xOffset, min.y, max.z),
        new THREE.Vector3(xOffset, max.y, max.z),
        lineColor
      ));

      // Height Ticks
      group.add(createThickLine(
        new THREE.Vector3(xOffset - tickSize / 2, min.y, max.z),
        new THREE.Vector3(xOffset + tickSize / 2, min.y, max.z),
        lineColor
      ));
      group.add(createThickLine(
        new THREE.Vector3(xOffset - tickSize / 2, max.y, max.z),
        new THREE.Vector3(xOffset + tickSize / 2, max.y, max.z),
        lineColor
      ));

      // 3. Depth Line (Right Side) - WORLD COORDINATES
      group.add(createThickLine(
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        lineColor
      ));

      // Depth Ticks (Start/End)
      group.add(createThickLine(
        new THREE.Vector3(max.x, min.y, min.z - tickSize / 2),
        new THREE.Vector3(max.x, min.y, min.z + tickSize / 2),
        lineColor
      ));
      group.add(createThickLine(
        new THREE.Vector3(max.x, min.y, max.z - tickSize / 2),
        new THREE.Vector3(max.x, min.y, max.z + tickSize / 2),
        lineColor
      ));


      measurementGroupRef.current = group;

      // ATTACH TO SCENE (not model) since we're using world coordinates
      scene.add(group);

      // Render update
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    } catch (e) {
      console.warn('Error creating measurements:', e);
    }
  };

  useEffect(() => {
    updateMeasurementLines();
  }, [showMeasurements, measurementUnit]);

  // Optimized animation loop
  const startAnimationLoop = (
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    object: THREE.Object3D,
    gl: any,
    viewWidth: number,
    viewHeight: number
  ) => {
    let animationId: number;
    let frameCount = 0;
    let lastRainUpdate = 0;
    
    const animate = () => {
      if (!viewerVisible) {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        return;
      }
      
      frameCount++;
      const now = Date.now();

      // Apply rotations to the GROUP (which is centered at 0,0,0)
      object.rotation.set(0, 0, 0);

      // Update Camera Position for Orbit
      const dist = cameraDistanceRef.current;
      const phi = rotationRef.current.x; // Elevation (0=Top, PI=Bottom)
      const theta = rotationRef.current.y; // Azimuth

      // Spherical to Cartesian (Y-up)
      const x = dist * Math.sin(phi) * Math.sin(theta);
      const y = dist * Math.cos(phi);
      const z = dist * Math.sin(phi) * Math.cos(theta);

      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0); // Look at Center of Model Group



      // Optimized rain animation - update less frequently for performance
      if (rainRef.current && rainVelocities.current && (now - lastRainUpdate > 16)) { // ~60fps for rain
        lastRainUpdate = now;
        const geom = rainRef.current.geometry as THREE.BufferGeometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        const positions = attr.array as Float32Array;
        const velocities = rainVelocities.current;

        for (let i = 0; i < velocities.length; i++) {
          positions[i * 6 + 1] -= velocities[i];
          positions[i * 6 + 4] -= velocities[i];
          if (positions[i * 6 + 1] < -250) {
            const x = (Math.random() - 0.5) * 900;
            const z = (Math.random() - 0.5) * 900;
            const streakLength = 6.0 + Math.random() * 6.0;
            positions[i * 6 + 0] = x;
            positions[i * 6 + 1] = 800;
            positions[i * 6 + 2] = z;
            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = 800 - streakLength;
            positions[i * 6 + 5] = z;
            velocities[i] = 1.2 + Math.random() * 10;
          }
        }
        attr.needsUpdate = true;
      }

      // Label Calculation (Every 10 frames instead of 5 to save performance)
      if (measurementGroupRef.current && frameCount % 10 === 0) {
        updateLabels(object, camera, viewWidth, viewHeight);
      }

      // Keep skybox centered on camera so it always surrounds the viewer (true 3D parallax)
      if (skyboxRef.current) {
        skyboxRef.current.position.copy(camera.position);
      }

      try {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      } catch (error) {
        console.warn('Render error:', error);
      }
      frameCount++;
      animationId = requestAnimationFrame(animate);
    };

    animate();
  };

  // Helper to update labels
  const updateLabels = (object: THREE.Object3D, camera: THREE.Camera, vModW: number, vModH: number) => {
    if (!dimsRef.current) return;
    const { labelPoints } = dimsRef.current;
    const unit = unitRef.current;

    // Ensure matrix is up to date with latest rotation applied in loop
    object.updateMatrixWorld(true);

    const newLabels: any[] = [];

    labelPoints.forEach(p => {
      // Label positions are already in WORLD SPACE (since we use scaledBox)
      // Just project directly to screen coordinates
      const v = p.vec.clone().project(camera);

      // Check if in front of camera
      if (v.z > 1 || v.z < -1) return;

      // Convert NDC to Screen Coords
      const x = (v.x * 0.5 + 0.5) * vModW;
      const y = (-(v.y * 0.5) + 0.5) * vModH;

      // Format value with OVERRIDE from product props if available
      // This ensures we show the "Spec" dimensions, not the "Bounding Box" (which might include open doors)
      let val = p.val;

      // Override logic
      // Use productRef for latest values
      const currentProduct = productRef.current;
      // Use productRef for latest values
      if (p.name === 'Width' && currentProduct?.width) val = parseFloat(currentProduct.width) / 1000;
      if (p.name === 'Height' && currentProduct?.height) val = parseFloat(currentProduct.height) / 1000;
      if (p.name === 'Thickness' && currentProduct?.thickness) val = parseFloat(currentProduct.thickness) / 1000;

      // Convert to display unit
      let unitStr = unit;
      if (unit === 'mm') {
        val = val * 1000;
        // If we used product prop which is already mm, this cancels out (x/1000 * 1000)
        // If we used bounding box (meters), it converts to mm.
      } else if (unit === 'cm') {
        val = val * 100;
      }

      newLabels.push({
        text: `${val.toFixed(0)} ${unitStr}`,
        x,
        y
      });
    });

    setMeasurementLabels(newLabels);
  };

  // PanResponder for 3D controls - using useMemo to ensure updates during dev
  const panResponder = React.useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 1) {
          // Use REF to get latest state, fixing "reset on tap" bug
          lastRotation.current = { ...rotationRef.current };
        }
        if (evt.nativeEvent.touches.length === 2) {
          const [a, b] = evt.nativeEvent.touches;
          setLastDistance(Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 1) {
          // Map gestures to Orbit Angles
          // dy -> phi (elevation/pitch)
          // dx -> theta (azimuth/yaw)
          // Map gestures to Orbit Angles (Spherical)
          // Inverted controls for natural drag:
          // Drag down (dy > 0) -> Move Scene DOWN -> Camera UP (phi decreases)
          // Drag left (dx < 0) -> Move Scene LEFT -> Camera RIGHT (theta increases)
          // So: Subtract delta.

          const newPhi = lastRotation.current.x - gestureState.dy * 0.005;
          const newTheta = lastRotation.current.y - gestureState.dx * 0.005;

          // Clamp Phi to avoid flipping over poles (0.1 to PI-0.1)
          const clampedPhi = Math.max(0.1, Math.min(Math.PI - 0.1, newPhi));

          setRotation({
            x: clampedPhi,
            y: newTheta,
          });
        }
        if (evt.nativeEvent.touches.length === 2) {
          const [a, b] = evt.nativeEvent.touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          if (lastDistance) {
            let delta = (dist - lastDistance) * 0.02;
            setCameraDistance((prev) => Math.max(20, Math.min(1000, prev - delta * 5)));
          }
          setLastDistance(dist);
        }
      },
      onPanResponderRelease: () => {
        setLastDistance(null);
      },
      onPanResponderTerminationRequest: () => false,
    })
    , []);

  // Optimized 3D Viewer (mobile friendly) with quick weather buttons overlay
  const render3DViewer = () => {
    // prefer normalized array first
    const modelKey = product?.glb_urls?.[selectedModelIndex] ?? product?.glb_urls?.[0] ?? null;
    // show placeholder if no model key
    if (!modelKey) {
      return (
        <View style={styles.viewerModalContent}>
          <Text style={{ color: '#666' }}>No 3D model available for this product.</Text>
        </View>
      );
    }

    const viewerWidth = Math.min(width * 0.92, 480);
    const viewerHeight = Math.min(SCREEN_HEIGHT * 0.55, 420);

    return (
      <View
        style={styles.viewerModalContent}
        {...panResponder.panHandlers}
      >
        {/* GL layer – renders 3D model and the immersive environment sphere */}
        <View style={{ width: viewerWidth, height: viewerHeight, overflow: 'hidden', backgroundColor: 'transparent' }}>


          {/* GL layer – transparent background, renders 3D model on top of the image */}
          <GLView
            key={`viewer-${selectedModelIndex}-v975`}
            style={StyleSheet.absoluteFill}
            onContextCreate={async (gl: any) => {
              setModelLoading(true);
              setModelError(false);
              setLoadingProgress(0);

              try {
                if (!gl) throw new Error('WebGL context not available');

                // Store gl context for WebGL operations and texture management
                glRef.current = gl;

                // Define modelKey for caching
                const modelUrls = Array.isArray(product?.glb_urls) ? product.glb_urls : [];
                const targetUrl = modelUrls.length > 0 ? modelUrls[selectedModelIndex] || 'fallback' : 'fallback';

                // init scene/camera/renderer if missing
                if (!sceneRef.current) {
                  sceneRef.current = new THREE.Scene();
                  sceneRef.current.background = null; // Transparent — RN Image is the background
                }
                if (!cameraRef.current) {
                  cameraRef.current = new THREE.PerspectiveCamera(60, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 10000);
                  // Initial position - will be updated after model loads
                  cameraRef.current.position.set(0, 0, cameraDistanceRef.current);
                  cameraRef.current.lookAt(0, 0, 0);
                }
                // Polyfill a canvas to prevent THREE from touching `document`
                const expogl: any = gl;
                if (!expogl.canvas) {
                  expogl.canvas = {
                    width: gl.drawingBufferWidth,
                    height: gl.drawingBufferHeight,
                    style: {},
                    addEventListener: () => { },
                    removeEventListener: () => { },
                    clientWidth: gl.drawingBufferWidth,
                    clientHeight: gl.drawingBufferHeight,
                  } as any;
                } else {
                  expogl.canvas.width = gl.drawingBufferWidth;
                  expogl.canvas.height = gl.drawingBufferHeight;
                }

                // Always create a new renderer for a new GL context
                if (rendererRef.current) {
                  try {
                    rendererRef.current.dispose();
                  } catch (e) { }
                }

                rendererRef.current = new THREE.WebGLRenderer({
                  context: gl as any,
                  canvas: expogl.canvas,
                  antialias: true,
                  alpha: true,           // Transparent so the RN Image background shows through
                  premultipliedAlpha: false,
                  stencil: false,
                  preserveDrawingBuffer: false,
                  powerPreference: "high-performance",
                });
                rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
                rendererRef.current.shadowMap.enabled = true;
                rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
                rendererRef.current.outputColorSpace = THREE.SRGBColorSpace;
                rendererRef.current.toneMapping = THREE.ACESFilmicToneMapping;
                rendererRef.current.toneMappingExposure = 1.2;
                try {
                  // Deprecated in newer Three.js but harmless
                  (rendererRef.current as any).physicallyCorrectLights = true;
                } catch { }
                // Transparent clear — the RN Image layer behind GLView is the real background
                rendererRef.current.setClearColor(0x000000, 0);

                const scene = sceneRef.current!;
                const camera = cameraRef.current!;
                const renderer = rendererRef.current!;

                // Clear previous children before adding model
                scene.clear();
                
                // Reset skybox reference since scene was cleared
                skyboxRef.current = null;

                // Apply current weather lighting synchronously – solid color shows immediately,
                // skybox texture loads in the background and self-renders when ready.
                setupWeatherLighting(scene, weatherMode, gl);
                if (rendererRef.current && cameraRef.current && sceneRef.current) {
                  rendererRef.current.render(sceneRef.current, cameraRef.current);
                }
                let finalModel: THREE.Object3D;
                const lowerUrl = targetUrl.toLowerCase();

                if (targetUrl !== 'fallback') {
                  try {
                    if (targetUrl) {
                      finalModel = await loadGLBModel(targetUrl, product.id);
                    } else {
                      throw new Error("Empty URL");
                    }
                  } catch (err) {
                    console.warn('Model load failed, using fallback:', err);
                    finalModel = createFallbackModel();
                  }
                } else {
                  finalModel = createFallbackModel();
                }

                // Website approach: Use a Group to hold the model
                finalModel.updateMatrixWorld(true); // Ensure transforms are applied
                const rawBox = new THREE.Box3().setFromObject(finalModel);
                const rawCenter = rawBox.getCenter(new THREE.Vector3());
                const rawSize = rawBox.getSize(new THREE.Vector3());

                // Create a group to hold the model
                const modelGroup = new THREE.Group();

                // Position model INSIDE the group (Centered exactly)
                // Orbit controls look at (0,0,0), so center model at (0,0,0)
                finalModel.position.set(-rawCenter.x, -rawCenter.y, -rawCenter.z);
                modelGroup.add(finalModel);

                // Scale the GROUP (not the model directly)
                const maxDimension = Math.max(rawSize.x, rawSize.y, rawSize.z);
                if (maxDimension > 0) {
                  const targetSize = 100;
                  const scale = targetSize / maxDimension;
                  modelGroup.scale.setScalar(scale);
                  console.log(`Scaled group by ${scale.toFixed(3)}`);
                }

                modelGroup.position.set(0, 0, 0);
                /* OLD LOGIC COMMENTED OUT
                  console.log(`Auto-scaling model by ${scaleFactor} (Raw size: ${maxDim})`);
                */


                processGLBMaterials(finalModel);
                modelCache.current.set(targetUrl, finalModel.clone ? finalModel.clone() : finalModel);

                // Add GROUP to scene (not the model directly)
                scene.add(modelGroup);
                // CRITICAL: Store the GROUP (not raw model) so measurements scale correctly
                currentModelRef.current = modelGroup;

                // Calculate camera position based on SCALED bounds
                const scaledBounds = new THREE.Box3().setFromObject(modelGroup);
                const boundsCenter = scaledBounds.getCenter(new THREE.Vector3());
                const boundsSize = scaledBounds.getSize(new THREE.Vector3());
                const maxScaledDim = Math.max(boundsSize.x, boundsSize.y, boundsSize.z);

                // Auto-position ground plane at the bottom of this specific model
                if (groundPlaneRef.current) {
                  const modelBottomY = scaledBounds.min.y;
                  const groundOffset = 0.5; // Small offset below model feet
                  groundPlaneRef.current.position.y = modelBottomY - groundOffset;
                }

                // Website camera formula (adjusted for closer view)
                const distance = maxScaledDim * 1.5;

                // Set initial zoom state
                setCameraDistance(distance);
                cameraDistanceRef.current = distance;
                defaultDistanceRef.current = distance;

                // Initial position (will be updated by loop immediately)
                cameraRef.current.position.set(0, 0, distance);
                cameraRef.current.lookAt(0, 0, 0);

                updateMeasurementLines();
                setLoadingProgress(100);
                setModelLoading(false);

                // Pass modelGroup to rotate the whole centered group
                startAnimationLoop(scene, camera, renderer, modelGroup, gl, viewerWidth, viewerHeight);
              } catch (error) {
                console.error('3D viewer init error', error);
                setModelLoading(false);
                setModelError(true);
              }
            }}
          />

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => setCameraDistance(d => Math.max(20, d * 0.8))}>
              <Ionicons name="add" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomButton} onPress={() => setCameraDistance(d => Math.min(10000, d * 1.25))}>
              <Ionicons name="remove" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {/* model selector (if multiple) */}
          {
            Array.isArray(product?.glb_urls) && product.glb_urls.length > 1 && (
              <View style={styles.modelSelectorRow}>
                <TouchableOpacity
                  style={styles.modelArrow}
                  onPress={() => setSelectedModelIndex((i) => (i - 1 + product.glb_urls.length) % product.glb_urls.length)}
                >
                  <Ionicons name="chevron-back" size={20} color="#a81d1d" />
                </TouchableOpacity>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
                  {product.glb_urls.map((_: string, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.modelChip, selectedModelIndex === idx && styles.modelChipActive]}
                      onPress={() => setSelectedModelIndex(idx)}
                    >
                      <Text style={[styles.modelChipText, selectedModelIndex === idx && styles.modelChipTextActive]}>
                        Model {idx + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.modelArrow}
                  onPress={() => setSelectedModelIndex((i) => (i + 1) % product.glb_urls.length)}
                >
                  <Ionicons name="chevron-forward" size={20} color="#a81d1d" />
                </TouchableOpacity>
              </View>
            )
          }

          {/* Weather buttons - icon only */}
          <View style={styles.weatherOverlay}>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'sunny' && styles.weatherIconActive]}
              onPress={() => setWeatherMode('sunny')}
            >
              <Ionicons name="sunny" size={22} color={weatherMode === 'sunny' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'rainy' && styles.weatherIconActive]}
              onPress={() => setWeatherMode('rainy')}
            >
              <Ionicons name="rainy" size={22} color={weatherMode === 'rainy' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'foggy' && styles.weatherIconActive]}
              onPress={() => setWeatherMode('foggy')}
            >
              <Ionicons name="cloudy" size={22} color={weatherMode === 'foggy' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'night' && styles.weatherIconActive]}
              onPress={() => setWeatherMode('night')}
            >
              <Ionicons name="moon" size={22} color={weatherMode === 'night' ? '#fff' : '#333'} />
            </TouchableOpacity>
          </View>

          {/* Color Picker Button */}
          {
            productColors.length > 0 && (
              <TouchableOpacity
                style={styles.colorPickerButton}
                onPress={() => setColorPickerModalVisible(true)}
              >
                <Ionicons name="color-palette" size={20} color="#fff" />
                <Text style={styles.colorPickerButtonText}>Frame Colors</Text>
              </TouchableOpacity>
            )
          }

          {/* Measurements toggle - simplified */}
          <View style={styles.measurementsToggle}>
            <Text style={styles.measurementsLabel}>Measurements</Text>
            <Switch
              value={showMeasurements}
              onValueChange={setShowMeasurements}
              trackColor={{ false: '#767577', true: '#a81d1d' }}
              thumbColor={showMeasurements ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Measurement Labels - only show when toggled on */}
          {
            showMeasurements && measurementLabels.map((lbl, i) => (
              <View key={i} style={[styles.measurementLabel, { left: lbl.x, top: lbl.y }]}>
                <Text style={styles.measurementText}>{lbl.text}</Text>
              </View>
            ))
          }

          {/* Color Picker Modal Overlay — rendered LAST so it sits above everything */}
          {
            colorPickerModalVisible && (
              <View style={styles.colorPickerModalOverlay}>
                {/* Dim backdrop — tap to close */}
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={() => setColorPickerModalVisible(false)}
                />
                <View style={styles.colorPickerContent}>
                  {/* Drag handle visual cue */}
                  <View style={styles.colorPickerHandle} />
                  <View style={styles.colorPickerHeader}>
                    <Text style={styles.colorPickerTitle}>Select Frame Color</Text>
                    <TouchableOpacity
                      onPress={() => setColorPickerModalVisible(false)}
                      style={styles.colorPickerCloseBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="close-circle" size={28} color="#a81d1d" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    bounces
                    contentContainerStyle={{ paddingHorizontal: 8, gap: 14, paddingBottom: 4, alignItems: 'flex-start' }}
                  >
                    {/* Default / original option */}
                    <TouchableOpacity
                      style={[styles.colorOption, activeColor === '#ORIGINAL' && styles.colorOptionActive]}
                      onPress={() => {
                        setActiveColor('#ORIGINAL');
                        setColorPickerModalVisible(false);
                      }}
                    >
                      <View style={[styles.colorCircle, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="ban-outline" size={22} color="#666" />
                      </View>
                      <Text style={styles.colorName}>Default</Text>
                    </TouchableOpacity>

                    {productColors.map((color, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.colorOption, activeColor === color && styles.colorOptionActive]}
                        onPress={() => {
                          setActiveColor(color);
                          setColorPickerModalVisible(false);
                        }}
                      >
                        <View style={[styles.colorCircle, {
                          backgroundColor: color,
                          borderWidth: activeColor === color ? 3 : 1,
                          borderColor: activeColor === color ? '#a81d1d' : 'rgba(0,0,0,0.15)',
                        }]} />
                        <Text style={styles.colorName}>{color}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )
          }

          {/* loading / error overlays */}
          {
            modelLoading && (
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }]}>
                <ActivityIndicator size="large" color="#a81d1d" />
                <Text style={{ marginTop: 8, color: '#444' }}>Loading 3D model...</Text>
                {loadingProgress > 0 && <Text style={{ color: '#a81d1d', marginTop: 6 }}>{Math.round(loadingProgress)}%</Text>}
              </View>
            )
          }
          {
            modelError && (
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }]}>
                <Ionicons name="warning-outline" size={36} color="#ff6b6b" />
                <Text style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>Unable to load model.</Text>
              </View>
            )
          }
        </View>{/* end background+GL wrapper */}
      </View >
    );
  };



  if (loading) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: '#fff' }]}>
        <ActivityIndicator size="large" color="#a81d1d" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: '#fff' }]}>
        <Text>Product not found.</Text>
      </View>
    );
  }

  // reservation fee (used for button label/navigation)
  const RESERVATION_FEE = 500;

  // Reserve now navigation - opens payment screen and passes product id
  const onReserveNow = () => {
    if (!product) {
      Alert.alert('No product', 'Product data not loaded yet.');
      return;
    }
    // If you prefer query string:
    // router.push(`/payment?id=${product.id}`);
    // Using relative navigation - adjust if your routing structure differs
    try {
      router.push({
        pathname: '../payment',
        params: { id: product.id }
      } as any);
    } catch (e) {
      // fallback to query string if route object signature differs
      router.push(`/payment?id=${product.id}`);
    }
  };

  // Add to cart -> insert or upsert into 'cart' table to sync with web
  const addToCart = async (qty = 1) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert(
          'Login Required',
          'Please login or create an account to add items to your cart.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Login', onPress: () => router.push('/login') },
            { text: 'Sign Up', onPress: () => router.push('/register') }
          ]
        );
        return;
      }

      // Check if item already exists in cart (same as web version)
      const { data: existing, error: selErr } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', product?.id)
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        // Update quantity if item already in cart
        const newQty = (existing.quantity ?? 1) + qty;
        const { error: updErr } = await supabase
          .from('cart')
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        // Insert new cart item using the same structure as web
        const payload = {
          user_id: userId,
          product_id: product?.id,
          quantity: qty,
          meta: {}, // Metadata field for customizations
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        const { error: insErr } = await supabase.from('cart').insert([payload]);
        if (insErr) throw insErr;
      }

      Alert.alert('Added', `${product?.name} has been added to your cart.`);
    } catch (e: any) {
      console.error('Add to cart failed', e);
      const msg = e?.message ?? JSON.stringify(e);
      Alert.alert('Error', `Failed to add to cart.\n${msg}`);
    }
  };

  // Count 3D models (adapted to normalized product)
  const modelsCount = (() => {
    if (!product) return 0;
    if (Array.isArray(product.glb_urls)) return product.glb_urls.length;
    if (product.glb_urls && typeof product.glb_urls === 'string') {
      return product.glb_urls.split(',').filter(Boolean).length;
    }
    return 0;
  })();

  const availableStock = Math.max(0, (product?.stock ?? 0) - (product?.reserved_stock ?? 0));

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#a81d1d" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Product Details</Text>
        <View style={{ width: 28 }} /> {/* Spacer for symmetry */}
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', paddingBottom: 120 }}>
        <View style={styles.productBox}>
          {/* Image Gallery */}
          <View style={{ width: '100%', marginBottom: 16 }}>
            <RNImage
              source={
                product?.images?.length > 0
                  ? { uri: product.images[selectedImageIndex] }
                  : require('@/assets/images/placeholder.png')
              }
              style={styles.productImage}
              resizeMode="cover"
            />

            {/* Image thumbnails - only show if multiple images */}
            {product?.images?.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12 }}
                contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}
              >
                {product.images.map((img: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setSelectedImageIndex(idx)}
                    style={[
                      styles.thumbnailContainer,
                      selectedImageIndex === idx && styles.thumbnailActive
                    ]}
                  >
                    <RNImage
                      source={{ uri: img }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* 3D Viewer Button + Stock and Models info */}
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            {/* 3D Viewer Button - Left */}
            <TouchableOpacity
              style={styles.open3DButton}
              onPress={() => setViewerVisible(true)}
            >
              <Ionicons name="cube-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '700' }}>
                3D View{modelsCount > 0 ? ` (${modelsCount})` : ''}
              </Text>
            </TouchableOpacity>

            {/* Stock and Models badges - Right, stacked */}
            <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {/* Stock badge */}
              <View style={styles.stockBadgeRow}>
                <Text style={styles.stockTextSmall}>{availableStock} in stock</Text>
              </View>

              {/* Models available badge */}
              {modelsCount > 0 && (
                <View style={styles.modelsBadge}>
                  <Text style={styles.modelsBadgeText}>
                    {modelsCount} 3D Model{modelsCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.productName}>{product?.name || 'Product Name'}</Text>
          <Text style={[styles.productSku, { display: 'none' }]}>{product?.sku ?? product?.id ?? 'N/A'}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₱{product?.price ?? 0}</Text>
          </View>

          {/* Buttons row: Add to wishlist / Reserve Now */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => addToCart(1)}>
              <Ionicons name="cart-outline" size={18} color="#222" />
              <Text style={styles.secondaryBtnText}>Add to Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={onReserveNow}>
              <Text style={styles.primaryBtnText}>Reserve Now (₱{RESERVATION_FEE})</Text>
            </TouchableOpacity>
          </View>

          {/* Description, notes and additional fields */}
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product?.description ?? product?.short_description ?? 'No description provided.'}</Text>

          {/* Replace plain text additional_features with bullet list */}
          {(features.length > 0 || product?.additional_features_text) && (
            <>
              <Text style={styles.sectionTitle}>Additional Features</Text>
              <View style={styles.featuresList}>
                {features.length > 0 ? features.map((feat, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Text style={styles.bullet}>{'\u2022'}</Text>
                    <Text style={styles.featureText}>{String(feat)}</Text>
                  </View>
                )) : (
                  // fallback: show raw text block if array not available
                  <Text style={styles.description}>{String(product?.additional_features_text || '')}</Text>
                )}
              </View>
            </>
          )}

          {product?.notes && (
            <>
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.description}>{String(product.notes)}</Text>
            </>
          )}

          <View style={styles.specsCard}>
            <Text style={styles.specsTitle}>Product Specifications</Text>
            <View style={styles.specsGrid}>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Category:</Text>
                <Text style={styles.specValue}>{product?.category || '-'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Material:</Text>
                <Text style={styles.specValue}>{product?.material || '-'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Width:</Text>
                <Text style={styles.specValue}>{product?.width ? `${product.width} cm` : '-'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Height:</Text>
                <Text style={styles.specValue}>{product?.height ? `${product.height} cm` : '-'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Thickness:</Text>
                <Text style={styles.specValue}>{product?.thickness ? `${product.thickness} cm` : '-'}</Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Type:</Text>
                <Text style={styles.specValue}>{product?.type || '-'}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 3D Viewer Modal */}
      <Modal
        visible={viewerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.viewerModalBox, { maxHeight: SCREEN_HEIGHT * 0.88 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                3D Model Viewer{Array.isArray(product?.glb_urls) && product.glb_urls.length > 0 ? ` (${(selectedModelIndex + 1)}/${product.glb_urls.length})` : ''}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {render3DViewer()}

            <View style={styles.viewerActionsRow}>
              <TouchableOpacity style={styles.viewerActionButton} onPress={resetViewerTransform}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.viewerActionText}>Reset View</Text>
              </TouchableOpacity>
              {modelsCount > 1 && (
                <TouchableOpacity
                  style={styles.viewerActionButton}
                  onPress={() => setSelectedModelIndex((i) => (i + 1) % modelsCount)}
                >
                  <Ionicons name="swap-horizontal" size={18} color="#fff" />
                  <Text style={styles.viewerActionText}>Next Model</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modern Bottom Navbar */}
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'space-between',
  },
  topBarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#a81d1d',
    textAlign: 'center',
    flex: 1,
  },
  productBox: {
    width: width * 0.9,
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  productImage: {
    width: '100%',
    height: Math.min(280, width * 0.75),
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    marginHorizontal: 4,
  },
  thumbnailActive: {
    borderColor: '#a81d1d',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  open3DButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#a81d1d',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
    alignSelf: 'center',
  },
  productName: {
    fontWeight: 'bold',
    fontSize: 22,
    marginBottom: 8,
    color: '#222',
    textAlign: 'center',
  },
  productSku: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  price: {
    fontSize: 18,
    color: '#a81d1d',
    fontWeight: 'bold',
  },
  stockBadge: {
    backgroundColor: '#e8f9ef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    color: '#0b9f34',
    fontWeight: '700',
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#a81d1d',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryBtnText: { marginLeft: 8, color: '#222', fontWeight: '700' },

  stockBadgeRow: {
    backgroundColor: '#e8f9ef',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  stockTextSmall: { color: '#0b9f34', fontWeight: '700', fontSize: 13 },

  modelsBadge: {
    backgroundColor: '#eef6ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  modelsBadgeText: { color: '#2b6cb0', fontWeight: '700', fontSize: 13 },

  productDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  productPrice: {
    fontSize: 18,
    color: '#a81d1d',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  productDetail: {
    fontSize: 14,
    color: '#444',
    marginBottom: 4,
    textAlign: 'center',
  },
  modelPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  colorOverlay: {
    position: 'absolute',
    bottom: 20, // At the bottom of the 3D view
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    maxHeight: 60,
    zIndex: 150,
  },
  colorChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorChipActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    transform: [{ scale: 1.1 }],
  },
  viewerModalBox: {
    width: '100%',
    backgroundColor: '#222',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
  },
  viewerModalContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#ffffff',
  },
  modalHandle: {
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginBottom: 12,
  },
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#4f5f8aff',
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    width: 45,
    height: 45,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  fabWrapper: {
    position: 'relative',
    top: -28,
    alignItems: 'center',
    flex: 1,
  },
  fabButton: {
    width: 65,
    height: 65,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#4c58c0ff',
  },
  fabIcon: {
    width: 32,
    height: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginBottom: 8,
  },
  weatherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  weatherButtonActive: {
    backgroundColor: '#a81d1d',
  },
  weatherText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  weatherTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    textAlign: 'left',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  featuresList: {
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    width: 18,
    color: '#666',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
    color: '#444',
    fontSize: 14,
    lineHeight: 20,
  },
  specsCard: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  specsTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
    marginBottom: 12,
  },
  specsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  specRow: {
    width: '48%',
    marginBottom: 12,
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  specValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
  },
  weatherOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  weatherIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weatherIconActive: {
    backgroundColor: '#a81d1d',
  },
  // Color picker button
  colorPickerButton: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#a81d1d',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  colorPickerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Measurements toggle
  measurementsToggle: {
    position: 'absolute',
    bottom: 20,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  measurementsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  colorPickerModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    // Must be ABOVE zoom buttons (zIndex: 999) and everything else
    zIndex: 9999,
    elevation: 9999,
  },
  colorPickerContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 28,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10000,
    // Ensure content is never clipped
    minHeight: 140,
  },
  colorPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 12,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  colorPickerCloseBtn: {
    padding: 4,
  },
  colorOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  colorOptionActive: {
    transform: [{ scale: 1.12 }],
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  colorName: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    maxWidth: 52,
  },
  // Model selector controls
  modelSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modelArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f7f7',
    marginHorizontal: 4,
  },
  modelChip: {
    backgroundColor: '#f2f2f2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  modelChipActive: {
    backgroundColor: '#a81d1d',
    borderColor: '#a81d1d',
  },
  modelChipText: {
    color: '#333',
    fontWeight: '600',
  },
  modelChipTextActive: {
    color: '#fff',
  },
  viewerActionsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  viewerActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  viewerActionText: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: '600',
  },
  measurementPanel: {
    position: 'absolute',
    top: 50,
    left: 12,
    backgroundColor: 'rgba(30,35,48,0.95)',
    borderRadius: 12,
    padding: 12,
    width: 180,
    zIndex: 200,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  measurementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  measurementTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  measurementLabelText: {
    color: '#aaa',
    fontSize: 12
  },
  measurementValueText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13
  },
  unitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)'
  },
  unitButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  unitButtonActive: {
    backgroundColor: '#555'
  },
  unitText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600'
  },
  measurementNote: {
    color: '#666',
    fontSize: 10,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 12
  },
  measurementLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(30,35,48,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3b82f6',
    zIndex: 190,
    // We handle positioning via left/top style props
    transform: [{ translateX: -20 }, { translateY: -10 }]
  },
  measurementText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  zoomControls: {
    position: 'absolute',
    right: 12,
    bottom: 80, // Above "Reset View" button
    gap: 8,
    zIndex: 999, // Ensure it's on top
    elevation: 999, // Android elevation
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  }
});