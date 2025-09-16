import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
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

  // 3D FBX Viewer using Three.js
  const renderFBXViewer = () => {
    if (!product?.fbx_url) return null;
    return (
      <View style={styles.fbxPlaceholder}>
        <GLView
          style={{ flex: 1, width: '100%', height: 220 }}
          onContextCreate={async (gl) => {
            setFbxLoading(true);
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
            camera.position.z = 4;

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
                    // Enable transparency for all materials
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
                    scene.add(object);

                    // Animation loop
                    const animate = () => {
                      requestAnimationFrame(animate);
                      object.rotation.y += 0.01;
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
          {renderFBXViewer()}
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
          {/* Add more fields as needed */}
        </View>
      </ScrollView>

      {/* Bottom Navbar (same as shop.tsx) */}
      <View style={styles.redLowerBar}>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton} onPress={() => router.push('../homepage')}>
            <Image
              source={require('@/assets/images/home.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/inquire.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => router.push('../shop')}
        >
          <Image
            source={require('@/assets/images/catalogbutton.png')}
            style={styles.catalogIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/service.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/settings.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
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
  redLowerBar: {
    height: '9%',
    width: '100%',
    backgroundColor: '#860e0eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  sideIconsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  sideIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideIcon: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    zIndex: 1,
  },
  catalogIcon: {
    width: 32,
    height: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});