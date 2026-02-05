import '../../utils/polyfills';
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

// Import background JPG images
const BackgroundAssets = {
  sunny: require('../../assets/backgrounds/sunnyv2.jpg'),
  rainy: require('../../assets/backgrounds/rainyv2.jpg'),
  foggy: require('../../assets/backgrounds/foggyv2.png'),
  night: require('../../assets/backgrounds/nightv2.png'),
};

// Simple test function to verify images load
const testImageLoad = (weatherType: string) => {
  const asset = BackgroundAssets[weatherType as keyof typeof BackgroundAssets];
  console.log(`Testing ${weatherType} image:`, asset);
  return asset;
};

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

  // 3D model cache and references
  const modelCache = useRef<Map<string, THREE.Object3D>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Environment and effects
  const envMapRef = useRef<THREE.Texture | null>(null);
  const envMapCache = useRef<Map<string, THREE.Texture>>(new Map());
  const fogRef = useRef<THREE.Fog | null>(null);

  // Rain particle reference - using LineSegments for realistic streaks
  const rainRef = useRef<THREE.LineSegments | null>(null);
  const rainVelocities = useRef<Float32Array | null>(null);

  // Persistent lights for instant weather switching (reused, not recreated)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const pointLight1Ref = useRef<THREE.PointLight | null>(null);

  // Skybox and Sun refs
  const skyboxRef = useRef<THREE.Mesh | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);

  // Create realistic rain streaks
  const createRain = (scene: THREE.Scene) => {
    if (rainRef.current) return;
    const count = 1500; // Increased rain streaks for better visibility
    const positions = new Float32Array(count * 6); // 2 points per line = 6 values
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {

      const x = (Math.random() - 0.5) * 8;
      const y = Math.random() * 8;
      const z = (Math.random() - 0.5) * 8;

      // Each raindrop is a vertical line segment (streak)
      const streakLength = 0.15 + Math.random() * 0.1; // Varying lengths
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y - streakLength;
      positions[i * 6 + 5] = z;

      // Random falling speeds
      velocities[i] = 0.08 + Math.random() * 0.06;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Create semi-transparent white/blue rain streaks
    const mat = new THREE.LineBasicMaterial({
      color: 0xadd8e6, // Light blue
      transparent: true,
      opacity: 0.8,
      linewidth: 1
    });

    const lines = new THREE.LineSegments(geom, mat);
    lines.frustumCulled = false;
    rainRef.current = lines;
    rainVelocities.current = velocities;
    scene.add(lines);
  };
  const removeRain = (scene: THREE.Scene) => {
    if (!rainRef.current) return;
    scene.remove(rainRef.current);
    try {
      (rainRef.current.geometry as any).dispose();
      (rainRef.current.material as any).dispose();
    } catch { }
    rainRef.current = null;
    rainVelocities.current = null;
  };

  // Simple JPG Background Loading System (React Native compatible)
  const loadBackgroundTexture = async (weatherType: 'sunny' | 'rainy' | 'foggy' | 'night'): Promise<THREE.Texture | null> => {
    // Check cache first
    if (envMapCache.current.has(weatherType)) {
      console.log(`Using cached background texture for ${weatherType}`);
      return envMapCache.current.get(weatherType)!;
    }

    try {
      const backgroundAsset = BackgroundAssets[weatherType];
      if (!backgroundAsset) {
        console.warn(`No background asset found for weather: ${weatherType}`);
        return null;
      }

      // Test that the asset loaded
      const assetTest = testImageLoad(weatherType);
      console.log(`Loading background texture for ${weatherType}:`, assetTest);

      // Use TextureLoader which works with React Native require() assets
      const loader = new THREE.TextureLoader();
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          backgroundAsset,
          (loadedTexture) => {
            console.log(`✅ Background texture loaded successfully for ${weatherType}`);
            // Configure as simple background texture (not environment map)
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.minFilter = THREE.LinearFilter;
            loadedTexture.magFilter = THREE.LinearFilter;
            loadedTexture.needsUpdate = true;
            resolve(loadedTexture);
          },
          (progress) => {
            console.log(`Loading ${weatherType} background:`, Math.round((progress.loaded / (progress.total || 1)) * 100) + '%');
          },
          (error) => {
            console.error(`❌ Failed to load background for ${weatherType}:`, error);
            reject(error);
          }
        );
      });

      // Cache the loaded texture
      envMapCache.current.set(weatherType, texture);
      console.log(`✅ Background texture loaded and cached for: ${weatherType}`);
      return texture;

    } catch (error) {
      console.error(`❌ Failed to load background for ${weatherType}:`, error);
      return null;
    }
  };

  // Apply simple background texture to scene (not as environment map)
  const applySceneBackground = (scene: THREE.Scene, backgroundTexture: THREE.Texture | null) => {
    if (!scene) {
      console.warn('Scene not available for background');
      return;
    }

    console.log('Applying scene background:', backgroundTexture ? 'texture loaded' : 'no texture');

    // Set scene background only (no environment mapping)
    if (backgroundTexture) {
      scene.background = backgroundTexture;
      scene.environment = null; // No environment mapping for GLB models
      console.log('✅ Background texture applied to scene');
    } else {
      // Fallback to solid color if no texture
      scene.background = new THREE.Color(0x87CEEB);
      scene.environment = null;
      console.log('❌ No background texture, using fallback color');
    }
  };

  // Enhanced fog effects
  const setupFogEffects = (scene: THREE.Scene, weatherType: 'sunny' | 'rainy' | 'foggy' | 'night') => {
    // Remove existing fog
    scene.fog = null;

    switch (weatherType) {
      case 'foggy':
        // Dense fog effect
        scene.fog = new THREE.Fog(0xcccccc, 1, 8);
        break;
      case 'rainy':
        // Light atmospheric fog
        scene.fog = new THREE.Fog(0x666666, 2, 10);
        break;
      case 'night':
        // Dark atmospheric effect
        scene.fog = new THREE.Fog(0x111122, 3, 12);
        break;
      case 'sunny':
      default:
        // Clear visibility
        scene.fog = null;
        break;
    }
  };

  // 3D controls - Start with a nice angle (slightly tilted and rotated)
  const [rotation, setRotation] = useState({ x: 0, y: 1.57 });
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  const [cameraDistance, setCameraDistance] = useState(5.0); // Moved a bit closer (was 6.0)
  const cameraDistanceRef = useRef(cameraDistance);
  useEffect(() => { cameraDistanceRef.current = cameraDistance; }, [cameraDistance]);

  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const lastRotation = useRef({ x: 0, y: 0 });

  const resetViewerTransform = () => {
    setRotation({ x: 0, y: 1.57 });
    setCameraDistance(5.0); // Match new default
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
        console.log(`🔍 Fetching product with ID: ${id}`);
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('❌ Supabase error:', error);
          setLoading(false);
          return;
        }

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
            raw,
          };
        };

        const normalized = normalizeProduct(data);
        console.log('📦 Product data normalized:', {
          id: normalized.id,
          name: normalized.name,
          glb_count: normalized.glb_urls.length,
          image1: normalized.image1,
        });

        setProduct(normalized);
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
      if (rendererRef.current) rendererRef.current.dispose();
      if (sceneRef.current) sceneRef.current.clear();
    };
  }, [id]);

  // Enhanced GLB model loader (preferred for mobile)
  const loadSupabaseGLBModel = async (glbUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🚀 Loading GLB model (optimized for mobile): ${glbUrl}`);

        // Validate URL before proceeding
        if (!glbUrl || typeof glbUrl !== 'string' || glbUrl.trim() === '') {
          throw new Error('Invalid GLB URL provided');
        }

        if (typeof TextDecoder === 'undefined') {
          console.error('❌ TextDecoder is NOT available. GLB loading will fail.');
        } else {
          console.log('✅ TextDecoder is available.');
        }

        const loader = new GLTFLoader();

        // Optional: Add DRACO compression support for even smaller files
        const dracoLoader = new DRACOLoader();
        try {
          // Use a reliable CDN for the decoder
          dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          loader.setDRACOLoader(dracoLoader);
          console.log('✅ DRACO compression support enabled');
        } catch (e) {
          console.log('⚠️ DRACO loader not available, using standard GLB');
        }

        loader.load(
          glbUrl,
          (gltf: any) => {
            console.log(`GLB model loaded successfully for product ${productId}`);
            const model = gltf.scene;

            // GLB models are usually properly scaled, but ensure visibility
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            if (maxDim > 0) {
              const targetSize = 3.5; // Optimized scale for mobile screen
              const scale = targetSize / maxDim;
              model.scale.multiplyScalar(scale);
              console.log(`GLB model scaled by ${scale.toFixed(3)} to fit mobile screen`);
            }

            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            // Fine tune vertical position (move down slightly if needed)
            model.position.y -= 0.2;

            // Enable shadows and tag as GLB content
            model.traverse((child: any) => {
              if ((child as THREE.Mesh).isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
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

  // FBX model loader
  const loadSupabaseFBXModel = async (fbxUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🚀 Loading FBX model: ${fbxUrl}`);
        const loader = new FBXLoader();
        loader.load(
          fbxUrl,
          (object: any) => {
            console.log(`FBX model loaded successfully for product ${productId}`);

            // FBX models often need scaling adjustment (often too big or too small)
            // We use the same auto-scaling logic as GLB to ensure consistency
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);

            if (maxDim > 0) {
              const targetSize = 3.5; // Match our tuned GLB size
              const scale = targetSize / maxDim;
              object.scale.multiplyScalar(scale);
              console.log(`FBX model scaled by ${scale.toFixed(3)} to fit`);
            }

            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
            // Fine tune vertical position
            object.position.y -= 0.2;

            // Enable shadows
            object.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            resolve(object);
          },
          (progress: any) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setLoadingProgress(percent);
            console.log(`FBX loading progress: ${percent}%`);
          },
          (error: any) => {
            console.error(`FBX loading failed for product ${productId}:`, error);
            reject(error);
          }
        );
      } catch (error) {
        console.error(`FBX loader setup failed:`, error);
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

    console.log(`🎯 Loading GLB model: ${modelUrl}`);
    return await loadSupabaseGLBModel(modelUrl, productId);
  };


  // Simple fallback model
  const createFallbackModel = (productData?: any) => {
    console.log(`Creating visible fallback model`);

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

    console.log(`Fallback model created with dimensions: 2x1x1 + 0.5x0.5x0.5 indicator`);
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
      console.log(`Attempting to load GLB model`);
      // Load GLB model (only format we support)
      const model3D = await loadGLBModel(modelUrl, productData?.id || 'unknown');
      modelCache.current.set(modelUrl, model3D);
      console.log(`GLB model cached successfully`);
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
      console.log('Advanced glass features not available, using fallback');
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

    // Ensure directional light is in the scene
    if (!directionalLightRef.current) {
      directionalLightRef.current = new THREE.DirectionalLight(0xffffff, 1.0);
    }
    if (directionalLightRef.current.parent !== scene) {
      scene.add(directionalLightRef.current);
    }
  };



  const removeSkybox = (scene: THREE.Scene) => {
    if (!skyboxRef.current) return;
    scene.remove(skyboxRef.current);
    try {
      (skyboxRef.current.geometry as any).dispose();
      if (Array.isArray(skyboxRef.current.material)) {
        skyboxRef.current.material.forEach(m => m.dispose());
      } else {
        (skyboxRef.current.material as any).dispose();
      }
    } catch { }
    skyboxRef.current = null;
  };

  const createSkybox = (scene: THREE.Scene, texture: THREE.Texture) => {
    removeSkybox(scene);

    // Create a large sphere for the skybox
    const geometry = new THREE.SphereGeometry(50, 60, 40);
    // Invert the geometry on the x-axis so that all of the faces point inward
    geometry.scale(-1, 1, 1);

    // Ensure texture wrapping is correct for sphere
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false // Skybox shouldn't be affected by fog
    });

    const skybox = new THREE.Mesh(geometry, material);
    skybox.name = 'Skybox';
    skybox.position.set(0, 0, 0);

    skyboxRef.current = skybox;
    scene.add(skybox);
    console.log('🌌 Skybox added to scene');
  };



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

    // Position matches the directional light
    sun.position.set(5, 10, -5); // Moved slightly back to be visible in background
    sun.name = 'Sun';

    // Add a glow effect (larger semi-transparent sphere)
    const glowGeo = new THREE.SphereGeometry(2.5, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    sun.add(glow);

    sunMeshRef.current = sun;
    scene.add(sun);
    console.log('☀️ Sun added to scene');
  };

  const removeSun = (scene: THREE.Scene) => {
    if (!sunMeshRef.current) return;
    scene.remove(sunMeshRef.current);
    try {
      (sunMeshRef.current.geometry as any).dispose();
      (sunMeshRef.current.material as any).dispose();
    } catch { }
    sunMeshRef.current = null;
  };

  // Simple Weather Lighting System with JPG Backgrounds
  const setupWeatherLighting = async (scene: THREE.Scene, weather: string, gl?: any) => {
    console.log(`Setting up weather: ${weather}`);

    // Initialize lights if first time
    initializeLights(scene);

    // remove sun by default, add only if sunny
    removeSun(scene);

    // Load and apply simple background texture
    // let backgroundTexture: THREE.Texture | null = null;
    // try {
    //   // Helper to load local asset to texture
    //   const loadLocalTexture = async (resourceId: any) => {
    //     try {
    //       console.log('⏳ Starting background load...');
    //       const asset = Asset.fromModule(resourceId);
    //       await asset.downloadAsync();

    //       console.log(`📂 Asset URI: ${asset.uri} | Local: ${asset.localUri}`);

    //       const loader = new THREE.TextureLoader();
    //       const uri = asset.localUri || asset.uri || '';
    //       if (!uri) throw new Error('No URI for background asset');

    //       const texture = await loader.loadAsync(uri);
    //       console.log('🖼️ TextureLoader finished success');
    //       return texture;
    //     } catch (innerErr) {
    //       console.error('💥 Error in loadLocalTexture:', innerErr);
    //       throw innerErr;
    //     }
    //   };

    //   const bgResource = BackgroundAssets[weather as keyof typeof BackgroundAssets];
    //   if (bgResource) {
    //     backgroundTexture = await loadLocalTexture(bgResource);
    //     if (backgroundTexture) {
    //       backgroundTexture.mapping = THREE.EquirectangularReflectionMapping;
    //       backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    //       scene.background = backgroundTexture;
    //       scene.environment = backgroundTexture; // Also use for reflections
    //       console.log(`✅ Background applied for ${weather}`);
    //     }
    //   } else {
    //     console.warn(`⚠️ No asset found for weather: ${weather}`);
    //   }
    // } catch (error) {
    //   console.warn(`Failed to load background for ${weather}, using fallback:`, error);
    //   // Apply fallback background if failure
    //   scene.background = new THREE.Color(0x87CEEB);
    // }

    // TEMP: Force simple skyblue background for now per request
    scene.background = new THREE.Color(0x87CEEB);

    // Setup fog effects
    setupFogEffects(scene, weather as any);

    // Configure lighting based on weather (simplified - no environment mapping)
    switch (weather) {
      case 'sunny':
        createSun(scene); // Add the sun visual
        ambientLightRef.current!.color.setHex(0xfffef0);
        ambientLightRef.current!.intensity = 0.9;
        directionalLightRef.current!.color.setHex(0xffffe0);
        directionalLightRef.current!.intensity = 1.2;
        directionalLightRef.current!.position.set(5, 10, 5);
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.intensity = 0;
        removeRain(scene);
        break;

      case 'rainy':
        ambientLightRef.current!.color.setHex(0x404060);
        ambientLightRef.current!.intensity = 0.6;
        directionalLightRef.current!.color.setHex(0x6699ff);
        directionalLightRef.current!.intensity = 0.8;
        directionalLightRef.current!.position.set(-3, 8, 3);
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.intensity = 0;
        createRain(scene);
        break;

      case 'foggy':
        ambientLightRef.current!.color.setHex(0xf0f0f0);
        ambientLightRef.current!.intensity = 0.8;
        directionalLightRef.current!.color.setHex(0xffffff);
        directionalLightRef.current!.intensity = 0.4;
        directionalLightRef.current!.position.set(0, 5, 0);
        directionalLightRef.current!.castShadow = false;
        pointLight1Ref.current!.intensity = 0;
        removeRain(scene);
        break;

      case 'night':
        ambientLightRef.current!.color.setHex(0x1a1a3a);
        ambientLightRef.current!.intensity = 0.3;
        directionalLightRef.current!.color.setHex(0x8888ff);
        directionalLightRef.current!.intensity = 0.6;
        directionalLightRef.current!.position.set(-5, 10, -5);
        directionalLightRef.current!.castShadow = true;

        pointLight1Ref.current!.color.setHex(0xffcc66);
        pointLight1Ref.current!.intensity = 2.0;
        pointLight1Ref.current!.distance = 25;
        pointLight1Ref.current!.position.set(0, 8, 5);
        pointLight1Ref.current!.castShadow = true;
        removeRain(scene);
        break;

      default:
        ambientLightRef.current!.color.setHex(0xffffff);
        ambientLightRef.current!.intensity = 1.0;
        directionalLightRef.current!.color.setHex(0xffffeb);
        directionalLightRef.current!.intensity = 1.2;
        directionalLightRef.current!.position.set(5, 10, 5);
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.intensity = 0;
        removeRain(scene);
    }

    // Configure shadow map
    if (rendererRef.current) {
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current.shadowMap.autoUpdate = true;

      if (directionalLightRef.current!.castShadow) {
        directionalLightRef.current!.shadow.mapSize.width = 1024;
        directionalLightRef.current!.shadow.mapSize.height = 1024;
        directionalLightRef.current!.shadow.camera.near = 0.5;
        directionalLightRef.current!.shadow.camera.far = 50;
        directionalLightRef.current!.shadow.bias = -0.0001;
      }
    }

    console.log(`Weather setup complete: ${weather}`);
  };

  // Re-apply weather lighting whenever mode changes (keeps viewer responsive)
  useEffect(() => {
    if (sceneRef.current && rendererRef.current && cameraRef.current) {
      console.log(`Applying weather mode: ${weatherMode}`);
      setupWeatherLighting(sceneRef.current, weatherMode).then(() => {
        // Force immediate scene and render update after HDRI loads
        sceneRef.current!.updateMatrixWorld(true);
        if (rendererRef.current && cameraRef.current && sceneRef.current) {
          try {
            // Force render update after weather change
            rendererRef.current.render(sceneRef.current, cameraRef.current);
            console.log(`Weather ${weatherMode} applied and rendered`);
          } catch (e) {
            console.warn('Manual render failed:', e);
          }
        }
      }).catch(error => {
        console.warn('Weather setup failed:', error);
      });
    }
  }, [weatherMode]);

  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const dimsRef = useRef<{ width: number, height: number, depth: number, labelPoints: { name: string, vec: THREE.Vector3, val: number }[] } | null>(null);
  const unitRef = useRef(measurementUnit);

  useEffect(() => {
    unitRef.current = measurementUnit;
  }, [measurementUnit]);

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
      // 1. Temporarily reset transformations to get LOCAL bounding box
      const originalPos = model.position.clone();
      const originalRot = model.rotation.clone();
      const originalScale = model.scale.clone();

      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const min = box.min;
      const max = box.max;
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Restore transformations
      model.position.copy(originalPos);
      model.rotation.copy(originalRot);
      model.scale.copy(originalScale);
      model.updateMatrixWorld(true);

      // Pre-calculate label 3D positions (Local Coordinates)
      const zOffset = max.z + (size.z * 0.1);
      const widthY = min.y;
      const widthMid = new THREE.Vector3(center.x, widthY, zOffset);

      const xOffset = min.x - (size.x * 0.1);
      const heightMid = new THREE.Vector3(xOffset, center.y, max.z);

      const depthMid = new THREE.Vector3(max.x, min.y, center.z);

      // Update dimensions state & ref (Use Scaled Size?)
      // Wait, if model is scaled 2x, the lines will be scaled 2x. 
      // The VISUAL size matches. But the NUMBERS?
      // box.getSize(size) returned unscaled size.
      // We should display the SCALED size to the user?
      // Usually "width" implied Real World Width.
      // If the model is unit-scale (1 unit = 1 meter), scaling it 2x makes it 2 meters.
      // So we should multiply size by scale.
      const worldSize = size.clone().multiply(originalScale);

      const dims = {
        width: worldSize.x, height: worldSize.y, depth: worldSize.z,
        labelPoints: [
          { name: 'Width', vec: widthMid, val: worldSize.x },
          { name: 'Height', vec: heightMid, val: worldSize.y },
          { name: 'Thickness', vec: depthMid, val: worldSize.z }
        ]
      };
      setModelDimensions(dims);
      dimsRef.current = dims;

      const group = new THREE.Group();
      const material = new THREE.LineBasicMaterial({
        color: 0x3b82f6, // blue-500
        depthTest: false,
        transparent: true,
        opacity: 0.7
      });

      // 1. Width Line (Bottom Front)
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(min.x, widthY, zOffset),
        new THREE.Vector3(max.x, widthY, zOffset)
      ]), material));
      // Width Ticks
      const tickSize = Math.min(size.x, size.y, size.z) * 0.1;
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(min.x, widthY - tickSize / 2, zOffset), new THREE.Vector3(min.x, widthY + tickSize / 2, zOffset)
      ]), material));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(max.x, widthY - tickSize / 2, zOffset), new THREE.Vector3(max.x, widthY + tickSize / 2, zOffset)
      ]), material));

      // 2. Height Line (Left Side)
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xOffset, min.y, max.z),
        new THREE.Vector3(xOffset, max.y, max.z)
      ]), material));
      // Height Ticks
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xOffset - tickSize / 2, min.y, max.z), new THREE.Vector3(xOffset + tickSize / 2, min.y, max.z)
      ]), material));
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xOffset - tickSize / 2, max.y, max.z), new THREE.Vector3(xOffset + tickSize / 2, max.y, max.z)
      ]), material));

      // 3. Depth Line (Right Side)
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z)
      ]), material));


      measurementGroupRef.current = group;

      // ATTACH TO MODEL, NOT SCENE
      // This ensures lines rotate/scale/translate with the model
      model.add(group);

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

  // Simple animation loop
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

    const animate = () => {
      if (!viewerVisible) {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        return;
      }

      // Apply rotations and camera distance
      object.rotation.x = rotationRef.current.x;
      object.rotation.y = rotationRef.current.y;
      camera.position.z = cameraDistanceRef.current;

      // animate rain particles if present
      if (rainRef.current && rainVelocities.current) {
        const geom = rainRef.current.geometry as THREE.BufferGeometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        const positions = attr.array as Float32Array;
        const velocities = rainVelocities.current;

        for (let i = 0; i < velocities.length; i++) {
          positions[i * 6 + 1] -= velocities[i];
          positions[i * 6 + 4] -= velocities[i];
          if (positions[i * 6 + 1] < -1) {
            const x = (Math.random() - 0.5) * 8;
            const z = (Math.random() - 0.5) * 8;
            const streakLength = 0.15 + Math.random() * 0.1;
            positions[i * 6 + 0] = x;
            positions[i * 6 + 1] = 8;
            positions[i * 6 + 2] = z;
            positions[i * 6 + 3] = x;
            positions[i * 6 + 4] = 8 - streakLength;
            positions[i * 6 + 5] = z;
            velocities[i] = 0.08 + Math.random() * 0.06;
          }
        }
        attr.needsUpdate = true;
      }

      // Label Calculation (Every 10 frames to save JS thread)
      if (measurementGroupRef.current && frameCount % 5 === 0) {
        updateLabels(object, camera, viewWidth, viewHeight);
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
      // Transform Local Point to World Point using Model's Matrix
      // This handles Rotation, Scale, and Position of the model correctly
      const v = p.vec.clone().applyMatrix4(object.matrixWorld).project(camera);

      // Check if in front of camera (NDC z is -1 to 1)
      if (v.z > 1 || v.z < -1) return;

      // Convert NDC to Screen Coords
      const x = (v.x * 0.5 + 0.5) * vModW;
      const y = (-(v.y * 0.5) + 0.5) * vModH;

      // Format value
      let val = p.val;
      let unitStr = unit;
      if (unit === 'mm') {
        val = val * 1000;
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

  // PanResponder for 3D controls
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 1) {
          lastRotation.current = { ...rotation };
        }
        if (evt.nativeEvent.touches.length === 2) {
          const [a, b] = evt.nativeEvent.touches;
          setLastDistance(Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY));
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 1) {
          setRotation({
            x: lastRotation.current.x + gestureState.dy * 0.01,
            y: lastRotation.current.y + gestureState.dx * 0.01,
          });
        }
        if (evt.nativeEvent.touches.length === 2) {
          const [a, b] = evt.nativeEvent.touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          if (lastDistance) {
            let delta = (dist - lastDistance) * 0.02;
            setCameraDistance((prev) => Math.max(1, Math.min(10, prev - delta)));
          }
          setLastDistance(dist);
        }
      },
      onPanResponderRelease: () => {
        setLastDistance(null);
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

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
        <GLView
          key={`viewer-${selectedModelIndex}`}
          style={{ width: viewerWidth, height: viewerHeight, borderRadius: 16 }}
          onContextCreate={async (gl: any) => {
            console.log('🚀 GLView context created, initializing 3D scene...');
            setModelLoading(true);
            setModelError(false);
            setLoadingProgress(0);

            try {
              if (!gl) throw new Error('WebGL context not available');

              // Define modelKey for caching
              const modelUrls = Array.isArray(product?.glb_urls) ? product.glb_urls : [];
              const targetUrl = modelUrls.length > 0 ? modelUrls[selectedModelIndex] || 'fallback' : 'fallback';
              console.log('🔑 Using model key:', targetUrl, 'for index:', selectedModelIndex);

              // init scene/camera/renderer if missing
              if (!sceneRef.current) {
                sceneRef.current = new THREE.Scene();
                sceneRef.current.background = new THREE.Color(0xf2f2f2);
                console.log('🎬 Scene created with light gray background');
              }
              if (!cameraRef.current) {
                cameraRef.current = new THREE.PerspectiveCamera(60, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
                cameraRef.current.position.set(0, 0, cameraDistanceRef.current);
                cameraRef.current.lookAt(0, 0, 0); // Make sure camera looks at origin
                console.log('📷 Camera positioned at:', cameraRef.current.position, 'looking at origin');
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

              if (!rendererRef.current) {
                rendererRef.current = new THREE.WebGLRenderer({
                  context: gl as any,
                  canvas: expogl.canvas,
                  antialias: true,
                  alpha: false,
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
                rendererRef.current.toneMappingExposure = 1.0;
                try {
                  // Deprecated in newer Three.js
                  (rendererRef.current as any).physicallyCorrectLights = true;
                } catch { }
                rendererRef.current.setClearColor(0xf2f2f2);
              } else {
                // keep sizes in sync on re-creation
                rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
              }

              const scene = sceneRef.current!;
              const camera = cameraRef.current!;
              const renderer = rendererRef.current!;

              // Clear previous children before adding model
              scene.clear();

              // Apply current weather lighting (Non-blocking to speed up TTI)
              // We don't await this because header/weather images (12MB+) are too slow
              setupWeatherLighting(scene, weatherMode, gl);

              // Force background update after weather setup
              if (rendererRef.current) {
                rendererRef.current.render(scene, camera);
                console.log(`Initial background set for ${weatherMode}`);
              }

              // Use cached model when available
              const cached = modelCache.current.get(targetUrl);
              if (cached) {
                console.log('Using cached model for:', targetUrl);
                const inst = cached.clone ? cached.clone() : cached;
                scene.add(inst);
                currentModelRef.current = inst;
                updateMeasurementLines();
                setModelLoading(false);
                startAnimationLoop(scene, camera, renderer, inst as THREE.Object3D, gl, viewerWidth, viewerHeight);
                return;
              }

              let finalModel: THREE.Object3D;

              // Attempt to load proper format based on extension
              if (targetUrl !== 'fallback') {
                try {
                  console.log('🔄 Attempting to load 3D model:', targetUrl);

                  if (!targetUrl || targetUrl.trim() === '') {
                    throw new Error("Empty URL");
                  }

                  let model3D: THREE.Object3D;
                  const lowerUrl = targetUrl.toLowerCase();

                  if (lowerUrl.includes('.fbx')) {
                    model3D = await loadSupabaseFBXModel(targetUrl, product.id);
                  } else {
                    // Default to GLB (most common)
                    try {
                      model3D = await loadGLBModel(targetUrl, product.id);
                    } catch (glbError: any) {
                      // Fallback: If GLB failed with JSON/Parse error, it might be an FBX file with wrong/missing extension
                      console.warn('⚠️ Standard GLB load failed, checking for FBX fallback...', glbError);
                      const errStr = String(glbError);
                      if (errStr.includes('Unexpected character') || errStr.includes('JSON') || errStr.includes('SyntaxError')) {
                        console.log('🔄 Retrying as FBX model...');
                        model3D = await loadSupabaseFBXModel(targetUrl, product.id);
                      } else {
                        throw glbError;
                      }
                    }
                  }

                  // Common processing (shadows etc are already done in loaders but good to ensure)
                  processGLBMaterials(model3D);
                  finalModel = model3D;
                  console.log('✅ 3D model loaded successfully');
                } catch (err) {
                  console.warn('❌ Model load failed, using fallback:', err);
                  finalModel = createFallbackModel();
                }
              } else {
                console.log('🔶 Using fallback model directly');
                finalModel = createFallbackModel();
              }

              // Process materials and add to scene
              processGLBMaterials(finalModel);
              modelCache.current.set(targetUrl, finalModel.clone ? finalModel.clone() : finalModel);
              scene.add(finalModel);
              currentModelRef.current = finalModel;
              updateMeasurementLines();
              setLoadingProgress(100);
              setModelLoading(false);

              console.log('🎯 Model added to scene, starting animation loop');
              startAnimationLoop(scene, camera, renderer, finalModel, gl, viewerWidth, viewerHeight);
            } catch (error) {
              console.error('3D viewer init error', error);
              setModelLoading(false);
              setModelError(true);
            }
          }}
        />

        {/* model selector (if multiple) */}
        {Array.isArray(product?.glb_urls) && product.glb_urls.length > 1 && (
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
        )}

        {/* quick overlay: weather buttons (mobile-friendly) */}
        <View style={styles.weatherOverlay}>
          <TouchableOpacity style={[styles.weatherQuickButton, weatherMode === 'sunny' && styles.weatherQuickActive]} onPress={() => setWeatherMode('sunny')}>
            <Ionicons name="sunny" size={18} color={weatherMode === 'sunny' ? '#fff' : '#333'} />
            <Text style={[styles.weatherQuickText, weatherMode === 'sunny' && { color: '#fff' }]}>Sunny</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.weatherQuickButton, weatherMode === 'rainy' && styles.weatherQuickActive]} onPress={() => setWeatherMode('rainy')}>
            <Ionicons name="rainy" size={18} color={weatherMode === 'rainy' ? '#fff' : '#333'} />
            <Text style={[styles.weatherQuickText, weatherMode === 'rainy' && { color: '#fff' }]}>Rainy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.weatherQuickButton, weatherMode === 'foggy' && styles.weatherQuickActive]} onPress={() => setWeatherMode('foggy')}>
            <Ionicons name="cloudy" size={18} color={weatherMode === 'foggy' ? '#fff' : '#333'} />
            <Text style={[styles.weatherQuickText, weatherMode === 'foggy' && { color: '#fff' }]}>Foggy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.weatherQuickButton, weatherMode === 'night' && styles.weatherQuickActive]} onPress={() => setWeatherMode('night')}>
            <Ionicons name="moon" size={18} color={weatherMode === 'night' ? '#fff' : '#333'} />
            <Text style={[styles.weatherQuickText, weatherMode === 'night' && { color: '#fff' }]}>Night</Text>
          </TouchableOpacity>
        </View>

        {/* Measurement Labels */}
        {showMeasurements && measurementLabels.map((lbl, i) => (
          <View key={i} style={[styles.measurementLabel, { left: lbl.x, top: lbl.y }]}>
            <Text style={styles.measurementText}>{lbl.text}</Text>
          </View>
        ))}

        {/* Measurement Controls Panel */}
        <View style={styles.measurementPanel}>
          <View style={styles.measurementHeader}>
            <Text style={styles.measurementTitle}>Measurements</Text>
            <Switch
              value={showMeasurements}
              onValueChange={setShowMeasurements}
              trackColor={{ false: '#767577', true: '#a81d1d' }}
              thumbColor={showMeasurements ? '#fff' : '#f4f3f4'}
            />
          </View>

          {showMeasurements && (
            <>
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabelText}>Width</Text>
                <Text style={styles.measurementValueText}>
                  {dimsRef.current ? (measurementUnit === 'mm' ? (dimsRef.current.width * 1000).toFixed(0) : (dimsRef.current.width * 100).toFixed(1)) : '-'} {measurementUnit}
                </Text>
              </View>
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabelText}>Height</Text>
                <Text style={styles.measurementValueText}>
                  {dimsRef.current ? (measurementUnit === 'mm' ? (dimsRef.current.height * 1000).toFixed(0) : (dimsRef.current.height * 100).toFixed(1)) : '-'} {measurementUnit}
                </Text>
              </View>
              <View style={styles.measurementRow}>
                <Text style={styles.measurementLabelText}>Thickness</Text>
                <Text style={styles.measurementValueText}>
                  {dimsRef.current ? (measurementUnit === 'mm' ? (dimsRef.current.depth * 1000).toFixed(0) : (dimsRef.current.depth * 100).toFixed(1)) : '-'} {measurementUnit}
                </Text>
              </View>

              <View style={styles.unitSelector}>
                <Text style={{ color: '#ccc', marginRight: 8, fontSize: 11 }}>Units</Text>
                <View style={{ flexDirection: 'row', backgroundColor: '#333', borderRadius: 8 }}>
                  <TouchableOpacity onPress={() => setMeasurementUnit('mm')} style={[styles.unitButton, measurementUnit === 'mm' && styles.unitButtonActive]}>
                    <Text style={styles.unitText}>mm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setMeasurementUnit('cm')} style={[styles.unitButton, measurementUnit === 'cm' && styles.unitButtonActive]}>
                    <Text style={styles.unitText}>cm</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.measurementNote}>Using product dimensions from Supabase.</Text>
            </>
          )}
        </View>

        {/* loading / error overlays */}
        {modelLoading && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }]}>
            <ActivityIndicator size="large" color="#a81d1d" />
            <Text style={{ marginTop: 8, color: '#444' }}>Loading 3D model...</Text>
            {loadingProgress > 0 && <Text style={{ color: '#a81d1d', marginTop: 6 }}>{Math.round(loadingProgress)}%</Text>}
          </View>
        )}
        {modelError && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)' }]}>
            <Ionicons name="warning-outline" size={36} color="#ff6b6b" />
            <Text style={{ marginTop: 8, color: '#666', textAlign: 'center' }}>Unable to load model.</Text>
          </View>
        )}
      </View>
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

  // Add to cart -> insert or upsert into 'user_items' for the signed-in user
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

      // find existing row for this user + product
      const { data: existing, error: selErr } = await supabase
        .from('user_items')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', product?.id)
        .eq('item_type', 'order')
        .maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        // Update quantity if item already in cart
        const newQty = (existing.quantity ?? 1) + qty;
        const newTotal = newQty * (product?.price ?? 0);
        const { error: updErr } = await supabase
          .from('user_items')
          .update({
            quantity: newQty,
            total_amount: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        // Insert new cart item with required columns from your schema
        const payload = {
          user_id: userId,
          product_id: product?.id,
          item_type: 'order', // Required: 'my-list', 'reserve', 'order', 'reservation'
          status: 'active', // Default status
          quantity: qty,
          price: product?.price ?? 0,
          total_amount: (product?.price ?? 0) * qty,
        };
        const { error: insErr } = await supabase.from('user_items').insert([payload]);
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
  viewerModalBox: {
    width: width * 0.97,
    backgroundColor: '#1a1d28',
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
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 29, 40, 0.85)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    zIndex: 100,
  },
  weatherQuickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    elevation: 0,
    flex: 1,
    marginHorizontal: 3,
  },
  weatherQuickActive: {
    backgroundColor: '#a81d1d',
  },
  weatherQuickText: {
    fontSize: 13,
    color: '#ffffff',
    marginLeft: 5,
    fontWeight: '600',
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
  }
});