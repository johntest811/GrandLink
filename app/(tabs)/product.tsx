import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image as RNImage, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, PanResponder, Modal, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { GLView , ExpoWebGLRenderingContext } from 'expo-gl';

// @ts-ignore
import * as THREE from 'three';
// Import FBXLoader for React Native
// @ts-ignore
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import BottomNavBar from "@BottomNav/../components/BottomNav";

// Skybox images for weather backgrounds
const SKYBOX_IMAGES = {
  sunny: require('../../assets/hdris/sunnyy.jpg'),
  rainy: require('../../assets/hdris/rainyy.jpg'),
  foggy: require('../../assets/hdris/foggyy.jpg'),
  night: require('../../assets/hdris/nightt.jpg'),
};

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProductViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fbxLoading, setFbxLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Weather state
  const [weatherMode, setWeatherMode] = useState<'sunny' | 'rainy' | 'foggy' | 'night'>('sunny');

  // 3D model cache and references
  const modelCache = useRef<Map<string, THREE.Object3D>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Rain particle reference - using LineSegments for realistic streaks
  const rainRef = useRef<THREE.LineSegments | null>(null);
  const rainVelocities = useRef<Float32Array | null>(null);
  
  // Create realistic rain streaks
  const createRain = (scene: THREE.Scene) => {
    if (rainRef.current) return;
    const count = 400; // Number of rain streaks
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
      opacity: 0.6,
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
    } catch {}
    rainRef.current = null;
    rainVelocities.current = null;
  };

  // 3D controls
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  const [cameraDistance, setCameraDistance] = useState(4);
  const cameraDistanceRef = useRef(cameraDistance);
  useEffect(() => { cameraDistanceRef.current = cameraDistance; }, [cameraDistance]);

  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const lastRotation = useRef({ x: 0, y: 0 });

  const resetViewerTransform = () => {
    setRotation({ x: 0, y: 0 });
    setCameraDistance(4);
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
          const fbx_raw = raw?.fbx_url ?? raw?.fbx_urls ?? '';
          let fbx_urls: string[] = [];

          // accept comma-separated, JSON array string, or single URL
          if (typeof fbx_raw === 'string') {
            const trimmed = fbx_raw.trim();
            if (trimmed.startsWith('[')) {
              try { fbx_urls = JSON.parse(trimmed); } catch { fbx_urls = trimmed.split(',').map(s => s.trim()).filter(Boolean); }
            } else {
              fbx_urls = trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
          } else if (Array.isArray(fbx_raw)) {
            fbx_urls = fbx_raw.filter(Boolean);
          }

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
            fbx_urls,
            raw,
          };
        };

        const normalized = normalizeProduct(data);
        console.log('📦 Product data normalized:', {
          id: normalized.id,
          name: normalized.name,
          fbx_count: normalized.fbx_urls.length,
          image1: normalized.image1,
        });

  setProduct(normalized);
  setSelectedModelIndex(0);
        setLoading(false);

        // Preload first FBX if present
        if (normalized.fbx_urls && normalized.fbx_urls.length > 0) {
          // Preload all models for quick switching
          normalized.fbx_urls.forEach((u: string) => preloadModel(u, normalized));
        } else {
          console.warn(`⚠️ No valid FBX URLs found for product: ${normalized.name}`);
        }
      } catch (error) {
        console.error('❌ Error fetching product:', error);
        setLoading(false);
      }
    };

    fetchProduct();

    return () => {
      if (rendererRef.current) rendererRef.current.dispose();
      if (sceneRef.current) sceneRef.current.clear();
    };
  }, [id]);

  // Load actual FBX model from Supabase storage (same as your admin uploads)
  const loadSupabaseFBXModel = async (fbxUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Loading FBX from admin upload: ${fbxUrl}`);
        console.log(`Product ID: ${productId}`);
        
        // Validate URL
        if (!fbxUrl || fbxUrl.trim() === '') {
          throw new Error('No FBX URL provided from admin upload');
        }
        
        // Construct proper Supabase storage URL if needed
        let fullUrl = fbxUrl;
        if (!fbxUrl.startsWith('http')) {
          // If it's a storage path, construct the full URL
          fullUrl = `https://gijnybivawnsilzqegik.supabase.co/storage/v1/object/public/${fbxUrl}`;
        }
        
        console.log(`Full FBX URL: ${fullUrl}`);
        
        // Try to load with FBXLoader (for React Native)
        const loader = new FBXLoader();
        
        loader.load(
          fullUrl,
          (fbxModel: any) => {
            console.log(`✅ FBX model loaded successfully for product ${productId}`);
            console.log('Model info:', fbxModel);
            
            // Process the model for mobile display
            // Do not force transparency here; keep original materials
            // Material adjustments will be handled by processModelMaterials
            
            // Auto-scale the model based on its size
            const box = new THREE.Box3().setFromObject(fbxModel);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim; // Normalize to 2 units
            fbxModel.scale.set(scale, scale, scale);
            
            // Center the model
            const center = box.getCenter(new THREE.Vector3());
            fbxModel.position.sub(center.multiplyScalar(scale));
            
            resolve(fbxModel);
          },
          (progress: any) => {
            // Show loading progress
            if (progress.total > 0) {
              const percentage = (progress.loaded / progress.total) * 100;
              setLoadingProgress(Math.round(percentage));
              console.log(`📊 Loading progress: ${percentage.toFixed(1)}%`);
            }
          },
          (error: any) => {
            console.error(`Failed to load FBX for product ${productId}:`, error);
            console.error(`Failed URL: ${fullUrl}`);
            
            // Provide detailed error info
            if (error.message) {
              console.error(`Error message: ${error.message}`);
            }
            
            reject(new Error(`FBX loading failed: ${error.message || 'Unknown error'}`));
          }
        );
        
      } catch (error) {
        console.error(`FBX loader setup error for product ${productId}:`, error);
        reject(error);
      }
    });
  };

  const loadFBXFromSupabase = async (fbxUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Attempting to load FBX for product ID: ${productId}`);
        console.log(`FBX URL: ${fbxUrl}`);
        
        // Validate the URL
        if (!fbxUrl || fbxUrl.trim() === '') {
          throw new Error('FBX URL is empty or invalid');
        }
        
        // Create FBX loader instance
        const loader = new FBXLoader();
        
        // Set up loading manager for better error handling
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onLoad = () => {
          console.log(`Loading manager: All resources loaded for product ${productId}`);
        };
        loadingManager.onError = (url) => {
          console.error(`Loading manager error for URL: ${url}`);
        };
        
        loader.manager = loadingManager;
        
        // Ensure URL is properly formatted for Supabase storage
        let finalUrl = fbxUrl;
        if (!fbxUrl.startsWith('http')) {
          // If it's a relative path, construct the full Supabase storage URL
          finalUrl = `https://gijnybivawnsilzqegik.supabase.co/storage/v1/object/public/${fbxUrl}`;
        }
        
        console.log(`Final FBX URL: ${finalUrl}`);
        
        loader.load(
          finalUrl,
          (object: any) => {
            console.log(`FBX model loaded successfully for product: ${productId}`);
            console.log('Model details:', object);
            
            // Keep original materials; will normalize in processModelMaterials
            
            // Scale the model appropriately - adjust these values based on your models
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const maxSize = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxSize; // Normalize to reasonable size
            object.scale.set(scale, scale, scale);
            
            // Center the model
            box.setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
            
            resolve(object);
          },
          (progress: any) => {
            // Update loading progress
            if (progress.total > 0) {
              const percentage = (progress.loaded / progress.total) * 100;
              setLoadingProgress(percentage);
              console.log(`Loading progress for product ${productId}: ${percentage.toFixed(1)}%`);
            }
          },
          (error: any) => {
            console.error(`Error loading FBX for product ${productId}:`, error);
            console.error(`Failed URL: ${finalUrl}`);
            reject(error);
          }
        );
      } catch (error) {
        console.error(`FBX loader initialization error for product ${productId}:`, error);
        reject(error);
      }
    });
  };

  // Simple fallback model
  const createFallbackModel = (productData?: any) => {
    console.log(`Creating fallback model`);
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(0.5, 0.5, 0.5);
    
    console.log(`Fallback model created`);
    return mesh;
  };

  // Preload model for faster viewing
  const preloadModel = async (modelUrl: string, productData?: any) => {
    if (modelCache.current.has(modelUrl)) return;
    
    try {
      console.log(`🚀 Attempting to load actual FBX from admin upload`);
      // Try to load the actual FBX model from Supabase storage
      const model3D = await loadSupabaseFBXModel(modelUrl, productData?.id || 'unknown');
      processModelMaterials(model3D);
      modelCache.current.set(modelUrl, model3D);
      console.log(`Real FBX model cached from admin upload`);
    } catch (error) {
      console.warn('FBX loading failed, using fallback:', error);
      // Use fallback model if FBX loading fails
      const fallbackModel = createFallbackModel();
      processModelMaterials(fallbackModel);
      modelCache.current.set(modelUrl, fallbackModel);
    }
  };

  // Create a glass-like physical material (mobile-friendly approximation)
  const createGlassMaterial = (): THREE.Material => {
    // For Android/mobile, use simpler material that works with WebGL 1
    // MeshPhysicalMaterial with transmission requires WebGL2
    if (Platform.OS === 'android') {
      // Use MeshStandardMaterial for better Android compatibility
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.15,
        roughness: 0.02,
        metalness: 0.0,
        side: THREE.DoubleSide,
        flatShading: false,
      });
      return mat as THREE.Material;
    }
    
    // iOS/Web: Try advanced glass material
    const mat = new (THREE as any).MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.12,
      roughness: 0.01,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    try {
      // Use transmission/IOR when available (WebGL2 path)
      (mat as any).transmission = 0.98;
      (mat as any).ior = 1.52;
      (mat as any).thickness = 0.1;
      (mat as any).envMapIntensity = 1.2;
    } catch {}
    return mat as unknown as THREE.Material;
  };

  // Create frame material (black/metal)
  const createFrameMaterial = (): THREE.Material => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1c21,
      metalness: 0.9,
      roughness: 0.25,
      envMapIntensity: 1.0,
    });
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

  // Normalize and preserve materials; only apply glass to glass-like parts
  const processModelMaterials = (object: THREE.Object3D) => {
    const glassMat = createGlassMaterial();
    const frameMat = createFrameMaterial();
    object.traverse((child: THREE.Object3D) => {
      if ((child as any).isMesh) {
        const mesh = child as unknown as THREE.Mesh;
        if (!mesh.material) return;

        const normalize = (mat: any) => {
          if (isGlassLike(mesh, mat)) {
            return (glassMat as any).clone ? (glassMat as any).clone() : glassMat;
          }
          if (isFrameLike(mesh, mat)) {
            return (frameMat as any).clone ? (frameMat as any).clone() : frameMat;
          }
          // If already a PBR standard/physical material, preserve original colors from Blender
          if (mat?.isMeshStandardMaterial || mat?.isMeshPhysicalMaterial) {
            try { return mat.clone(); } catch { /* fallback below */ }
          }
          // Convert legacy/basic materials to MeshStandardMaterial while preserving maps
          const params: any = {
            color: (mat?.color && mat.color.isColor) ? mat.color.clone() : new THREE.Color(mat?.color ?? 0xffffff),
            map: mat?.map ?? null,
            normalMap: mat?.normalMap ?? null,
            roughnessMap: mat?.roughnessMap ?? null,
            metalnessMap: mat?.metalnessMap ?? null,
            aoMap: mat?.aoMap ?? null,
            emissiveMap: mat?.emissiveMap ?? null,
            metalness: typeof mat?.metalness === 'number' ? mat.metalness : 0.1,
            roughness: typeof mat?.roughness === 'number' ? mat.roughness : 0.7,
            side: mat?.side ?? THREE.FrontSide,
            transparent: !!mat?.transparent && mat?.opacity < 1,
            opacity: typeof mat?.opacity === 'number' ? Math.max(0.05, Math.min(1, mat.opacity)) : 1,
          };
          const std = new THREE.MeshStandardMaterial(params);
          if (mat?.emissive && mat.emissive.isColor) (std as any).emissive = mat.emissive.clone();
          return std;
        };

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m: any) => normalize(m));
        } else {
          mesh.material = normalize(mesh.material);
        }

        // Ensure texture color space is correct
        const applyEncoding = (m: any) => {
          if (m?.map) {
            try { m.map.encoding = (THREE as any).SRGBColorSpace || (THREE as any).sRGBEncoding; } catch {}
          }
        };
        if (Array.isArray(mesh.material)) mesh.material.forEach(applyEncoding); else applyEncoding(mesh.material);

        mesh.castShadow = false;
        mesh.receiveShadow = false;
      }
    });
  };

  // Weather setup function
  const setupWeatherLighting = async (scene: THREE.Scene, weather: string, gl?: any) => {
    // Remove existing lights
    const existingLights = scene.children.filter(child => 
      child instanceof THREE.Light || 
      child.type === 'AmbientLight' || 
      child.type === 'DirectionalLight' ||
      child.type === 'PointLight'
    );
    existingLights.forEach(light => scene.remove(light));

    // Remove existing fog
    scene.fog = null;

    // Load texture from React Native asset and create THREE texture
    const setBackground = async (weather: string, fallbackColor: number, gl: any) => {
      try {
        const imageAsset = (SKYBOX_IMAGES as any)[weather];
        if (!imageAsset) {
          scene.background = new THREE.Color(fallbackColor);
          console.log(`No image for ${weather}, using color`);
          return;
        }

        // Get image dimensions and create texture from asset
        const asset = RNImage.resolveAssetSource(imageAsset);
        if (!asset || !asset.uri) {
          scene.background = new THREE.Color(fallbackColor);
          console.log(`Could not resolve asset for ${weather}`);
          return;
        }

        // Create texture using GLView.createTextureAsync
        const texture = await gl.createTextureAsync({
          source: asset.uri,
        });
        
        // Convert to THREE.Texture
        const threeTexture = new THREE.Texture();
        threeTexture.image = texture;
        threeTexture.needsUpdate = true;
        threeTexture.mapping = THREE.EquirectangularReflectionMapping;
        
        scene.background = threeTexture;
        scene.environment = threeTexture;
        console.log(`Loaded texture background for ${weather}`);
      } catch (error) {
        console.warn(`Failed to load texture for ${weather}:`, error);
        scene.background = new THREE.Color(fallbackColor);
        scene.environment = null;
      }
    };

    switch (weather) {
      case 'sunny':
        // Bright sunny lighting with warm yellow tones
        const sunAmbient = new THREE.AmbientLight(0xfffef0, 0.9);
        const sunHemisphere = new THREE.HemisphereLight(0xffffcc, 0xfff4d6, 0.7);
        const sunDirectional = new THREE.DirectionalLight(0xffffe0, 1.2);
        sunDirectional.position.set(5, 10, 5);
        scene.add(sunAmbient);
        scene.add(sunHemisphere);
        scene.add(sunDirectional);
        
        if (gl) await setBackground('sunny', 0x87CEEB, gl);
        else scene.background = new THREE.Color(0x87CEEB);
        // Add subtle fog for white-to-yellow gradient effect
        scene.fog = new THREE.Fog(0xfffacd, 8, 20);
        removeRain(scene);
        break;
        
      case 'rainy':
        // Dark cloudy lighting with blue tint
        const rainAmbient = new THREE.AmbientLight(0x404040, 0.6);
        const rainDirectional = new THREE.DirectionalLight(0x6699ff, 0.8);
        rainDirectional.position.set(-3, 8, 3);
        scene.add(rainAmbient);
        scene.add(rainDirectional);
        
        if (gl) await setBackground('rainy', 0x778899, gl);
        else scene.background = new THREE.Color(0x778899);
        
        // Add fog for rain effect
        scene.fog = new THREE.Fog(0x2F4F4F, 1, 15);
        createRain(scene);
        break;
        
      case 'foggy':
        // Soft diffused lighting
        const fogAmbient = new THREE.AmbientLight(0xffffff, 0.7);
        const fogHemisphere = new THREE.HemisphereLight(0xffffff, 0x999999, 0.4);
        const fogDirectional = new THREE.DirectionalLight(0xffffff, 0.3);
        fogDirectional.position.set(0, 5, 0);
        scene.add(fogAmbient);
        scene.add(fogHemisphere);
        scene.add(fogDirectional);
        
        if (gl) await setBackground('foggy', 0xd3d3d3, gl);
        else scene.background = new THREE.Color(0xd3d3d3);
        
        // Heavy fog
        scene.fog = new THREE.Fog(0xE6E6FA, 2, 8);
        removeRain(scene);
        break;
        
      case 'night':
        // Night scene with visible street lamp-style lighting
        const nightAmbient = new THREE.AmbientLight(0x3a3a5a, 0.6);
        const moonLight = new THREE.DirectionalLight(0x9999ff, 1.0);
        moonLight.position.set(-5, 10, -5);
        
        // Main street lamps
        const streetLamp1 = new THREE.PointLight(0xffcc66, 1.2, 15);
        streetLamp1.position.set(-3, 4, 3);
        
        const streetLamp2 = new THREE.PointLight(0xffcc66, 1.2, 15);
        streetLamp2.position.set(3, 4, 3);
        
        // Additional fill lights
        const frontLight = new THREE.PointLight(0xffffee, 1.0, 14);
        frontLight.position.set(0, 2, 6);
        
        const backLight = new THREE.PointLight(0xaabbff, 0.8, 12);
        backLight.position.set(0, 3, -6);
        
        const leftLight = new THREE.PointLight(0xffaa44, 0.9, 12);
        leftLight.position.set(-5, 2, 0);
        
        const rightLight = new THREE.PointLight(0xffaa44, 0.9, 12);
        rightLight.position.set(5, 2, 0);
        
        const topLight = new THREE.PointLight(0xccddff, 0.7, 10);
        topLight.position.set(0, 7, 0);
        
        scene.add(nightAmbient);
        scene.add(moonLight);
        scene.add(streetLamp1);
        scene.add(streetLamp2);
        scene.add(frontLight);
        scene.add(backLight);
        scene.add(leftLight);
        scene.add(rightLight);
        scene.add(topLight);
        
        if (gl) await setBackground('night', 0x0a0a1a, gl);
        else scene.background = new THREE.Color(0x0a0a1a);
        removeRain(scene);
        break;
        
      default:
        // Default sunny
        const defaultAmbient = new THREE.AmbientLight(0xffffff, 1.0);
        const defaultHemisphere = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.5);
        const defaultSun = new THREE.DirectionalLight(0xffffeb, 1.2);
        defaultSun.position.set(5, 10, 5);
        scene.add(defaultAmbient);
        scene.add(defaultHemisphere);
        scene.add(defaultSun);
        
        if (gl) await setBackground('sunny', 0x87CEEB, gl);
        else scene.background = new THREE.Color(0x87CEEB);
        removeRain(scene);
    }
  };

  // Re-apply weather lighting whenever mode changes (keeps viewer responsive)
  useEffect(() => {
    if (sceneRef.current) {
      setupWeatherLighting(sceneRef.current, weatherMode).catch(e => {
        console.warn('Weather lighting update error:', e);
      });
    }
  }, [weatherMode]);

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

  // Optimized 3D FBX Viewer (mobile friendly) with quick weather buttons overlay
  const renderFBXViewer = () => {
    // prefer normalized array first (the product normalization stores fbx_urls)
    const modelKey = product?.fbx_urls?.[selectedModelIndex] ?? product?.fbx_urls?.[0] ?? product?.fbx_url ?? null;
    // show placeholder if no model key
    if (!modelKey) {
      return (
        <View style={styles.fbxModalContent}>
          <Text style={{ color: '#666' }}>No 3D model available for this product.</Text>
        </View>
      );
    }

    const viewerWidth = Math.min(width * 0.92, 480);
    const viewerHeight = Math.min(SCREEN_HEIGHT * 0.55, 420);

    // Handle mouse wheel for zoom (desktop/web)
    const handleWheel = (event: any) => {
      if (event && event.nativeEvent && event.nativeEvent.deltaY) {
        const delta = event.nativeEvent.deltaY;
        setCameraDistance(prev => {
          const newDistance = prev + delta * 0.01;
          return Math.max(1.5, Math.min(10, newDistance)); // Clamp between 1.5 and 10
        });
        event.preventDefault();
      }
    };

    return (
      <View 
        style={styles.fbxModalContent} 
        {...panResponder.panHandlers}
      >
        <GLView
          key={`viewer-${selectedModelIndex}`}
          style={{ width: viewerWidth, height: viewerHeight, borderRadius: 16 }}
          onContextCreate={async (gl) => {
            setFbxLoading(true);
            setModelError(false);
            setLoadingProgress(0);

            try {
              if (!gl) throw new Error('WebGL context not available');

              // init scene/camera/renderer if missing
              if (!sceneRef.current) {
                sceneRef.current = new THREE.Scene();
                sceneRef.current.background = new THREE.Color(0xf2f2f2);
              }
              if (!cameraRef.current) {
                cameraRef.current = new THREE.PerspectiveCamera(60, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
                cameraRef.current.position.set(0, 0, cameraDistanceRef.current);
              }
              // Polyfill a canvas to prevent THREE from touching `document`
              const expogl: any = gl;
              if (!expogl.canvas) {
                expogl.canvas = {
                  width: gl.drawingBufferWidth,
                  height: gl.drawingBufferHeight,
                  style: {},
                  addEventListener: () => {},
                  removeEventListener: () => {},
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
                  antialias: false,
                });
                rendererRef.current.setPixelRatio(1);
                rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
                rendererRef.current.shadowMap.enabled = false;
                rendererRef.current.setClearColor(0xf2f2f2);
                // Color management & tone mapping for more accurate look
                try {
                  // Newer Three.js
                  (rendererRef.current as any).outputColorSpace = (THREE as any).SRGBColorSpace;
                } catch {
                  // Fallback for older versions
                  (rendererRef.current as any).outputEncoding = (THREE as any).sRGBEncoding;
                }
                try {
                  rendererRef.current.toneMapping = (THREE as any).ACESFilmicToneMapping;
                  (rendererRef.current as any).toneMappingExposure = 1.0;
                  (rendererRef.current as any).physicallyCorrectLights = true;
                } catch {}
              } else {
                // keep sizes in sync on re-creation
                rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
              }

              const scene = sceneRef.current!;
              const camera = cameraRef.current!;
              const renderer = rendererRef.current!;

              // Clear previous children before adding model
              scene.clear();

              // Apply current weather lighting AFTER clearing with gl context
              await setupWeatherLighting(scene, weatherMode, gl);

              // Use cached model when available
              const cached = modelCache.current.get(modelKey);
              if (cached) {
                const inst = cached.clone ? cached.clone() : cached;
                scene.add(inst);
                setFbxLoading(false);
                startAnimationLoop(scene, camera, renderer, inst as THREE.Object3D, gl);
                return;
              }

              // Attempt to load FBX (fallback creates simple mesh)
              try {
                const model3D = await loadSupabaseFBXModel(modelKey, product.id);
                processModelMaterials(model3D);
                modelCache.current.set(modelKey, model3D.clone ? model3D.clone() : model3D);
                scene.add(model3D);
                setLoadingProgress(100);
                setFbxLoading(false);
                startAnimationLoop(scene, camera, renderer, model3D, gl);
              } catch (err) {
                console.warn('FBX load failed, using fallback', err);
                const fallbackModel = createFallbackModel();
                processModelMaterials(fallbackModel);
                modelCache.current.set(modelKey, fallbackModel.clone ? fallbackModel.clone() : fallbackModel);
                scene.add(fallbackModel);
                setFbxLoading(false);
                setLoadingProgress(100);
                startAnimationLoop(scene, camera, renderer, fallbackModel, gl);
              }
            } catch (error) {
              console.error('3D viewer init error', error);
              setFbxLoading(false);
              setModelError(true);
            }
          }}
        />

        {/* model selector (if multiple) */}
        {Array.isArray(product?.fbx_urls) && product.fbx_urls.length > 1 && (
          <View style={styles.modelSelectorRow}>
            <TouchableOpacity
              style={styles.modelArrow}
              onPress={() => setSelectedModelIndex((i) => (i - 1 + product.fbx_urls.length) % product.fbx_urls.length)}
            >
              <Ionicons name="chevron-back" size={20} color="#a81d1d" />
            </TouchableOpacity>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
              {product.fbx_urls.map((_: string, idx: number) => (
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
              onPress={() => setSelectedModelIndex((i) => (i + 1) % product.fbx_urls.length)}
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

        {/* loading / error overlays */}
        {fbxLoading && (
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

  // Simple animation loop
  const startAnimationLoop = (
    scene: THREE.Scene, 
    camera: THREE.PerspectiveCamera, 
    renderer: THREE.WebGLRenderer, 
    object: THREE.Object3D, 
    gl: ExpoWebGLRenderingContext
  ) => {
    let animationId: number;
    
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
          // Move both points of the line segment down
          positions[i * 6 + 1] -= velocities[i];
          positions[i * 6 + 4] -= velocities[i];
          
          // Reset to top when rain falls below certain point
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
            
            // Randomize speed when resetting
            velocities[i] = 0.08 + Math.random() * 0.06;
          }
        }
        
        attr.needsUpdate = true;
      }
      
      try {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      } catch (error) {
        console.warn('Render error:', error);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
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
    if (Array.isArray(product.fbx_urls)) return product.fbx_urls.length;
    if (product.fbx_urls && typeof product.fbx_urls === 'string') {
      return product.fbx_urls.split(',').filter(Boolean).length;
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
          { (features.length > 0 || product?.additional_features_text) && (
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
          <View style={[styles.fbxModalBox, { maxHeight: SCREEN_HEIGHT * 0.88 }] }>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                3D Model Viewer{Array.isArray(product?.fbx_urls) && product.fbx_urls.length > 0 ? ` (${(selectedModelIndex + 1)}/${product.fbx_urls.length})` : ''}
              </Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            {renderFBXViewer()}

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
  fbxPlaceholder: {
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
  fbxModalBox: {
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
  fbxModalContent: {
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
});