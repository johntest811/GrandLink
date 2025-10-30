import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, PanResponder, Modal, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { GLView } from 'expo-gl';
import { ExpoWebGLRenderingContext } from 'expo-gl';
// @ts-ignore
import * as THREE from 'three';
// Import FBXLoader for React Native
// @ts-ignore
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

const { width } = Dimensions.get('window');

export default function ProductViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fbxLoading, setFbxLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [modelError, setModelError] = useState(false);

  // Weather state
  const [weatherMode, setWeatherMode] = useState<'sunny' | 'rainy' | 'foggy' | 'night'>('sunny');

  // 3D model cache and references
  const modelCache = useRef<Map<string, THREE.Object3D>>(new Map());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Rain particle reference
  const rainRef = useRef<THREE.Points | null>(null);
  // small helper to create/remove rain
  const createRain = (scene: THREE.Scene) => {
    if (rainRef.current) return;
    const count = 600;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 6; // x
      positions[i * 3 + 1] = Math.random() * 6 + 1;     // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6; // z
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fc9ff, size: 0.06, transparent: true, opacity: 0.9 });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    rainRef.current = points;
    scene.add(points);
  };
  const removeRain = (scene: THREE.Scene) => {
    if (!rainRef.current) return;
    scene.remove(rainRef.current);
    try { (rainRef.current.geometry as any).dispose(); (rainRef.current.material as any).dispose(); } catch {}
    rainRef.current = null;
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
            stock: raw?.stock ?? 0,
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
        setLoading(false);

        // Preload first FBX if present
        if (normalized.fbx_urls && normalized.fbx_urls.length > 0) {
          preloadModel(normalized.fbx_urls[0], normalized);
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
            fbxModel.traverse((child: any) => {
              if (child.isMesh) {
                // Ensure materials work on mobile
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((mat: any) => {
                      mat.transparent = true;
                      mat.opacity = 0.9;
                      mat.needsUpdate = true;
                    });
                  } else {
                    child.material.transparent = true;
                    child.material.opacity = 0.9;
                    child.material.needsUpdate = true;
                  }
                }
              }
            });
            
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
            console.log(`✅ FBX model loaded successfully for product: ${productId}`);
            console.log('Model details:', object);
            
            // Process the loaded model
            object.traverse((child: THREE.Object3D) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                  // Ensure materials are compatible with mobile rendering
                  if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((mat: THREE.Material) => {
                      (mat as any).transparent = true;
                      (mat as any).opacity = 0.9;
                      (mat as any).needsUpdate = true;
                    });
                  } else {
                    (mesh.material as any).transparent = true;
                    (mesh.material as any).opacity = 0.9;
                    (mesh.material as any).needsUpdate = true;
                  }
                }
              }
            });
            
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
              console.log(`📊 Loading progress for product ${productId}: ${percentage.toFixed(1)}%`);
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

  // Process model materials for performance
  const processModelMaterials = (object: THREE.Object3D) => {
    object.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
        const meshMaterial = (child as THREE.Mesh).material;
        if (Array.isArray(meshMaterial)) {
          meshMaterial.forEach((mat) => {
            if (mat) {
              (mat as THREE.Material & { transparent?: boolean; opacity?: number }).transparent = true;
              (mat as THREE.Material & { transparent?: boolean; opacity?: number }).opacity = 0.8;
            }
          });
        } else if (meshMaterial) {
          (meshMaterial as THREE.Material & { transparent?: boolean; opacity?: number }).transparent = true;
          (meshMaterial as THREE.Material & { transparent?: boolean; opacity?: number }).opacity = 0.8;
        }
      }
    });
  };

  // Weather setup function
  const setupWeatherLighting = (scene: THREE.Scene, weather: string) => {
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

    switch (weather) {
      case 'sunny':
        // Bright sunny lighting
        const sunAmbient = new THREE.AmbientLight(0xffffff, 0.8);
        const sunDirectional = new THREE.DirectionalLight(0xffffff, 1.2);
        sunDirectional.position.set(5, 10, 5);
        scene.add(sunAmbient);
        scene.add(sunDirectional);
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        // remove rain if any
        removeRain(scene);
        break;
        
      case 'rainy':
        // Dark cloudy lighting with blue tint
        const rainAmbient = new THREE.AmbientLight(0x404040, 0.6);
        const rainDirectional = new THREE.DirectionalLight(0x6699ff, 0.8);
        rainDirectional.position.set(-3, 8, 3);
        scene.add(rainAmbient);
        scene.add(rainDirectional);
        scene.background = new THREE.Color(0x2F4F4F); // Dark gray
        
        // Add fog for rain effect
        scene.fog = new THREE.Fog(0x2F4F4F, 1, 15);
        // add rain particles
        createRain(scene);
        break;
        
      case 'foggy':
        // Soft diffused lighting
        const fogAmbient = new THREE.AmbientLight(0xffffff, 0.7);
        const fogDirectional = new THREE.DirectionalLight(0xffffff, 0.3);
        fogDirectional.position.set(0, 5, 0);
        scene.add(fogAmbient);
        scene.add(fogDirectional);
        scene.background = new THREE.Color(0xE6E6FA); // Light gray
        
        // Heavy fog
        scene.fog = new THREE.Fog(0xE6E6FA, 2, 8);
        removeRain(scene);
        break;
        
      case 'night':
        // Dark with cool blue lighting
        const nightAmbient = new THREE.AmbientLight(0x1e1e3f, 0.3);
        const moonLight = new THREE.DirectionalLight(0x6699ff, 0.5);
        moonLight.position.set(-5, 10, -5);
        
        // Add point lights for city/street effect
        const streetLight1 = new THREE.PointLight(0xffaa00, 0.8, 10);
        streetLight1.position.set(3, 3, 3);
        const streetLight2 = new THREE.PointLight(0xffaa00, 0.6, 8);
        streetLight2.position.set(-3, 2, -2);
        
        scene.add(nightAmbient);
        scene.add(moonLight);
        scene.add(streetLight1);
        scene.add(streetLight2);
        scene.background = new THREE.Color(0x000011); // Very dark blue
        removeRain(scene);
        break;
        
      default:
        // Default sunny
        const defaultAmbient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(defaultAmbient);
        scene.background = new THREE.Color(0xf2f2f2);
        removeRain(scene);
    }
  };

  // Re-apply weather lighting whenever mode changes (keeps viewer responsive)
  useEffect(() => {
    if (sceneRef.current) {
      try { setupWeatherLighting(sceneRef.current, weatherMode); } catch (e) { /* ignore */ }
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
    const modelKey = product?.fbx_urls?.[0] ?? product?.fbx_url ?? null;
    // show placeholder if no model key
    if (!modelKey) {
      return (
        <View style={styles.fbxModalContent}>
          <Text style={{ color: '#666' }}>No 3D model available for this product.</Text>
        </View>
      );
    }

    return (
      <View style={styles.fbxModalContent} {...panResponder.panHandlers}>
        <GLView
          style={{ flex: 1, width: '100%', height: 320 }}
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
              if (!rendererRef.current) {
                rendererRef.current = new THREE.WebGLRenderer({ context: gl as any, antialias: false });
                rendererRef.current.setPixelRatio(1);
                rendererRef.current.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
                rendererRef.current.shadowMap.enabled = false;
                rendererRef.current.setClearColor(0xf2f2f2);
              }

              const scene = sceneRef.current!;
              const camera = cameraRef.current!;
              const renderer = rendererRef.current!;

              // Apply current weather lighting
              setupWeatherLighting(scene, weatherMode);

              // Clear previous children before adding model
              scene.clear();

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
      if (rainRef.current) {
        const geom = rainRef.current.geometry as THREE.BufferGeometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let i = 0; i < arr.length / 3; i++) {
          let y = arr[i * 3 + 1];
          y -= 0.18 + Math.random() * 0.08; // fall speed variation
          if (y < -1.5) y = Math.random() * 6 + 2;
          arr[i * 3 + 1] = y;
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
        Alert.alert('Not signed in', 'Please sign in to add to cart.');
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
          <Image
            source={
              product?.images?.length > 0
                ? { uri: product.images[0] }
                : require('@/assets/images/placeholder.png')
            }
            style={styles.productImage}
            resizeMode="cover"
          />

          {/* 3D Viewer Button + badges row */}
          <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity
              style={styles.open3DButton}
              onPress={() => setViewerVisible(true)}
            >
              <Ionicons name="cube-outline" size={20} color="#fff" />
              <Text
                style={{ color: '#fff', marginLeft: 8, fontWeight: '700' }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                3D View{modelsCount > 0 ? ` (${modelsCount})` : ''}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, flexShrink: 1 }}>
              {/* Stock badge */}
              <View style={styles.stockBadgeRow}>
                <Text style={styles.stockTextSmall}>{product?.stock ?? 0} in stock</Text>
              </View>

              {/* Models available badge */}
              {modelsCount > 0 && (
                <View style={styles.modelsBadge}>
                  <Text style={styles.modelsBadgeText} numberOfLines={1} ellipsizeMode="tail">
                    {modelsCount} 3D Models Available
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.productName}>{product?.name || 'Product Name'}</Text>
          <Text style={styles.productSku}>{product?.sku ?? product?.id ?? 'N/A'}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₱{product?.price ?? 0}</Text>
            <View style={styles.stockBadge}>
              <Text style={styles.stockText}>Stock: {product?.stock ?? 0}</Text>
            </View>
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
          <View style={styles.fbxModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>3D Model Viewer</Text>
              <TouchableOpacity onPress={() => setViewerVisible(false)}>
                <Ionicons name="close" size={28} color="#a81d1d" />
              </TouchableOpacity>
            </View>

             {renderFBXViewer()}
          </View>
        </View>
      </Modal>

      {/* Modern Bottom Navbar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('../homepage')}>
          <Image source={require('@/assets/images/home.png')} style={styles.navIcon} resizeMode="contain" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
          <Image source={require('@/assets/images/inquire.png')} style={styles.navIcon} resizeMode="contain" />
          <Text style={styles.navLabel}>Inquire</Text>
        </TouchableOpacity>
        <View style={styles.fabWrapper}>
          <TouchableOpacity style={styles.fabButton} onPress={() => router.push('../shop')}>
            <Image source={require('@/assets/images/catalogbutton.png')} style={styles.fabIcon} resizeMode="contain" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
          <Image source={require('@/assets/images/service.png')} style={styles.navIcon} resizeMode="contain" />
          <Text style={styles.navLabel}>Service</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
          <Image source={require('@/assets/images/settings.png')} style={styles.navIcon} resizeMode="contain" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
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
    height: 280,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#eee',
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stockTextSmall: { color: '#0b9f34', fontWeight: '700' },

  modelsBadge: {
    backgroundColor: '#eef6ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  modelsBadgeText: { color: '#2b6cb0', fontWeight: '700' },

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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fbxModalBox: {
    width: width * 0.95,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    elevation: 6,
    maxHeight: 420,
  },
  fbxModalContent: {
    width: '100%',
    height: 320,
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#a81d1d',
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
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 100,
  },
  weatherQuickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flex: 1,
    marginHorizontal: 4,
  },
  weatherQuickActive: {
    backgroundColor: '#a81d1d',
  },
  weatherQuickText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 6,
  },
});