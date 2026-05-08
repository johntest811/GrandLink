import '../../utils/polyfills';
// Force reload
import React, { useEffect, useState, useRef } from 'react';
import { Asset } from 'expo-asset';
import { View, Text, Image as RNImage, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, Modal, Platform, Switch, PanResponder, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';
import { SimpleHtmlParser } from '@/components/SimpleHtmlParser';

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
import BottomNavBar from '@/components/BottomNav';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Performance configuration for mobile optimization
const PERFORMANCE_MODE = false; // Enable performance optimizations
const MAX_TEXTURE_SIZE = 512; // Limit texture size for mobile
const DISABLE_COMPLEX_EFFECTS = true; // Disable heavy visual effects

type ProductReview = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function ProductViewScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const modal = useModal();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsSubmitting, setReviewsSubmitting] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [canReviewLoading, setCanReviewLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [myReviewId, setMyReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [modelError, setModelError] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Cache for preventing redundant operations
  const lastWeatherModeRef = useRef<string>('');
  const lastActiveColorRef = useRef<string>('');
  const colorChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Weather state - simplified for performance
  const [weatherMode, setWeatherMode] = useState<'sunny' | 'rainy' | 'foggy' | 'night'>('sunny');

  // Measurements State - derived from 3D model
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [modelDimensions, setModelDimensions] = useState<{ width: number, height: number, depth: number, area: number } | null>(null);
  const [measurementLabels, setMeasurementLabels] = useState<Array<{ text: string, x: number, y: number }>>([]);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const showMeasurementsRef = useRef(false);
  const viewerVisibleRef = useRef(false);
  const modelScaleRef = useRef<number>(1);
  const rawDimensionsRef = useRef<{ width: number, height: number, thickness: number } | null>(null);

  // Custom Skybox & Color State (Supabase)
  const [skyboxData, setSkyboxData] = useState<Record<string, string> | null>(null);
  const skyboxDataRef = useRef<Record<string, string> | null>(null);
  // Active skybox URL for the current weather – drives the native RNImage layer
  const [activeSkyboxUrl, setActiveSkyboxUrl] = useState<string | null>(null);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [activeColor, setActiveColor] = useState<string>('#ORIGINAL');
  const [colorPickerModalVisible, setColorPickerModalVisible] = useState(false); // Modal for color picker
  const activeColorRef = useRef<string>('#ORIGINAL');
  const colorPickerVisibleRef = useRef(false);

  // Wishlist state
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState<string | null>(null);

  // Cart quantity state
  const [cartQuantity, setCartQuantity] = useState(1);
  const [cartQuantityInput, setCartQuantityInput] = useState('1');

  useEffect(() => {
    setCartQuantityInput(String(cartQuantity));
  }, [cartQuantity]);

  const onCartQuantityInputChange = (value: string) => {
    const numericOnly = value.replace(/[^0-9]/g, '');
    setCartQuantityInput(numericOnly);

    if (numericOnly) {
      const parsed = parseInt(numericOnly, 10);
      if (Number.isFinite(parsed)) {
        const maxByStock = Math.max(1, Number(product?.stock ?? 0) || 1);
        setCartQuantity(Math.min(maxByStock, Math.max(1, parsed)));
      }
    }
  };

  const commitCartQuantityInput = () => {
    if (!cartQuantityInput) {
      setCartQuantity(1);
      setCartQuantityInput('1');
      return;
    }

    const parsed = parseInt(cartQuantityInput, 10);
    const maxByStock = Math.max(1, Number(product?.stock ?? 0) || 1);
    const nextQty = Number.isFinite(parsed) ? Math.min(maxByStock, Math.max(1, parsed)) : 1;
    setCartQuantity(nextQty);
    setCartQuantityInput(String(nextQty));
  };

  const getNormalizedCartQuantity = (): number => {
    const parsed = parseInt(String(cartQuantityInput || ''), 10);
    const maxByStock = Math.max(1, Number(product?.stock ?? 0) || 1);
    const nextQty = Number.isFinite(parsed) ? Math.min(maxByStock, Math.max(1, parsed)) : 1;
    setCartQuantity(nextQty);
    setCartQuantityInput(String(nextQty));
    return nextQty;
  };

  useEffect(() => {
    colorPickerVisibleRef.current = colorPickerModalVisible;
  }, [colorPickerModalVisible]);

  useEffect(() => {
    skyboxDataRef.current = skyboxData;

    // Skip texture disposal in performance mode for faster changes
    if (!PERFORMANCE_MODE) {
      skyboxTextureCache.current.forEach((tex) => {
        try { tex.dispose(); } catch { }
      });
      skyboxTextureCache.current.clear();
      envMapCache.current.clear();
    }
  }, [skyboxData]);

  // Keep refs in sync for the animation loop
  useEffect(() => {
    showMeasurementsRef.current = showMeasurements;
  }, [showMeasurements]);

  useEffect(() => {
    viewerVisibleRef.current = viewerVisible;
  }, [viewerVisible]);

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

  // Cancellation token: incremented each time a new skybox load starts.
  // Each async load captures its token and bails if superseded.
  const skyboxLoadIdRef = useRef<number>(0);

  // Store the expo-gl context for WebGL operations and texture management
  const glRef = useRef<any>(null);

  // Create realistic rain streaks
  const createRain = (scene: THREE.Scene) => {
    if (rainRef.current) {
      return;
    }
    const count = 800; // More particles for denser rain  
    const positions = new Float32Array(count * 6); // LineSegments: 2 points per line = 6 values (x1,y1,z1,x2,y2,z2)
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Position rain across large area for full coverage
      const x = (Math.random() - 0.5) * 800;
      const y = Math.random() * 800 - 200; // Range from -200 to +600 for full vertical coverage
      const z = (Math.random() - 0.5) * 800;

      // Each raindrop is a vertical line segment (streak) - make them LONGER and more visible
      const streakLength = 12.0 + Math.random() * 18.0; // Much longer streaks (12-30 units)
      positions[i * 6 + 0] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y - streakLength;
      positions[i * 6 + 5] = z;

      velocities[i] = 4.0 + Math.random() * 12.0; // Fast falling speeds
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // LineBasicMaterial with enhanced visibility
    const mat = new THREE.LineBasicMaterial({
      color: 0x66aaff, // Brighter blue color for better visibility
      transparent: true,
      opacity: 0.75, // Increased opacity for better visibility
      linewidth: 3, // Increase linewidth (may be ignored on mobile but worth trying)
      depthTest: false,
      depthWrite: false
    });

    const lines = new THREE.LineSegments(geom, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 999;
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

  // Load global default skyboxes from storage
  const loadGlobalSkyboxDefaults = async (): Promise<Record<string, string> | null> => {
    console.log('[GLOBAL-SKYBOX] Starting load...');
    try {
      const weathers = ['sunny', 'rainy', 'foggy', 'night'] as const;
      const result: Record<string, string> = {};

      // List all files in skyboxes/defaults (flat structure, not subfolders)
      const { data: allFiles, error } = await supabase.storage
        .from('products')
        .list('skyboxes/defaults', {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });

      if (error) {
        console.error('[GLOBAL-SKYBOX] Error listing defaults folder:', error);
        return null;
      }

      if (!allFiles || allFiles.length === 0) {
        console.log('[GLOBAL-SKYBOX] No files found in skyboxes/defaults');
        return null;
      }

      console.log(`[GLOBAL-SKYBOX] Found ${allFiles.length} total files in defaults folder`);

      // Group files by weather type and find most recent for each
      for (const weather of weathers) {
        try {
          // Filter files that start with this weather type (e.g., sunny_...)
          const weatherFiles = allFiles.filter((file: any) => 
            file.name && file.name.startsWith(`${weather}_`)
          );

          console.log(`[GLOBAL-SKYBOX] Found ${weatherFiles.length} files for ${weather}`);

          if (weatherFiles.length === 0) {
            continue;
          }

          // Extract timestamp from filename and find most recent
          // Format: weather_TIMESTAMP_description.jpg
          let mostRecentFile = weatherFiles[0];
          let maxTimestamp = 0;

          for (const file of weatherFiles) {
            // Extract timestamp from filename (e.g., sunny_1774549078548_name.jpg)
            const match = file.name.match(/_(\d+)_/);
            if (match) {
              const timestamp = parseInt(match[1], 10);
              console.log(`[GLOBAL-SKYBOX] ${file.name} -> timestamp ${timestamp}`);
              if (timestamp > maxTimestamp) {
                maxTimestamp = timestamp;
                mostRecentFile = file;
              }
            }
          }

          if (mostRecentFile) {
            // Build public URL for the file
            const { data } = supabase.storage
              .from('products')
              .getPublicUrl(`skyboxes/defaults/${mostRecentFile.name}`);
            
            if (data?.publicUrl) {
              result[weather] = data.publicUrl;
              console.log(`[GLOBAL-SKYBOX] ✅ ${weather}:`, mostRecentFile.name);
            }
          }
        } catch (weatherErr) {
          console.error(`[GLOBAL-SKYBOX] Error loading ${weather}:`, weatherErr);
        }
      }

      console.log(`[GLOBAL-SKYBOX] Loaded ${Object.keys(result).length} weather types`);
      return Object.keys(result).length > 0 ? result : null;
    } catch (err) {
      console.error('[GLOBAL-SKYBOX] Fatal error:', err);
      return null;
    }
  };

  // SKYBOX: Load texture from URL and apply as background sphere
  const loadAndApplySkybox = async (weatherType: 'sunny' | 'rainy' | 'foggy' | 'night', skyUrl?: string | null): Promise<void> => {
    // Increment the token so any previous in-flight load knows it is stale.
    skyboxLoadIdRef.current += 1;
    const myToken = skyboxLoadIdRef.current;

    // Use provided URL or get from skyboxDataRef
    let urlToLoad = skyUrl || skyboxDataRef.current?.[weatherType]?.trim();

    console.log(`[SKYBOX] === START load for ${weatherType} ===`);
    console.log(`[SKYBOX] URL provided: ${skyUrl?.substring(0, 80) || 'none'}...`);
    console.log(`[SKYBOX] URL from state: ${skyboxDataRef.current?.[weatherType]?.substring(0, 80) || 'none'}...`);
    console.log(`[SKYBOX] Final URL to load: ${urlToLoad?.substring(0, 80) || 'none'}...`);

    // Remove any existing skybox immediately (synchronous) so the old weather's
    // background is gone right away, regardless of whether we load a new one.
    removeSkybox();

    if (!urlToLoad) {
      console.log(`[SKYBOX] ⚠️  No URL for ${weatherType} - using color fallback`);
      // No texture configured for this weather – use a solid clear colour.
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
      // Step 1: Download image file to local filesystem
      console.log(`[SKYBOX] Downloading asset...`);
      const asset = Asset.fromURI(urlToLoad);
      await asset.downloadAsync();
      console.log(`[SKYBOX] ✅ Downloaded to: ${asset.localUri?.substring(0, 80)}...`);

      // ── Stale-load guard: bail if a newer weather switch happened ──
      if (skyboxLoadIdRef.current !== myToken) {
        console.log(`[SKYBOX] ⚠️  Load is stale, bailing`);
        return;
      }

      if (!asset.localUri) {
        throw new Error('Asset download failed - no localUri');
      }

      // Step 2: Create a native WebGL texture directly via expo-gl
      console.log(`[SKYBOX] Creating WebGL texture...`);
      const gl = glRef.current;
      const nativeTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, nativeTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
        { localUri: asset.localUri } as any
      );
      gl.bindTexture(gl.TEXTURE_2D, null);

      // ── Stale-load guard (after GPU upload) ──
      if (skyboxLoadIdRef.current !== myToken) {
        // Texture uploaded but we no longer need it – delete from GPU.
        try { gl.deleteTexture(nativeTexture); } catch { }
        return;
      }

      // Step 3: Wrap in THREE.Texture and link to the GPU texture
      const texture = new THREE.Texture();
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.flipY = false;

      const renderer = rendererRef.current;
      const textureProperties = renderer.properties.get(texture);
      textureProperties.__webglTexture = nativeTexture;
      textureProperties.__webglInit = true;

      // Step 4: Build skybox sphere and add to scene
      // Remove whatever may have loaded while we were awaiting (safety net)
      removeSkybox();

      const geometry = new THREE.SphereGeometry(500, 32, 16);
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
      skyboxMesh.scale.set(1, -1, 1); 

      sceneRef.current!.add(skyboxMesh);
      skyboxRef.current = skyboxMesh;

      // Transparent clear so the sphere colour dominates
      renderer.setClearColor(0x000000, 0);
      renderer.setClearAlpha(0);

      if (cameraRef.current) {
        renderer.render(sceneRef.current!, cameraRef.current);
      }

      console.log(`[SKYBOX] ✅ === DONE: Skybox rendered for ${weatherType} ===`);
    } catch (error) {
      console.error(`Failed to load skybox for ${weatherType}:`, error);
      // Only apply fallback colour if this load is still the authoritative one
      if (skyboxLoadIdRef.current === myToken && rendererRef.current) {
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

  // Enhanced fog effects with better visibility and weather-specific lighting
  const setupFogEffects = (scene: THREE.Scene, weatherType: 'sunny' | 'rainy' | 'foggy' | 'night') => {
    // Remove existing fog
    scene.fog = null;

    switch (weatherType) {
      case 'foggy':
        scene.fog = new THREE.Fog(0xD6DBE0, 80, 300);
        break;
      case 'rainy':
        scene.fog = null;
        break;
      case 'night':
        scene.fog = new THREE.Fog(0x0B1020, 100, 500);
        break;
      case 'sunny':
      default:
        scene.fog = null;
        break;
    }
  };

  // 3D controls - Orbit (Start Front View ~90 deg)
  const [rotation, setRotation] = useState({ x: Math.PI / 2, y: 0 });
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  // Touch gesture 
  const initialRotation = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !colorPickerVisibleRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (colorPickerVisibleRef.current) return false;
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (evt) => {
        initialRotation.current = { ...rotationRef.current };
      },
      onPanResponderMove: (evt, gestureState) => {
        if (colorPickerVisibleRef.current) return;
        const sensitivity = 0.010; 
        const deltaX = -gestureState.dx * sensitivity; 
        const deltaY = -gestureState.dy * sensitivity; 

        const newRotation = {
          x: Math.max(0.1, Math.min(Math.PI - 0.1, initialRotation.current.x + deltaY)), 
          y: initialRotation.current.y + deltaX 
        };

        setRotation(newRotation);
      },
      onPanResponderTerminationRequest: () => colorPickerVisibleRef.current, 
      onPanResponderRelease: () => {
      },
      onPanResponderTerminate: () => {
      },
    })
  ).current;

  const [cameraDistance, setCameraDistance] = useState(5.0);
  const cameraDistanceRef = useRef(cameraDistance);
  useEffect(() => { cameraDistanceRef.current = cameraDistance; }, [cameraDistance]);

  const defaultDistanceRef = useRef(5.0);

  const resetViewerTransform = () => {
    setRotation({ x: Math.PI / 2, y: 0 });
    setCameraDistance(defaultDistanceRef.current);
  };
  
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

  // Load wishlist status for the product
  const loadWishlistStatus = async (productId: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        setIsInWishlist(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_items')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('item_type', 'my-list')
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsInWishlist(true);
        setWishlistItemId(data.id);
      } else {
        setIsInWishlist(false);
        setWishlistItemId(null);
      }
    } catch (e: any) {
      console.error('Failed to load wishlist status', e);
      setIsInWishlist(false);
      setWishlistItemId(null);
    }
  };

  const loadProductReviews = async (productId: string) => {
    try {
      setReviewsLoading(true);
      setCanReviewLoading(true);
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, product_id, user_id, rating, comment, created_at, updated_at')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const allReviews = (data || []) as ProductReview[];
      setReviews(allReviews);

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!userId) {
        setCanReview(false);
        setMyReviewId(null);
        setReviewRating(0);
        setReviewComment('');
        return;
      }

      const { data: completedOrder, error: completedErr } = await supabase
        .from('user_items')
        .select('id')
        .eq('user_id', userId)
        .eq('item_type', 'order')
        .eq('product_id', productId)
        .or('status.eq.completed,order_status.eq.completed,order_status.eq.delivered')
        .limit(1)
        .maybeSingle();

      if (completedErr) throw completedErr;

      setCanReview(Boolean(completedOrder));

      const myReview = allReviews.find((review) => review.user_id === userId) || null;
      if (myReview) {
        setMyReviewId(myReview.id);
        setReviewRating(Number(myReview.rating) || 0);
        setReviewComment(String(myReview.comment || ''));
      } else {
        setMyReviewId(null);
        setReviewRating(0);
        setReviewComment('');
      }
    } catch (e) {
      console.error('Failed to load product reviews', e);
      setReviews([]);
      setCanReview(false);
      setMyReviewId(null);
    } finally {
      setReviewsLoading(false);
      setCanReviewLoading(false);
    }
  };

  const submitProductReview = async () => {
    try {
      if (!product?.id) {
        modal.showError('Error', 'Product data is not ready yet.');
        return;
      }

      if (!canReview) {
        modal.showInfo('Not Allowed', 'Only users who have completed this product can leave a review.');
        return;
      }

      if (!reviewRating || reviewRating < 1) {
        modal.showWarning('Missing Rating', 'Please select a rating before submitting your review.');
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        modal.showInfo('Login Required', 'Please sign in to submit a review.');
        return;
      }

      setReviewsSubmitting(true);

      const nowIso = new Date().toISOString();
      const payload = {
        product_id: product.id,
        user_id: userId,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
        updated_at: nowIso,
      } as Record<string, any>;

      let resultError: any = null;

      if (myReviewId) {
        const { error } = await supabase
          .from('product_reviews')
          .update(payload)
          .eq('id', myReviewId)
          .eq('user_id', userId)
          .eq('product_id', product.id);
        resultError = error;
      } else {
        const { error } = await supabase
          .from('product_reviews')
          .insert([{ ...payload, created_at: nowIso }]);
        resultError = error;
      }

      if (resultError) throw resultError;

      modal.showSuccess(
        'Review Saved',
        myReviewId ? 'Your review has been updated.' : 'Your review has been submitted.'
      );

      await loadProductReviews(String(product.id));
    } catch (e: any) {
      console.error('Failed to submit review', e);
      modal.showError('Error', `Failed to submit review. ${e?.message || 'Please try again.'}`);
    } finally {
      setReviewsSubmitting(false);
    }
  };

  // Toggle wishlist - add or remove product
  const toggleWishlist = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const productId = product?.id;
      if (!userId) {
        modal.showInfo(
          'Login Required',
          'Please login or create an account to add items to your wishlist.'
        );
        return;
      }

      if (!productId) {
        modal.showError('Error', 'Cannot update wishlist because product data is incomplete.');
        return;
      }

      if (isInWishlist && wishlistItemId) {
        // Remove from wishlist
        const { error } = await supabase
          .from('user_items')
          .delete()
          .eq('id', wishlistItemId);

        if (error) throw error;

        setIsInWishlist(false);
        setWishlistItemId(null);
        modal.showSuccess('Removed', `${product?.name} has been removed from your wishlist.`);
      } else {
        // Add to wishlist
        const now = new Date().toISOString();
        const payload = {
          user_id: userId,
          product_id: productId,
          item_type: 'my-list',
          status: 'active',
          created_at: now,
          updated_at: now
        };

        const { data, error } = await supabase.from('user_items').insert([payload]).select('id').single();

        if (error) throw error;

        if (data) {
          setIsInWishlist(true);
          setWishlistItemId(data.id);
        }
        modal.showSuccess('Added', `${product?.name} has been added to your wishlist.`);
      }
    } catch (e: any) {
      console.error('Toggle wishlist failed', e);
      if (e?.code === '23514' && e?.message?.includes('user_items_item_type_check')) {
        modal.showError(
          'Wishlist Setup Required',
          'Database constraint does not allow my-list items. Run the wishlist item_type migration and try again.'
        );
        return;
      }
      const msg = e?.message ?? JSON.stringify(e);
      modal.showError('Error', `Failed to update wishlist.\n${msg}`);
    }
  };

  const reconcileUndeductedPaidStockForProduct = async (productId: string): Promise<number | null> => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId || !productId) return null;

      const { data: orderRows, error: orderErr } = await supabase
        .from('user_items')
        .select('id, quantity, payment_status, meta')
        .eq('user_id', userId)
        .eq('item_type', 'order')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (orderErr) {
        console.warn('[PRODUCT-STOCK-RECON] Failed to read order rows:', orderErr);
        return null;
      }

      const rowsToDeduct = (orderRows || []).filter((row: any) => {
        const qty = Number(row?.quantity || 0);
        const alreadyDeducted = Boolean(row?.meta?.stock_deducted);
        const paymentStatus = String(row?.payment_status || '').toLowerCase();
        const isPaidOrder = paymentStatus.includes('paid') || paymentStatus.includes('complete');
        return qty > 0 && !alreadyDeducted && isPaidOrder;
      });

      if (rowsToDeduct.length === 0) return null;

      const qtyToDeduct = rowsToDeduct.reduce((sum: number, row: any) => sum + Number(row?.quantity || 0), 0);
      if (qtyToDeduct <= 0) return null;

      const { data: productRow, error: productErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productErr || !productRow) {
        console.warn('[PRODUCT-STOCK-RECON] Failed to read product row:', productErr);
        return null;
      }

      const hasStockColumn = Object.prototype.hasOwnProperty.call(productRow, 'stock');
      const hasInventoryColumn = Object.prototype.hasOwnProperty.call(productRow, 'inventory');
      if (!hasStockColumn && !hasInventoryColumn) return null;

      const currentInventory = Number(productRow?.inventory);
      const currentStock = Number(productRow?.stock);
      const rawStock = Number.isFinite(currentInventory)
        ? currentInventory
        : (Number.isFinite(currentStock) ? currentStock : 0);

      const nextStock = Math.max(0, rawStock - qtyToDeduct);
      const nowIso = new Date().toISOString();
      const updatePayload: Record<string, any> = { updated_at: nowIso };
      if (hasStockColumn) updatePayload.stock = nextStock;
      if (hasInventoryColumn) updatePayload.inventory = nextStock;
      if (Object.prototype.hasOwnProperty.call(productRow, 'last_stock_update')) {
        updatePayload.last_stock_update = nowIso;
      }

      const { error: updateErr } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', productId);

      if (updateErr) {
        console.warn('[PRODUCT-STOCK-RECON] Failed to update product stock:', updateErr);
        return null;
      }

      for (const row of rowsToDeduct) {
        const mergedMeta = {
          ...(row?.meta || {}),
          stock_deducted: true,
          stock_deducted_at: nowIso,
        };

        const { error: markErr } = await supabase
          .from('user_items')
          .update({
            meta: mergedMeta,
            updated_at: nowIso,
          })
          .eq('id', row.id);

        if (markErr) {
          console.warn('[PRODUCT-STOCK-RECON] Failed to mark row as deducted:', row.id, markErr);
        }
      }

      console.log('[PRODUCT-STOCK-RECON] Reconciled stock for product', productId, 'by', qtyToDeduct, 'units.');
      return nextStock;
    } catch (err) {
      console.warn('[PRODUCT-STOCK-RECON] Unexpected error:', err);
      return null;
    }
  };

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

        const normalizeProduct = (raw: any) => {
          const model_raw = raw?.glb_url ?? raw?.glb_urls ?? raw?.model_url ?? raw?.model_urls ?? raw?.fbx_url ?? raw?.fbx_urls ?? '';
          let glb_urls: string[] = [];

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

          glb_urls = glb_urls.filter(url => url && url.length > 5);

          const images: string[] = [];
          if (raw?.image1) images.push(raw.image1);
          if (raw?.image2) images.push(raw.image2);
          if (raw?.images && Array.isArray(raw.images)) images.push(...raw.images.filter(Boolean));


          // collect any plausible features/specs field names
          const featuresRaw =
            raw?.additional_features ??
            raw?.additionalfeatures ??
            raw?.features ??
            raw?.specifications ??
            raw?.specs ??
            raw?.attributes ??
            raw?.feature_list ??
            '';

          const normalizeFeatures = (input: any): { list: string[]; text: string } => {
            if (!input && typeof input !== 'number') return { list: [], text: '' };

            if (Array.isArray(input)) {
              const arr = input.map((v: any) => String(v).trim()).filter(Boolean);
              return { list: arr, text: arr.join('\n') };
            }

            if (typeof input === 'object') {
              const entries = Object.entries(input).map(([k, v]) => `${k}: ${v}`);
              return { list: entries, text: entries.join('\n') };
            }

            let s = String(input).trim();
            if (!s) return { list: [], text: '' };

            // Check if HTML contains ul/li elements - extract each list item
            if (s.includes('<ul') || s.includes('<li')) {
              const listItems = s.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
              if (listItems.length > 0) {
                const arr = listItems.map(item => {
                  // Remove <li> tags and keep inner HTML (like <p> tags for formatting)
                  return item.replace(/<\/?li[^>]*>/gi, '').trim();
                }).filter(Boolean);
                return { list: arr, text: arr.join('\n') };
              }
            }

            if (s.startsWith('[')) {
              try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) {
                  const arr = parsed.map((v: any) => String(v).trim()).filter(Boolean);
                  return { list: arr, text: arr.join('\n') };
                }
              } catch {
              }
            }

            const parts = s.split(/\r?\n|;|,/).map(p => p.trim()).filter(Boolean);
            return { list: parts, text: parts.join('\n') };
          };

          const { list: additional_features_array, text: additional_features_text } = normalizeFeatures(featuresRaw);

          return {
            id: raw?.id,
            name: raw?.name ?? raw?.title ?? 'Untitled',
            fullproductname: raw?.fullproductname ?? raw?.name ?? raw?.title ?? 'Untitled',
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
            skyboxes: raw?.skyboxes ?? null, 
            colors: raw?.colors ?? raw?.available_colors ?? [], 
            raw,
          };
        };

        const normalized = normalizeProduct(data);

        setProduct(normalized);

        const reconciledStock = await reconcileUndeductedPaidStockForProduct(String(normalized.id || ''));
        if (typeof reconciledStock === 'number') {
          setProduct((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              stock: reconciledStock,
            };
          });
        }
        
        // CRITICAL: Verify this code executes
        console.warn('[!!!] PRODUCT NORMALIZED - ID:', normalized.id, 'HAS SKYBOXES:', !!normalized.skyboxes);
        
        console.log('[PRODUCT-FETCH] About to setup skyboxes...');
        // Set skybox and color data - use product custom or fallback to global defaults
        const setupSkyboxes = async () => {
          console.log('[SKYBOX-LOAD] 🚀 setupSkyboxes started');
          let skyboxUrls: Record<string, string> | null = null;

          // Try product-specific skyboxes first
          if (normalized.skyboxes) {
            console.log('[SKYBOX-LOAD] Product has custom skyboxes, using those');
            let skyboxData = normalized.skyboxes;
            console.log('[SKYBOX-LOAD] Raw skyboxData:', JSON.stringify(skyboxData));
            
            if (typeof skyboxData === 'string') {
              try {
                skyboxData = JSON.parse(skyboxData);
                console.log('[SKYBOX-LOAD] Parsed JSON skyboxData:', JSON.stringify(skyboxData));
              } catch (e) {
                console.error('[SKYBOX-LOAD] JSON parse error:', e);
                skyboxData = null;
              }
            }

            if (skyboxData && typeof skyboxData === 'object') {
              // Filter out null values
              const entries = Object.entries(skyboxData);
              console.log('[SKYBOX-LOAD] Entries before filter:', entries);
              const skyboxUrls = Object.fromEntries(
                entries.filter(([_, url]) => url !== null)
              ) as Record<string, string>;
              console.log('[SKYBOX-LOAD] Entries after filter:', Object.fromEntries(entries.filter(([_, url]) => url !== null)));
              console.log('[SKYBOX-LOAD] Filtered product skyboxes:', Object.keys(skyboxUrls).join(', '));
            }
          }

          // Fallback to global defaults if no product skyboxes
          if (!skyboxUrls) {
            console.log('[SKYBOX-LOAD] No product skyboxes, loading global defaults...');
            try {
              skyboxUrls = await loadGlobalSkyboxDefaults();
              if (skyboxUrls) {
                console.log('[SKYBOX-LOAD] ✅ Loaded global defaults:', Object.keys(skyboxUrls).join(', '));
              } else {
                console.log('[SKYBOX-LOAD] ⚠️  No global defaults available either');
              }
            } catch (err) {
              console.error('[SKYBOX-LOAD] Error loading global defaults:', err);
            }
          }

          // Set state and apply
          if (skyboxUrls && Object.keys(skyboxUrls).length > 0) {
            console.log('[SKYBOX-LOAD] Setting skybox state with URLs:', Object.keys(skyboxUrls));
            setSkyboxData(skyboxUrls);
            skyboxDataRef.current = skyboxUrls;

            // Auto-apply sunny weather
            setTimeout(() => {
              const sunnyUrl = skyboxUrls!.sunny;
              console.log('[SKYBOX-LOAD] Auto-apply check - sunny URL:', sunnyUrl?.substring(0, 60));
              if (sunnyUrl) {
                console.log('[SKYBOX-LOAD] ✅ Auto-applying sunny');
                loadAndApplySkybox('sunny', sunnyUrl).catch(err => 
                  console.error('[SKYBOX-LOAD] Auto-load failed:', err)
                );
              }
            }, 500);
          } else {
            console.log('[SKYBOX-LOAD] ℹ️  No skyboxes available (custom or global)');
            setSkyboxData(null);
          }
        };

        setupSkyboxes().catch(err => {
          console.error('[SKYBOX-LOAD] setupSkyboxes error:', err);
        });


        if (normalized.colors && Array.isArray(normalized.colors) && normalized.colors.length > 0) {
          console.log('Setting product colors:', normalized.colors);
          const colors = normalized.colors.map((c: any) => typeof c === 'string' ? c : c.hex || c.color).filter(Boolean);
          setProductColors(colors);
          setActiveColor(colors[0]); // Set first color as default
        } else {
          console.log('No colors found in product data, using frame colors');
          const frameColors = [
            '#1a1a1a',   // Matte Black
            '#6b6b6b',   // Matte Gray
            '#8B4513',   // Narra 
            '#5C4033',   // Walnut 
          ];
          setProductColors(frameColors);
          setActiveColor('#ORIGINAL');
        }

        setSelectedModelIndex(0);

        // Load wishlist status for this product
        await loadWishlistStatus(normalized.id);
        await loadProductReviews(normalized.id);

        setLoading(false);

        if (normalized.glb_urls && normalized.glb_urls.length > 0) {
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

    // Skybox Cleanup
    return () => {
      removeSkybox();
      skyboxTextureCache.current.forEach((tex) => {
        try { tex.dispose(); } catch { }
      });
      skyboxTextureCache.current.clear();
      if (rendererRef.current) rendererRef.current.dispose();
      if (sceneRef.current) sceneRef.current.clear();
    };
  }, [id]);

  const loadSupabaseGLBModel = async (glbUrl: string, productId: string): Promise<THREE.Object3D> => {
    return new Promise((resolve, reject) => {
      try {
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

            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log('Raw Model Center:', center);
            console.log('Raw Model Size:', size);

            model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                if (child.material) {
                  const materials = Array.isArray(child.material) ? child.material : [child.material];
                  materials.forEach((mat: any) => {
                    if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                      mat.envMapIntensity = 2.0;

                      if (mat.roughness !== undefined) {
                        mat.roughness = Math.max(0.05, mat.roughness);
                      }

                      mat.needsUpdate = true;
                    }
                  });
                }
                if ((child as THREE.Mesh).material) {
                  ((child as THREE.Mesh).material as any).userData = { ...((child as THREE.Mesh).material as any).userData, isGLB: true };
                }
              }
            });
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



  const loadGLBModel = async (modelUrl: string, productId: string): Promise<THREE.Object3D> => {
    // Validate input
    if (!modelUrl || typeof modelUrl !== 'string' || modelUrl.trim() === '') {
      throw new Error('Invalid GLB model URL provided');
    }

    return await loadSupabaseGLBModel(modelUrl, productId);
  };


  // Simple fallback model
  const createFallbackModel = (productData?: any) => {
    const group = new THREE.Group();

    const geometry = new THREE.BoxGeometry(2, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xff4444, 
      metalness: 0.3,
      roughness: 0.7
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    group.add(mesh);

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
      const model3D = await loadGLBModel(modelUrl, productData?.id || 'unknown');
      modelCache.current.set(modelUrl, model3D);
    } catch (error) {
      console.warn('GLB loading failed, using fallback:', error);
      const fallbackModel = createFallbackModel();
      modelCache.current.set(modelUrl, fallbackModel);
    }
  };

  // Enhanced glass material with environment mapping
  const createGlassMaterial = (envMap?: THREE.Texture | null): THREE.Material => {
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
      (mat as any).transmission = 0.98;
      (mat as any).ior = 1.52;
      (mat as any).thickness = 0.1;
      (mat as any).attenuationDistance = 0.5;
      (mat as any).attenuationColor = new THREE.Color(0xffffff);
    } catch (e) {
    }

    return mat as unknown as THREE.Material;
  };

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
    object.traverse((child: THREE.Object3D) => {
      if ((child as any).isMesh) {
        const mesh = child as unknown as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  };

  // Initialize persistent lights once
  const initializeLights = (scene: THREE.Scene) => {
    if (!ambientLightRef.current) {
      ambientLightRef.current = new THREE.AmbientLight(0xffffff, 1.0);
    }
    if (ambientLightRef.current.parent !== scene) {
      scene.add(ambientLightRef.current);
    }

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
      const planeGeometry = new THREE.PlaneGeometry(100, 100); 
      const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
      groundPlaneRef.current = new THREE.Mesh(planeGeometry, planeMaterial);
      groundPlaneRef.current.rotation.x = -Math.PI / 2; 
      groundPlaneRef.current.position.y = -6; 
      groundPlaneRef.current.receiveShadow = true;
      scene.add(groundPlaneRef.current);
      console.log('Shadow-receiving ground plane added (will auto-position per model)');
    }

    // Ensure directional light is in the scene
    if (!directionalLightRef.current) {
      directionalLightRef.current = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLightRef.current.position.set(5, 10, 5);
      directionalLightRef.current.lookAt(0, 0, 0);
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

  const activeSkyboxUrlRef = useRef<string | null>(null);



  // Create a visible Sun mesh
  const createSun = (scene: THREE.Scene) => {
    if (sunMeshRef.current) return;

    const geometry = new THREE.SphereGeometry(1.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.9,
    });
    const sun = new THREE.Mesh(geometry, material);

    sun.position.set(100, 150, 50); 
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

  const originalColorsRef = useRef<Map<string, THREE.Color>>(new Map());
  const cachedMeshesRef = useRef<Array<{ mesh: any, originalColor: THREE.Color }>>([]);

  const applyModelColorDebounced = (model: THREE.Object3D, colorHex: string) => {
    lastActiveColorRef.current = colorHex;

    if (!model || !colorHex) return;

    // Build cache on first run
    if (cachedMeshesRef.current.length === 0) {
      model.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (child.name === 'Skybox' || child.name === 'Sun') return;

          const matName = (child.material.name || '').toLowerCase();
          const meshName = (child.name || '').toLowerCase();

          if (matName.includes('glass') || meshName.includes('glass') ||
            matName.includes('window') || meshName.includes('window') ||
            child.material.transparent) {
            return;
          }

          if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
            cachedMeshesRef.current.push({
              mesh: child,
              originalColor: child.material.color.clone()
            });
          }
        }
      });
    }

    // Fast color application using cache
    if (colorHex === '#ORIGINAL') {
      cachedMeshesRef.current.forEach(({ mesh, originalColor }) => {
        if (mesh.material) {
          mesh.material.color.copy(originalColor);
        }
      });
    } else {
      const color = new THREE.Color(colorHex);
      cachedMeshesRef.current.forEach(({ mesh }) => {
        if (mesh.material) {
          mesh.material.color.set(color);
        }
      });
    }
  };

  // Apply color when it changes
  useEffect(() => {
    activeColorRef.current = activeColor;

    // Clear existing timeout
    if (colorChangeTimeoutRef.current) {
      clearTimeout(colorChangeTimeoutRef.current);
    }

    colorChangeTimeoutRef.current = setTimeout(() => {
      if (activeColor && sceneRef.current && currentModelRef.current) {
        applyModelColorDebounced(currentModelRef.current, activeColor);
      }
    }, 50);

    return () => {
      if (colorChangeTimeoutRef.current) {
        clearTimeout(colorChangeTimeoutRef.current);
      }
    };
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

  // Weather Lighting System - always applies to ensure proper lighting
  const setupWeatherLighting = (scene: THREE.Scene, weather: string, gl?: any) => {  
    lastWeatherModeRef.current = weather;

    initializeLights(scene);

    removeSun(scene);

    const weatherColors: Record<string, number> = {
      sunny: 0x87ceeb, rainy: 0xbfd1e5, foggy: 0xd6dbe0, night: 0x0b1020
    };
    if (rendererRef.current) {
      rendererRef.current.setClearColor(weatherColors[weather] || 0x87ceeb, 1);
    }

    setupFogEffects(scene, weather as any);

    // Full lighting configuration based on weather
    switch (weather) {
      case 'sunny':
        createSun(scene);
        ambientLightRef.current!.color.setHex(0xfff5e0);
        ambientLightRef.current!.intensity = 3.5;
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.color.setHex(0xb0d8ff);
          hemisphereLightRef.current.intensity = 1.7;
        }
        directionalLightRef.current!.color.setHex(0xfff1c0);
        directionalLightRef.current!.intensity = 15.6;
        directionalLightRef.current!.position.set(130, 170, 70);
        directionalLightRef.current!.target.position.set(0, 0, 0);
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.color.setHex(0x88bbff);
        pointLight1Ref.current!.intensity = 10.0;
        pointLight1Ref.current!.distance = 600;
        pointLight1Ref.current!.position.set(130, 170, 70);
        pointLight1Ref.current!.castShadow = true;
        removeRain(scene);
        break;

      case 'rainy':
        ambientLightRef.current!.color.setHex(0xe6f3ff);
        ambientLightRef.current!.intensity = 0.8;
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.color.setHex(0xc0d6ed);
          hemisphereLightRef.current.intensity = 1.0;
        }
        directionalLightRef.current!.color.setHex(0xd4e6f1);
        directionalLightRef.current!.intensity = 1.5;
        directionalLightRef.current!.position.set(130, 170, 70);
        directionalLightRef.current!.target.position.set(0, 0, 0);
        directionalLightRef.current!.castShadow = false;
        pointLight1Ref.current!.color.setHex(0x6699cc);
        pointLight1Ref.current!.intensity = 0.8;
        pointLight1Ref.current!.distance = 400;
        pointLight1Ref.current!.position.set(130, 170, 70);
        pointLight1Ref.current!.castShadow = false;
        createRain(scene);
        break;

      case 'foggy':
        ambientLightRef.current!.color.setHex(0xf0f4f8);
        ambientLightRef.current!.intensity = 2.5;
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.color.setHex(0xe8f2f6);
          hemisphereLightRef.current.intensity = 3.0;
        }
        directionalLightRef.current!.color.setHex(0xf4f8fc);
        directionalLightRef.current!.intensity = 4.5;
        directionalLightRef.current!.position.set(130, 170, 70);
        directionalLightRef.current!.target.position.set(0, 0, 0);
        directionalLightRef.current!.castShadow = false;
        pointLight1Ref.current!.color.setHex(0xe6eef7);
        pointLight1Ref.current!.intensity = 2.5;
        pointLight1Ref.current!.distance = 300;
        pointLight1Ref.current!.position.set(130, 170, 70);
        pointLight1Ref.current!.castShadow = false;
        removeRain(scene);
        break;

      case 'night':
        ambientLightRef.current!.color.setHex(0x6b7fb8);  
        ambientLightRef.current!.intensity = 1.2;  
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.color.setHex(0x4a5c8a);  
          hemisphereLightRef.current.intensity = 3; 
        }
        directionalLightRef.current!.color.setHex(0xc4d7f0); 
        directionalLightRef.current!.intensity = 1.0; 
        directionalLightRef.current!.position.set(130, 170, 70);
        directionalLightRef.current!.target.position.set(0, 0, 0);
        directionalLightRef.current!.castShadow = false;
        removeRain(scene);
        break;

      default:
        ambientLightRef.current!.color.setHex(0xffffff);
        ambientLightRef.current!.intensity = 1.0;
        if (hemisphereLightRef.current) {
          hemisphereLightRef.current.intensity = 1.0;
        }
        directionalLightRef.current!.color.setHex(0xffffeb);
        directionalLightRef.current!.intensity = 1.2;
        directionalLightRef.current!.position.set(130, 170, 70);
        directionalLightRef.current!.target.position.set(0, 0, 0);
        directionalLightRef.current!.castShadow = true;
        pointLight1Ref.current!.intensity = 0;
        pointLight1Ref.current!.castShadow = false;
        removeRain(scene);
        break;
    }

    // Enhanced shadow configuration
    if (rendererRef.current) {
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current.shadowMap.autoUpdate = true;

      if (directionalLightRef.current!.castShadow) {
        directionalLightRef.current!.shadow.mapSize.width = 1024;
        directionalLightRef.current!.shadow.mapSize.height = 1024;
        directionalLightRef.current!.shadow.camera.near = 0.5;
        directionalLightRef.current!.shadow.camera.far = 50;
        directionalLightRef.current!.shadow.camera.left = -45;
        directionalLightRef.current!.shadow.camera.right = 45;
        directionalLightRef.current!.shadow.camera.top = 45;
        directionalLightRef.current!.shadow.camera.bottom = -45;
        directionalLightRef.current!.shadow.bias = -0.0001;
        directionalLightRef.current!.shadow.camera.updateProjectionMatrix();
      }
    }

    // Ensure directional light target is added to scene
    if (directionalLightRef.current && directionalLightRef.current.target) {
      if (!scene.children.includes(directionalLightRef.current.target)) {
        scene.add(directionalLightRef.current.target);
      }
      directionalLightRef.current.target.updateMatrixWorld();
    }
  };

  useEffect(() => {
    if (sceneRef.current && rendererRef.current && cameraRef.current) {
      setupWeatherLighting(sceneRef.current, weatherMode);
      sceneRef.current.updateMatrixWorld(true);
      try {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      } catch (e) {
        console.warn('Manual render failed:', e);
      }
    if (glRef.current) {
        const skyUrl = skyboxDataRef.current?.[weatherMode];
        loadAndApplySkybox(weatherMode, skyUrl).catch((e) => console.warn('Weather skybox error:', e));
      }
    }
  }, [weatherMode]);

  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const dimsRef = useRef<{ width: number, height: number, depth: number, area: number, labelPoints: { name: string, vec: THREE.Vector3, val: number }[] } | null>(null);

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
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledSize = new THREE.Vector3();
      scaledBox.getSize(scaledSize);
      const min = scaledBox.min;
      const max = scaledBox.max;
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);

      const pushFactor = 0.12;
      const zOffset = max.z + (scaledSize.z * pushFactor);
      const widthY = min.y;
      const widthMid = new THREE.Vector3(center.x, widthY, zOffset);

      const xOffset = min.x - (scaledSize.x * pushFactor);
      const heightMid = new THREE.Vector3(xOffset, center.y, max.z);

      const depthMid = new THREE.Vector3(max.x, min.y, center.z);

      // Dimensions for UI display, Convert back to RAW METERS
      const scale = modelScaleRef.current || 1;
      const rawWidth = scaledSize.x / scale;
      const rawHeight = scaledSize.y / scale;
      const rawThickness = scaledSize.z / scale;
      const rawArea = rawWidth * rawHeight;

      const dims = {
        width: rawWidth, height: rawHeight, depth: rawThickness,
        area: rawArea,
        labelPoints: [
            { name: 'Width', vec: widthMid, val: product?.width ? parseFloat(product.width) : rawWidth },
            { name: 'Height', vec: heightMid, val: product?.height ? parseFloat(product.height) : rawHeight },
            { name: 'Thickness', vec: depthMid, val: product?.thickness ? parseFloat(product.thickness) : rawThickness }
        ]
      };

      setModelDimensions(dims);
      dimsRef.current = dims;
      rawDimensionsRef.current = { width: rawWidth, height: rawHeight, thickness: rawThickness };

      const group = new THREE.Group();

      const createThickLine = (start: THREE.Vector3, end: THREE.Vector3, color: number) => {
        const path = new THREE.Vector3().subVectors(end, start);
        const length = path.length();
        const thickness = 0.015 * (scaledSize.length() / 3); 

        const geometry = new THREE.CylinderGeometry(thickness, thickness, length, 8, 1);
        geometry.translate(0, length / 2, 0);
        geometry.rotateX(Math.PI / 2);

        const material = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.copy(start);
        mesh.lookAt(end);
        return mesh;
      };

      const lineColor = 0x3b82f6; // Measurement Line

      group.add(createThickLine(
        new THREE.Vector3(min.x, widthY, zOffset),
        new THREE.Vector3(max.x, widthY, zOffset),
        lineColor
      ));

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

      group.add(createThickLine(
        new THREE.Vector3(xOffset, min.y, max.z),
        new THREE.Vector3(xOffset, max.y, max.z),
        lineColor
      ));

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

      group.add(createThickLine(
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        lineColor
      ));

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

      scene.add(group);

      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    } catch (e) {
      console.warn('Error creating measurements:', e);
    }
  };

  useEffect(() => {
    updateMeasurementLines();
  }, [showMeasurements]);

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
    let lastTime = 0;
    const TARGET_FPS = 30; 
    const FRAME_TIME = 1000 / TARGET_FPS;

    let lastPhi = -1;
    let lastTheta = -1;
    let lastDistance = -1;

    const animate = (currentTime: number) => {
      if (!viewerVisibleRef.current) {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        return;
      }

      if (currentTime - lastTime < FRAME_TIME) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      frameCount++;
      const now = Date.now();

      object.rotation.set(0, 0, 0);

      const dist = cameraDistanceRef.current;
      const phi = rotationRef.current.x;
      const theta = rotationRef.current.y;

      if (phi !== lastPhi || theta !== lastTheta || dist !== lastDistance) {
        const x = dist * Math.sin(phi) * Math.sin(theta);
        const y = dist * Math.cos(phi);
        const z = dist * Math.sin(phi) * Math.cos(theta);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);

        lastPhi = phi;
        lastTheta = theta;
        lastDistance = dist;
      }

      // Rain animation — LineSegments layout: 6 floats per line (2 points)
      if (rainRef.current && rainVelocities.current && (now - lastRainUpdate > 33)) {
        lastRainUpdate = now;
        const geom = rainRef.current.geometry as THREE.BufferGeometry;
        const attr = geom.getAttribute('position') as THREE.BufferAttribute;
        const positions = attr.array as Float32Array;
        const velocities = rainVelocities.current;

        const maxParticles = velocities.length;
        for (let i = 0; i < maxParticles; i++) {
          positions[i * 6 + 1] -= velocities[i];
          positions[i * 6 + 4] -= velocities[i]; 
          if (positions[i * 6 + 1] < -300) {
            const x = (Math.random() - 0.5) * 800;
            const z = (Math.random() - 0.5) * 800;
            const streakLength = 12.0 + Math.random() * 18.0;
            positions[i * 6 + 0] = x;     
            positions[i * 6 + 1] = 400;   
            positions[i * 6 + 2] = z;     
            positions[i * 6 + 3] = x;     
            positions[i * 6 + 4] = 400 - streakLength; 
            positions[i * 6 + 5] = z; 
            velocities[i] = 4.0 + Math.random() * 12.0;
          }
        }
        attr.needsUpdate = true;


      }

      // Less frequent label updates (every 10 frames for better responsiveness)
      if (measurementGroupRef.current && showMeasurementsRef.current && frameCount % 10 === 0) {
        updateLabels(object, camera, viewWidth, viewHeight);
      }

      // Less frequent skybox updates (every 5 frames)
      if (skyboxRef.current && frameCount % 5 === 0) {
        skyboxRef.current.position.copy(camera.position);
      }

      try {
        renderer.render(scene, camera);
        gl.endFrameEXP();
      } catch (error) {
        console.warn('Render error:', error);
        // On render error, slow down frame rate even more
        lastTime = currentTime + FRAME_TIME;
      }

      lastTime = currentTime;
      animationId = requestAnimationFrame(animate);
    };

    animate(0);

    // Return cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  };

  // Helper to update labels
  const updateLabels = (object: THREE.Object3D, camera: THREE.Camera, vModW: number, vModH: number) => {
    if (!dimsRef.current) return;
    const { labelPoints } = dimsRef.current;

    // Ensure matrix is up to date with latest rotation applied in loop
    object.updateMatrixWorld(true);

    const newLabels: any[] = [];

    labelPoints.forEach(p => {
      // 1. Copy world position
      const worldPos = p.vec.clone();

      // 2. Project to NDC (-1 to 1)
      const v = worldPos.project(camera);

      // 3. Check if in front of camera (Standard Three.js NDC z is -1 to 1)
      if (v.z > 1 || v.z < -1) return;

      // 4. Convert NDC to Screen Coords (0 to viewWidth/Height)
      const x = (v.x * 0.5 + 0.5) * vModW;
      const y = (-(v.y * 0.5) + 0.5) * vModH;

      // Format value - Always use raw model units (meters converted to mm)
      let val = p.val;

      // Convert to display unit
      let unitStr = 'mm';
      let displayVal = val;

      if (!isNaN(displayVal)) {
        newLabels.push({
          text: `${displayVal.toFixed(2)} ${unitStr}`,
          x,
          y
        });
      }
    });

    // Only update state if labels actually changed or we need to clear them
    if (newLabels.length > 0 || measurementLabels.length > 0) {
      setMeasurementLabels(newLabels);
    }
  };



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
      <View style={styles.viewerModalContent}>
        {/* GL layer – renders 3D model and the immersive environment sphere */}
        <View
          style={{ width: viewerWidth, height: viewerHeight, overflow: 'hidden', backgroundColor: 'transparent' }}
          {...panResponder.panHandlers}
        >


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
                  modelScaleRef.current = scale;
                  console.log(`Scaled group by ${scale.toFixed(3)} (Max raw dim: ${maxDimension.toFixed(2)}m)`);
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

                // Clear mesh cache when new model loads for fresh color application
                cachedMeshesRef.current = [];

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

                // Load skybox now that GL context is ready
                if (skyboxDataRef.current) {
                  const skyUrl = skyboxDataRef.current?.[weatherMode];
                  loadAndApplySkybox(weatherMode, skyUrl).catch((e) => console.warn('Initial skybox load error:', e));
                }
              } catch (error) {
                console.error('3D viewer init error', error);
                setModelLoading(false);
                setModelError(true);
              }
            }}
          />

          {/* Zoom Controls */}
          <View style={[styles.zoomControls, { pointerEvents: 'box-none' }]}>
            <TouchableOpacity style={[styles.zoomButton, { pointerEvents: 'auto' }]} onPress={() => setCameraDistance(d => Math.max(20, d * 0.8))}>
              <Ionicons name="add" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.zoomButton, { pointerEvents: 'auto' }]} onPress={() => setCameraDistance(d => Math.min(800, d * 1.25))}>
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
              onPress={() => changeWeatherMode('sunny')}
            >
              <Ionicons name="sunny" size={22} color={weatherMode === 'sunny' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'rainy' && styles.weatherIconActive]}
              onPress={() => changeWeatherMode('rainy')}
            >
              <Ionicons name="rainy" size={22} color={weatherMode === 'rainy' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'foggy' && styles.weatherIconActive]}
              onPress={() => changeWeatherMode('foggy')}
            >
              <Ionicons name="cloudy" size={22} color={weatherMode === 'foggy' ? '#fff' : '#333'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.weatherIconButton, weatherMode === 'night' && styles.weatherIconActive]}
              onPress={() => changeWeatherMode('night')}
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
            showMeasurements && measurementLabels.map((lbl: any, i) => (
              <View key={i} style={[
                styles.measurementLabel,
                { left: lbl.x, top: lbl.y }
              ]}>
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
                        changeModelColor('#ORIGINAL');
                        setColorPickerModalVisible(false);
                      }}
                    >
                      <View style={[styles.colorCircle, { backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="ban-outline" size={22} color="#666" />
                      </View>
                      <Text style={styles.colorName}>Default</Text>
                    </TouchableOpacity>

                    {productColors.map((color, index) => {
                      const COLOR_NAMES: Record<string, string> = {
                        '#1a1a1a': 'Matte Black',
                        '#6b6b6b': 'Matte Gray',
                        '#8B4513': 'Narra',
                        '#5C4033': 'Walnut',
                      };
                      const colorLabel = COLOR_NAMES[color] ?? color;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[styles.colorOption, activeColor === color && styles.colorOptionActive]}
                          onPress={() => {
                            changeModelColor(color);
                            setColorPickerModalVisible(false);
                          }}
                        >
                          <View style={[styles.colorCircle, {
                            backgroundColor: color,
                            borderWidth: activeColor === color ? 3 : 1,
                            borderColor: activeColor === color ? '#a81d1d' : 'rgba(0,0,0,0.15)',
                          }]} />
                          <Text style={styles.colorName}>{colorLabel}</Text>
                        </TouchableOpacity>
                      );
                    })}
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
      <View style={[styles.centered, { flex: 1, backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <ActivityIndicator size="large" color="#a81d1d" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <Text style={{ color: darkMode ? '#d0d0d0' : '#222' }}>Product not found.</Text>
      </View>
    );
  }

  // reservation fee (used for button label/navigation)
  const RESERVATION_FEE = 500;
  const productStock = Math.max(0, Number(product?.stock ?? 0));
  const canOrderProduct = productStock > 0;

  const upsertCartItemAndGetId = async (qty = 1): Promise<string> => {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) {
      throw new Error('LOGIN_REQUIRED');
    }

    if (!canOrderProduct) {
      throw new Error('OUT_OF_STOCK');
    }

    const requestedQty = Math.max(1, Number(qty) || 1);
    const availableStock = Math.max(0, Number(product?.stock ?? 0) || 0);
    if (requestedQty > availableStock) {
      throw new Error('EXCEEDS_STOCK');
    }

    const { data: existing, error: selErr } = await supabase
      .from('cart')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', product?.id)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existing?.id) {
      const newQty = (existing.quantity ?? 1) + requestedQty;
      if (newQty > availableStock) {
        throw new Error('EXCEEDS_STOCK');
      }
      const { error: updErr } = await supabase
        .from('cart')
        .update({
          quantity: newQty,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updErr) throw updErr;
      return String(existing.id);
    }

    const payload = {
      user_id: userId,
      product_id: product?.id,
      quantity: requestedQty,
      meta: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await supabase
      .from('cart')
      .insert([payload])
      .select('id')
      .single();
    if (insErr) throw insErr;

    return String(inserted.id);
  };

  // Reserve now should checkout only this product, not all cart items.
  const onReserveNow = async () => {
    if (!product) {
      modal.showError('No product', 'Product data not loaded yet.');
      return;
    }

    if (!canOrderProduct) {
      modal.showInfo('Out of Stock', 'This product is currently out of stock and cannot be ordered.');
      return;
    }

    try {
      const selectedCartId = await upsertCartItemAndGetId(getNormalizedCartQuantity());
      router.push({
        pathname: '../payment',
        params: { selectedIds: JSON.stringify([selectedCartId]) },
      } as any);
    } catch (e) {
      const message = (e as any)?.message || '';
      if (message === 'LOGIN_REQUIRED') {
        modal.showInfo('Login Required', 'Please login to reserve this item.');
        return;
      }
      if (message === 'OUT_OF_STOCK') {
        modal.showInfo('Out of Stock', 'This product is currently out of stock and cannot be ordered.');
        return;
      }
      if (message === 'EXCEEDS_STOCK') {
        modal.showWarning('Stock Limit', `You can only order up to ${productStock} unit${productStock === 1 ? '' : 's'} for this product.`);
        return;
      }
      console.error('Reserve now failed:', e);
      modal.showError('Error', 'Failed to reserve this item. Please try again.');
    }
  };

  // Add to cart -> insert or upsert into 'cart' table to sync with web
  const addToCart = async (qty = 1) => {
    try {
      await upsertCartItemAndGetId(qty);
      const addedQty = Math.max(1, Number(qty) || 1);
      modal.show({
        type: 'success',
        title: 'Added',
        message: `${addedQty} ${addedQty === 1 ? 'item' : 'items'} of ${product?.name} ${addedQty === 1 ? 'has' : 'have'} been added to your cart.`,
        buttons: [
          {
            text: 'Continue Shopping',
            onPress: () => {},
          },
          {
            text: 'Proceed to Cart',
            onPress: () => router.push('/(tabs)/cart'),
          },
        ],
      });
    } catch (e: any) {
      if (e?.message === 'LOGIN_REQUIRED') {
        modal.showInfo(
          'Login Required',
          'Please login or create an account to add items to your cart.'
        );
        return;
      }
      if (e?.message === 'OUT_OF_STOCK') {
        modal.showInfo('Out of Stock', 'This product is currently out of stock and cannot be added to your cart.');
        return;
      }
      if (e?.message === 'EXCEEDS_STOCK') {
        modal.showWarning('Stock Limit', `You can only order up to ${productStock} unit${productStock === 1 ? '' : 's'} for this product.`);
        return;
      }
      console.error('Add to cart failed', e);
      const msg = e?.message ?? JSON.stringify(e);
      modal.showError('Error', `Failed to add to cart.\n${msg}`);
    }
  };

  // Fast weather mode change handler with caching
  const changeWeatherMode = (newMode: 'sunny' | 'rainy' | 'foggy' | 'night') => {
    setWeatherMode(newMode);
  };

  // Color change handler
  const changeModelColor = (newColor: string) => {
    setActiveColor(newColor);
  };

  const open3DViewer = () => {
    setViewerVisible(true);
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

  const availableStock = productStock;

  const renderStars = (rating: number) => {
    const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name={index < safeRating ? 'star' : 'star-outline'}
        size={16}
        color={index < safeRating ? '#f4b400' : '#cbd5e1'}
      />
    ));
  };

  const reviewAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length
    : 0;

  const formatReviewDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? '#101010' : '#fff' }}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: darkMode ? '#151515' : '#fff', borderBottomColor: darkMode ? '#2f2f2f' : '#eee' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={darkMode ? '#f2f2f2' : '#a81d1d'} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: darkMode ? '#f2f2f2' : '#222' }]}>Product Details</Text>
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

          <Text style={styles.productName}>{product?.name ?? 'Product Code'}</Text>
          <Text style={styles.productFullName}>{product?.fullproductname || 'Product Name'}</Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₱{product?.price ?? 0}</Text>
          </View>

          {/* Stock and Models badges below price */}
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {/* Stock badge */}
            <View style={styles.stockBadgeRow}>
              <Text style={[styles.stockTextSmall, !canOrderProduct && { color: '#b3261e' }]}>
                {canOrderProduct ? `${availableStock} in stock` : 'Out of stock'}
              </Text>
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

          {/* 3D Viewer Button on left */}
          <TouchableOpacity
            style={styles.open3DButton}
            onPress={open3DViewer}
          >
            <Ionicons name="cube-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 8, fontWeight: '700' }}>
              3D View{modelsCount > 0 ? ` (${modelsCount})` : ''}
            </Text>
          </TouchableOpacity>

          {/* Top buttons row: Wishlist / Reserve Now */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.wishlistIconBtn, { borderColor: isInWishlist ? '#e84c89' : '#d81b60' }]} 
              onPress={toggleWishlist}
            >
              <Ionicons name={isInWishlist ? 'heart' : 'heart-outline'} size={24} color={isInWishlist ? '#e84c89' : '#d81b60'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { opacity: canOrderProduct ? 1 : 0.45 }]}
              onPress={onReserveNow}
              disabled={!canOrderProduct}
            >
              <Text style={styles.primaryBtnText}>Reserve Now (₱{RESERVATION_FEE})</Text>
            </TouchableOpacity>
          </View>

          {/* Quantity selector and Add to Cart button row */}
          <View style={styles.quantityAndCartContainer}>
            <View style={styles.quantitySelector}>
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => {
                  const nextQty = Math.max(1, cartQuantity - 1);
                  setCartQuantity(nextQty);
                  setCartQuantityInput(String(nextQty));
                }}
              >
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={cartQuantityInput}
                onChangeText={onCartQuantityInputChange}
                onBlur={commitCartQuantityInput}
                onSubmitEditing={commitCartQuantityInput}
                keyboardType="number-pad"
                returnKeyType="done"
                textAlign="center"
              />
              <TouchableOpacity 
                style={styles.quantityButton}
                onPress={() => {
                  const nextQty = Math.min(availableStock, cartQuantity + 1);
                  setCartQuantity(nextQty);
                  setCartQuantityInput(String(nextQty));
                }}
              >
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={[styles.addToCartBtn, { opacity: canOrderProduct ? 1 : 0.45 }]} 
              disabled={!canOrderProduct}
              onPress={() => addToCart(getNormalizedCartQuantity())}
            >
              <Ionicons name="cart-outline" size={18} color="#fff" />
              <Text style={styles.addToCartBtnText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>

          {/* Description, notes and additional fields */}
          <Text style={styles.sectionTitle}>Product Description</Text>
          <SimpleHtmlParser html={product?.description ?? product?.short_description ?? 'No description provided.'} style={styles.description} />

          {/* Key Features - Width, Height, Thickness in card format */}
          {(product?.width || product?.height || product?.thickness) && (
            <>
              <Text style={styles.sectionTitle}>Key Features</Text>
              <View style={styles.keyFeaturesContainer}>
                {product?.height && (
                  <View style={styles.keyFeatureCard}>
                    <Text style={styles.keyFeatureLabel}>Height</Text>
                    <Text style={styles.keyFeatureValue}>{product?.height ? `${parseFloat(product.height).toFixed(0)} mm` : '-'}</Text>
                  </View>
                )}
                {product?.width && (
                  <View style={styles.keyFeatureCard}>
                    <Text style={styles.keyFeatureLabel}>Width</Text>
                    <Text style={styles.keyFeatureValue}>{product?.width ? `${parseFloat(product.width).toFixed(0)} mm` : '-'}</Text>
                  </View>
                )}
                {product?.thickness && (
                  <View style={styles.keyFeatureCard}>
                    <Text style={styles.keyFeatureLabel}>Thickness</Text>
                    <Text style={styles.keyFeatureValue}>{product?.thickness ? `${parseFloat(product.thickness).toFixed(1)} mm` : '-'}</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* Additional Features - bullet list */}
          {(features.length > 0 || product?.additional_features_text) && (
            <>
              <Text style={styles.sectionTitle}>Additional Features</Text>
              <View style={styles.featuresList}>
                {features.length > 0 ? features.map((feat, idx) => (
                  <View key={idx} style={styles.featureRow}>
                    <Text style={styles.bullet}>{'\u2022'}</Text>
                    <View style={{ flex: 1 }}>
                      <SimpleHtmlParser html={String(feat)} style={styles.featureText} />
                    </View>
                  </View>
                )) : (
                  // fallback: show parsed HTML if array not available
                  <SimpleHtmlParser html={String(product?.additional_features_text || '')} style={styles.featureText} />
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
                <Text style={styles.specLabel}>Total Area:</Text>
                <Text style={styles.specValue}>
                  {product?.width && product?.height
                    ? `${((parseFloat(product.width) * parseFloat(product.height)) / 10000).toFixed(2)} sqm`
                    : '-'}
                </Text>
              </View>
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Type:</Text>
                <Text style={styles.specValue}>{product?.type || '-'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.reviewsCard}>
            <Text style={styles.sectionTitle}>Reviews</Text>

            <View style={styles.reviewSummaryCard}>
              <View style={styles.reviewSummaryLeft}>
                <Text style={styles.reviewAverageScore}>{reviewAverage ? reviewAverage.toFixed(1) : '0.0'}</Text>
                <View style={styles.reviewStarsRow}>{renderStars(reviewAverage)}</View>
                <Text style={styles.reviewCountText}>
                  {reviews.length > 0 ? `${reviews.length} review${reviews.length !== 1 ? 's' : ''}` : 'No reviews yet'}
                </Text>
              </View>

              <View style={styles.reviewLeaveCard}>
                <Text style={styles.reviewLeaveTitle}>Leave a review</Text>
                <Text style={styles.reviewLeaveText}>
                  {canReview
                    ? myReviewId
                      ? 'You already have a review here. Update it below if needed.'
                      : 'Share your experience with this product after completing your order.'
                    : 'Only users who have completed this product can leave a review.'}
                </Text>
              </View>
            </View>

            {canReviewLoading || reviewsLoading ? (
              <View style={styles.reviewsLoadingBox}>
                <ActivityIndicator color="#a81d1d" />
                <Text style={styles.reviewsLoadingText}>Preparing review form...</Text>
              </View>
            ) : canReview ? (
              <View style={styles.reviewFormCard}>
                <Text style={styles.reviewFormTitle}>{myReviewId ? 'Update your review' : 'Write your review'}</Text>
                <Text style={styles.reviewFormSubtitle}>
                  Rate the product and share a short comment for other shoppers.
                </Text>

                <View style={styles.reviewStarsSelectRow}>
                  {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1;
                    const active = reviewRating >= starValue;
                    return (
                      <TouchableOpacity
                        key={starValue}
                        style={styles.reviewStarButton}
                        onPress={() => setReviewRating(starValue)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={active ? 'star' : 'star-outline'}
                          size={24}
                          color={active ? '#f4b400' : '#cbd5e1'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.reviewRatingText}>{reviewRating ? `${reviewRating}/5` : 'Tap a star'}</Text>
                </View>

                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Tell other shoppers what you think..."
                  placeholderTextColor="#8b8b8b"
                  multiline
                  textAlignVertical="top"
                  style={styles.reviewInput}
                  maxLength={500}
                />

                <TouchableOpacity
                  style={[styles.reviewSubmitButton, reviewsSubmitting && styles.reviewSubmitButtonDisabled]}
                  onPress={submitProductReview}
                  disabled={reviewsSubmitting}
                  activeOpacity={0.85}
                >
                  {reviewsSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.reviewSubmitButtonText}>
                      {myReviewId ? 'Update Review' : 'Submit Review'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {reviewsLoading ? (
              <View style={styles.reviewsLoadingBox}>
                <ActivityIndicator color="#a81d1d" />
                <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
              </View>
            ) : reviews.length === 0 ? (
              <Text style={styles.noReviewsText}>No reviews yet. Be the first!</Text>
            ) : (
              <View style={styles.reviewList}>
                {reviews.map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewItemHeader}>
                      <View style={styles.reviewAuthorAvatar}>
                        <Ionicons name="person" size={16} color="#a81d1d" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewAuthorName}>Customer</Text>
                        <View style={styles.reviewStarsRow}>{renderStars(Number(review.rating || 0))}</View>
                      </View>
                      <Text style={styles.reviewDate}>{formatReviewDate(review.created_at)}</Text>
                    </View>

                    {review.comment ? (
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    ) : (
                      <Text style={styles.reviewCommentMuted}>No comment provided.</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
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
    alignSelf: 'flex-start',
  },
  productName: {
    fontWeight: '700',
    fontSize: 24,
    marginBottom: 6,
    color: '#222',
    textAlign: 'center',
  },
  productFullName: {
    fontWeight: '400',
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
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
  quantityAndCartContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#ddd',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  quantityValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
  quantityInput: {
    minWidth: 44,
    height: 40,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f8449',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  addToCartBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  leftButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#a81d1d',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  secondaryBtn: {
    minWidth: 110,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryBtnText: { marginLeft: 8, color: '#222', fontWeight: '700' },
  wishlistBtn: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  wishlistBtnText: { marginLeft: 8, fontWeight: '700' },
  wishlistIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    color: '#d41c3e',
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginTop: 8,
  },
  keyFeaturesContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  keyFeatureCard: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  keyFeatureLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    textAlign: 'center',
  },
  keyFeatureValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
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
    marginBottom: 2,
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
    color: '#222',
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
  reviewsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ececec',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  reviewSummaryCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    marginBottom: 14,
  },
  reviewSummaryLeft: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAverageScore: {
    fontSize: 28,
    fontWeight: '800',
    color: '#a81d1d',
    lineHeight: 32,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
    marginBottom: 4,
  },
  reviewCountText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  reviewLeaveCard: {
    flex: 1,
    backgroundColor: '#fdf7f7',
    borderRadius: 10,
    padding: 12,
    justifyContent: 'center',
    borderLeftWidth: 3,
    borderLeftColor: '#a81d1d',
  },
  reviewLeaveTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222',
    marginBottom: 6,
  },
  reviewLeaveText: {
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  reviewFormCard: {
    backgroundColor: '#fbfbfb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  reviewFormTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#222',
  },
  reviewFormSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  reviewStarsSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reviewStarButton: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  reviewRatingText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  reviewInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  reviewSubmitButton: {
    backgroundColor: '#a81d1d',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSubmitButtonDisabled: {
    opacity: 0.7,
  },
  reviewSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewsLoadingBox: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewsLoadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
  },
  noReviewsText: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  reviewList: {
    gap: 12,
  },
  reviewItem: {
    backgroundColor: '#fafafa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  reviewAuthorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fdeeee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAuthorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#222',
  },
  reviewDate: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    marginLeft: 8,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    color: '#333',
  },
  reviewCommentMuted: {
    fontSize: 13,
    lineHeight: 19,
    color: '#888',
    fontStyle: 'italic',
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
    backgroundColor: 'rgba(30,35,48,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    zIndex: 9999, // Ensure it's on top of everything including GLView
    elevation: 10, // Android shadow and layering
    // Fix positioning: translate to center the bubble on the coordinate
    transform: [{ translateX: -30 }, { translateY: -15 }]
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