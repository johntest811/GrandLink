import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions, PanResponder, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { GLView } from 'expo-gl';
// @ts-ignore
import * as THREE from 'three';
// @ts-ignore
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

const { width } = Dimensions.get('window');

export default function ProductViewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fbxLoading, setFbxLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  // 3D controls
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const rotationRef = useRef(rotation);
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);

  const [cameraDistance, setCameraDistance] = useState(4);
  const cameraDistanceRef = useRef(cameraDistance);
  useEffect(() => { cameraDistanceRef.current = cameraDistance; }, [cameraDistance]);

  const [lastDistance, setLastDistance] = useState<number | null>(null);
  const lastRotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const fetchProduct = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    };
    fetchProduct();
  }, [id]);

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

  // 3D FBX Viewer using Three.js (for modal)
  const renderFBXViewer = () => {
    if (!product?.fbx_url) return null;
    return (
      <View style={styles.fbxModalContent} {...panResponder.panHandlers}>
        <GLView
          style={{ flex: 1, width: '100%', height: 320 }}
          onContextCreate={async (gl) => {
            setFbxLoading(true);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
            camera.position.z = cameraDistance;

            const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true });
            renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
            renderer.setClearColor('#f2f2f2');

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
            scene.add(ambientLight);

            // FBX Loader
            const loader = new FBXLoader();
            loader.load(
              product.fbx_url,
              (object: THREE.Object3D) => {
                object.traverse((child: THREE.Object3D) => {
                  if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
                    const meshMaterial = (child as THREE.Mesh).material;
                    if (Array.isArray(meshMaterial)) {
                      meshMaterial.forEach((mat) => {
                        if (mat) {
                          (mat as THREE.Material & { transparent?: boolean; opacity?: number }).transparent = true;
                          (mat as THREE.Material & { transparent?: boolean; opacity?: number }).opacity =
                            (mat as THREE.Material & { opacity?: number }).opacity ?? 0.5;
                        }
                      });
                    } else if (meshMaterial) {
                      (meshMaterial as THREE.Material & { transparent?: boolean; opacity?: number }).transparent = true;
                      (meshMaterial as THREE.Material & { transparent?: boolean; opacity?: number }).opacity =
                        (meshMaterial as THREE.Material & { opacity?: number }).opacity ?? 0.5;
                    }
                  }
                });
                object.scale.set(0.005, 0.005, 0.005); // Make the object smaller (adjust value as needed)
                scene.add(object);

                // Animation loop
                const animate = () => {
                  requestAnimationFrame(animate);
                  object.rotation.x = rotationRef.current.x;
                  object.rotation.y = rotationRef.current.y;
                  camera.position.z = cameraDistanceRef.current;
                  renderer.render(scene, camera);
                  gl.endFrameEXP();
                };
                animate();

                setFbxLoading(false);
              },
              undefined,
              (error: any) => {
                setFbxLoading(false);
                console.error('FBX load error:', error);
              }
            );
          }}
        />
        {fbxLoading && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f2f2f2' }]}>
            <ActivityIndicator size="large" color="#a81d1d" />
            <Text style={{ color: '#888', marginTop: 8 }}>Loading 3D Model...</Text>
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
              product.image1
                ? { uri: product.image1 }
                : require('@/assets/images/placeholder.png')
            }
            style={styles.productImage}
            resizeMode="cover"
          />
          {/* 3D Viewer Button */}
          <TouchableOpacity
            style={styles.open3DButton}
            onPress={() => setViewerVisible(true)}
          >
            <Ionicons name="cube-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 8, fontWeight: 'bold' }}>View 3D Model</Text>
          </TouchableOpacity>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productDesc}>{product.description}</Text>
          <Text style={styles.productPrice}>₱{product.price}</Text>
          {/* Show all other product fields */}
          <Text style={styles.productDetail}>Material: {product.material}</Text>
          <Text style={styles.productDetail}>Type: {product.type}</Text>
          <Text style={styles.productDetail}>Category: {product.category}</Text>
          <Text style={styles.productDetail}>Height: {product.height}</Text>
          <Text style={styles.productDetail}>Width: {product.width}</Text>
          <Text style={styles.productDetail}>Thickness: {product.thickness}</Text>
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
});