import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Pressable, TextInput, Modal, TouchableWithoutFeedback, Keyboard, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Svg, { Line, Circle } from 'react-native-svg';
import BottomNavBar from "@BottomNav/../components/BottomNav";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../supabaseClient';
import { ARMeasurementService } from '../../services/ARMeasurementService';
import { ARMeasurement, SaveMeasurementData } from '../../types/ARMeasurement';
import * as Sensors from 'expo-sensors';
import { GLView } from 'expo-gl';
import { Accelerometer, Gyroscope, Magnetometer } from 'expo-sensors';

export default function ARMeasureScreen() {
  const router = useRouter();
  const [showCamera, setShowCamera] = useState(false);
  const [measurements, setMeasurements] = useState<{width: number; height: number} | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<Array<{ x: number; y: number; worldX: number; worldY: number; worldZ: number }>>([]);
  const [permission, requestPermission] = useCameraPermissions();
  
  // New state for database integration
  const [user, setUser] = useState<any>(null);
  const [savedMeasurements, setSavedMeasurements] = useState<ARMeasurement[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [measurementName, setMeasurementName] = useState('');
  const [measurementType, setMeasurementType] = useState<SaveMeasurementData['measurement_type']>('general');
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAllMeasurements, setShowAllMeasurements] = useState(false);

  // Advanced AR state for proper 3D tracking
  const [deviceOrientation, setDeviceOrientation] = useState({ pitch: 0, roll: 0, yaw: 0 });
  const [devicePosition, setDevicePosition] = useState({ x: 0, y: 0, z: 0 });
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [calibrationFactor, setCalibrationFactor] = useState(0.5);
  const [measurementDepth, setMeasurementDepth] = useState(100); // cm from camera
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationDistance, setCalibrationDistance] = useState('');
  const [calibrationDimension, setCalibrationDimension] = useState<'width' | 'height'>('width');
  const [planeNormal, setPlaneNormal] = useState({ x: 0, y: 0, z: 1 }); // Surface normal vector
  const [referencePoints, setReferencePoints] = useState<Array<{ screen: { x: number, y: number }, world: { x: number, y: number, z: number } }>>([]);
  const [depthEstimationMode, setDepthEstimationMode] = useState<'manual' | 'auto' | 'reference'>('reference');
  const [focusDistance, setFocusDistance] = useState(50); // cm - default focus distance
  const [cameraIntrinsics, setCameraIntrinsics] = useState({
    focalLength: 1000, // pixels
    principalPointX: 0,
    principalPointY: 0,
    imageWidth: 0,
    imageHeight: 0
  });

  // Fetch user and load measurements on component mount
  useEffect(() => {
    const fetchUserAndMeasurements = async () => {
      try {
        // Check both session and user to ensure authentication
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();
        
        console.log('Auth Debug - Session:', !!session);
        console.log('Auth Debug - User:', !!user);
        
        // Use session.user if available, fallback to user
        const currentUser = session?.user || user;
        setUser(currentUser);
        
        if (currentUser) {
          console.log('User authenticated, loading measurements...');
          const result = await ARMeasurementService.getUserMeasurements();
          if (result.success && result.data) {
            setSavedMeasurements(result.data);
          } else {
            console.log('Failed to load measurements:', result.error);
          }
        } else {
          console.log('No user found in session or auth');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserAndMeasurements();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session?.user);
      setUser(session?.user || null);
      
      if (session?.user) {
        const result = await ARMeasurementService.getUserMeasurements();
        if (result.success && result.data) {
          setSavedMeasurements(result.data);
        }
      } else {
        setSavedMeasurements([]);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Advanced AR tracking system with sensor fusion
  useEffect(() => {
    let accelerometerSub: any = null;
    let gyroscopeSub: any = null;
    let magnetometerSub: any = null;
    
    const startARTracking = async () => {
      try {
        // Start accelerometer for gravity and device orientation
        const accelAvailable = await Accelerometer.isAvailableAsync();
        if (accelAvailable) {
          Accelerometer.setUpdateInterval(50);
          accelerometerSub = Accelerometer.addListener((accelData) => {
            // Calculate pitch and roll from gravity
            const { x, y, z } = accelData;
            const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
            const roll = Math.atan2(y, z) * (180 / Math.PI);
            
            setDeviceOrientation(prev => ({ ...prev, pitch, roll }));
            
            // Update plane normal based on device orientation
            const normalX = Math.sin(pitch * Math.PI / 180);
            const normalY = -Math.sin(roll * Math.PI / 180) * Math.cos(pitch * Math.PI / 180);
            const normalZ = Math.cos(roll * Math.PI / 180) * Math.cos(pitch * Math.PI / 180);
            setPlaneNormal({ x: normalX, y: normalY, z: normalZ });
          });
        }
        
        // Start gyroscope for rotation tracking
        const gyroAvailable = await Gyroscope.isAvailableAsync();
        if (gyroAvailable) {
          Gyroscope.setUpdateInterval(50);
          gyroscopeSub = Gyroscope.addListener((gyroData) => {
            // Integrate gyroscope data for yaw (heading)
            const { z } = gyroData;
            setDeviceOrientation(prev => ({ 
              ...prev, 
              yaw: prev.yaw + (z * 180 / Math.PI) * 0.05 // dt = 0.05s
            }));
          });
        }
        
        // Set camera intrinsics based on screen dimensions
        const { width, height } = Dimensions.get('window');
        setCameraIntrinsics({
          focalLength: width * 0.8, // Estimate focal length as 80% of screen width
          principalPointX: width / 2,
          principalPointY: height / 2,
          imageWidth: width,
          imageHeight: height
        });
        
      } catch (error) {
        console.log('AR tracking not available:', error);
      }
    };

    if (showCamera) {
      startARTracking();
    }

    return () => {
      if (accelerometerSub) accelerometerSub.remove();
      if (gyroscopeSub) gyroscopeSub.remove();
      if (magnetometerSub) magnetometerSub.remove();
    };
  }, [showCamera]);

  const startARMeasurement = async () => {
    // Re-enabled AR Camera feature
    if (!CameraView) {
      Alert.alert('Camera Unavailable', 'Camera feature is not available. Please check app permissions.');
      return;
    }
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed for AR measurement');
        return;
      }
    }
    setShowCamera(true);
    setMeasurementPoints([]);
    setMeasurements(null);
  };

  const handleScreenTap = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    
    // Convert screen coordinates to 3D world coordinates using advanced AR projection
    const worldPoint = screenToWorldCoordinateAR(locationX, locationY);
    
    const newPoint = { 
      x: locationX, // Keep screen coords for display
      y: locationY, 
      worldX: worldPoint.x, // Add world coords for accurate measurement
      worldY: worldPoint.y,
      worldZ: worldPoint.z
    };
    
    const updatedPoints = [...measurementPoints, newPoint];
    setMeasurementPoints(updatedPoints);

    // Calculate width and height after adding point (need 4 points for rectangle)
    if (updatedPoints.length === 4) {
      calculateFrameMeasurement(updatedPoints);
    } else if (updatedPoints.length > 4) {
      // Limit to 4 points for rectangle measurement
      const limitedPoints = updatedPoints.slice(0, 4);
      setMeasurementPoints(limitedPoints);
      calculateFrameMeasurement(limitedPoints);
    }
  };

  // Advanced 3D coordinate conversion with proper AR projection
  const screenToWorldCoordinateAR = (screenX: number, screenY: number) => {
    const { imageWidth, imageHeight, focalLength, principalPointX, principalPointY } = cameraIntrinsics;
    
    if (imageWidth === 0 || imageHeight === 0) {
      // Fallback to simple projection if intrinsics not set
      return screenToWorldCoordinateFallback(screenX, screenY);
    }
    
    // Convert screen coordinates to normalized camera coordinates
    const x_cam = (screenX - principalPointX) / focalLength;
    const y_cam = (screenY - principalPointY) / focalLength;
    
    // Ray direction in camera space
    const rayDir = {
      x: x_cam,
      y: y_cam,
      z: 1.0
    };
    
    // Apply device orientation to ray direction
    const rotatedRay = applyDeviceRotation(rayDir, deviceOrientation);
    
    // Determine intersection depth using plane normal
    let intersectionDepth = focusDistance;
    
    if (depthEstimationMode === 'reference' && referencePoints.length > 0) {
      // Use reference points for better depth estimation
      intersectionDepth = estimateDepthFromReferences(screenX, screenY);
    } else if (depthEstimationMode === 'auto') {
      // Use plane normal to estimate intersection depth
      const denominator = rotatedRay.x * planeNormal.x + rotatedRay.y * planeNormal.y + rotatedRay.z * planeNormal.z;
      if (Math.abs(denominator) > 0.001) {
        intersectionDepth = Math.abs(focusDistance / denominator);
      }
    }
    
    // Calculate world coordinates
    const worldX = rotatedRay.x * intersectionDepth;
    const worldY = rotatedRay.y * intersectionDepth;
    const worldZ = rotatedRay.z * intersectionDepth;
    
    return {
      x: worldX * (isCalibrated ? calibrationFactor : 1.0),
      y: worldY * (isCalibrated ? calibrationFactor : 1.0),
      z: worldZ * (isCalibrated ? calibrationFactor : 1.0)
    };
  };
  
  const screenToWorldCoordinateFallback = (screenX: number, screenY: number) => {
    const screenDimensions = Dimensions.get('screen');
    // Normalize screen coordinates to -1 to 1 range
    const normalizedX = (screenX / screenDimensions.width) * 2 - 1;
    const normalizedY = -((screenY / screenDimensions.height) * 2 - 1);
    
    // Apply perspective projection
    const fov = 60; // Field of view in degrees
    const aspect = screenDimensions.width / screenDimensions.height;
    const fovRad = (fov * Math.PI) / 180;
    
    const depth = isCalibrated ? focusDistance : 100;
    const worldX = normalizedX * depth * Math.tan(fovRad / 2) * aspect;
    const worldY = normalizedY * depth * Math.tan(fovRad / 2);
    
    return { x: worldX, y: worldY, z: depth };
  };
  
  const applyDeviceRotation = (rayDir: any, orientation: any) => {
    const pitch = orientation.pitch * (Math.PI / 180);
    const roll = orientation.roll * (Math.PI / 180);
    const yaw = orientation.yaw * (Math.PI / 180);
    
    // Apply rotation matrices (simplified)
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    
    // Rotation around Y-axis (pitch)
    const x1 = rayDir.x * cosPitch + rayDir.z * sinPitch;
    const y1 = rayDir.y;
    const z1 = -rayDir.x * sinPitch + rayDir.z * cosPitch;
    
    // Rotation around X-axis (roll)
    const x2 = x1;
    const y2 = y1 * cosRoll - z1 * sinRoll;
    const z2 = y1 * sinRoll + z1 * cosRoll;
    
    // Rotation around Z-axis (yaw)
    const x3 = x2 * cosYaw - y2 * sinYaw;
    const y3 = x2 * sinYaw + y2 * cosYaw;
    const z3 = z2;
    
    return { x: x3, y: y3, z: z3 };
  };
  
  const estimateDepthFromReferences = (screenX: number, screenY: number) => {
    if (referencePoints.length === 0) return focusDistance;
    
    // Find closest reference point
    let minDistance = Infinity;
    let closestDepth = focusDistance;
    
    referencePoints.forEach(ref => {
      const dx = screenX - ref.screen.x;
      const dy = screenY - ref.screen.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestDepth = Math.sqrt(
          ref.world.x * ref.world.x + 
          ref.world.y * ref.world.y + 
          ref.world.z * ref.world.z
        );
      }
    });
    
    return closestDepth;
  };

  const calculateFrameMeasurement = (points: Array<any>) => {
    if (points.length !== 4) {
      setMeasurements(null);
      return;
    }

    // Calculate width and height from 4 corner points
    // Assume points are in order: top-left, top-right, bottom-right, bottom-left
    const [topLeft, topRight, bottomRight, bottomLeft] = points;
    
    // Calculate width (top edge)
    const width = Math.sqrt(
      Math.pow(topRight.worldX - topLeft.worldX, 2) +
      Math.pow(topRight.worldY - topLeft.worldY, 2) +
      Math.pow(topRight.worldZ - topLeft.worldZ, 2)
    );
    
    // Calculate height (left edge)
    const height = Math.sqrt(
      Math.pow(bottomLeft.worldX - topLeft.worldX, 2) +
      Math.pow(bottomLeft.worldY - topLeft.worldY, 2) +
      Math.pow(bottomLeft.worldZ - topLeft.worldZ, 2)
    );
    
    setMeasurements({ width, height });
  };

  const calculateMeasurement = (points: Array<any>) => {
    if (points.length === 4) {
      // Calculate frame measurements using the new function
      calculateFrameMeasurement(points);
    } else {
      // Clear measurements if not 4 points
      setMeasurements(null);
    }
  };

  const closeCamera = () => {
    setShowCamera(false);
  };

  const saveMeasurement = async () => {
    if (measurementPoints.length === 4 && measurements) {
      // Re-check authentication before showing modal
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        const authUser = session?.user || currentUser;
        console.log('Save - Auth check:', !!authUser);
        
        if (!authUser) {
          Alert.alert(
            'Authentication Required', 
            'Please log in to save measurements. If you are already logged in, try restarting the app.',
            [
              { text: 'OK' },
              { text: 'Retry', onPress: () => {
                // Retry fetching user
                fetchUserAndMeasurements();
              }}
            ]
          );
          return;
        }
        
        // Update user state if it wasn't set
        if (!user) {
          setUser(authUser);
        }
        
        // Show save modal to get measurement details
        setShowSaveModal(true);
      } catch (error) {
        console.error('Auth check error:', error);
        Alert.alert('Error', 'Unable to verify authentication. Please try again.');
      }
    } else {
      Alert.alert('Incomplete Measurement', 'Please tap all 4 corners of the frame to complete the measurement.');
    }
  };
  
  const fetchUserAndMeasurements = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      
      const currentUser = session?.user || user;
      setUser(currentUser);
      
      if (currentUser) {
        const result = await ARMeasurementService.getUserMeasurements();
        if (result.success && result.data) {
          setSavedMeasurements(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleSaveMeasurement = async () => {
    if (!measurementName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this measurement.');
      return;
    }

    setIsSaving(true);
    
    try {
      const saveData: SaveMeasurementData = {
        measurement_name: measurementName.trim(),
        measurement_type: measurementType,
        points: measurementPoints,
        distances: measurements || {width: 0, height: 0},
        unit: 'cm',
        notes: measurementNotes.trim(),
        device_info: {
          platform: Platform.OS as 'ios' | 'android',
          screenWidth: Dimensions.get('window').width,
          screenHeight: Dimensions.get('window').height,
          calibrationFactor: calibrationFactor
        }
      };

      const result = await ARMeasurementService.saveMeasurement(saveData);
      
      if (result.success) {
        Alert.alert(
          'Measurement Saved!', 
          `"${measurementName}" has been saved to your profile.`,
          [{
            text: 'OK', 
            onPress: handleSaveSuccess
          }]
        );
      } else {
        Alert.alert('Save Failed', result.error || 'Unable to save measurement.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while saving.');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadSavedMeasurements = async () => {
    if (user) {
      const result = await ARMeasurementService.getUserMeasurements();
      if (result.success && result.data) {
        setSavedMeasurements(result.data);
      }
    }
  };

  const resetMeasurement = () => {
    setMeasurementPoints([]);
    setMeasurements(null);
  };

  const undoLastPoint = () => {
    if (measurementPoints.length > 0) {
      const newPoints = measurementPoints.slice(0, -1);
      setMeasurementPoints(newPoints);
      // Recalculate measurements for frame (need exactly 4 points)
      if (newPoints.length === 4) {
        calculateFrameMeasurement(newPoints);
      } else {
        setMeasurements(null);
      }
    }
  };

  // Handle modal close and reset form
  const handleCloseModal = () => {
    Keyboard.dismiss();
    setShowSaveModal(false);
    // Reset form fields
    setMeasurementName('');
    setMeasurementType('general');
    setMeasurementNotes('');
  };

  // Handle successful save
  const handleSaveSuccess = () => {
    Keyboard.dismiss();
    setShowSaveModal(false);
    setMeasurementName('');
    setMeasurementType('general');
    setMeasurementNotes('');
    loadSavedMeasurements();
  };

  // Handle favorite toggle
  const toggleFavorite = async (measurementId: string, currentFavoriteState: boolean) => {
    try {
      const result = await ARMeasurementService.toggleFavorite(measurementId, !currentFavoriteState);
      if (result.success) {
        // Update local state
        setSavedMeasurements(prev => 
          prev.map(m => 
            m.id === measurementId 
              ? { ...m, is_favorite: !currentFavoriteState }
              : m
          )
        );
      } else {
        Alert.alert('Error', 'Failed to update favorite status');
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
      Alert.alert('Error', 'An error occurred while updating favorite status');
    }
  };

  // Handle delete measurement
  const deleteMeasurement = async (measurementId: string, measurementName: string) => {
    Alert.alert(
      'Delete Measurement',
      `Are you sure you want to delete "${measurementName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await ARMeasurementService.deleteMeasurement(measurementId);
              if (result.success) {
                setSavedMeasurements(prev => prev.filter(m => m.id !== measurementId));
                Alert.alert('Success', 'Measurement deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete measurement');
              }
            } catch (error) {
              console.error('Delete measurement error:', error);
              Alert.alert('Error', 'An error occurred while deleting the measurement');
            }
          }
        }
      ]
    );
  };

  // Handle view all measurements
  const handleViewAllMeasurements = () => {
    setShowAllMeasurements(true);
  };

  // Handle close all measurements modal
  const handleCloseAllMeasurements = () => {
    setShowAllMeasurements(false);
  };

  // Calibration functions
  const startCalibration = () => {
    setShowCalibrationModal(true);
  };

  const handleCalibration = () => {
    const knownValue = parseFloat(calibrationDistance);
    if (isNaN(knownValue) || knownValue <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid distance in centimeters.');
      return;
    }

    if (!measurements || measurementPoints.length < 4) {
      Alert.alert('No Measurement', 'Please complete a frame measurement first (4 corner points).');
      return;
    }

    // Measure pixel span on screen for the chosen dimension
    // Points order: TL(0) → TR(1) → BR(2) → BL(3)
    const p0 = measurementPoints[0]; // TL
    const p1 = measurementPoints[1]; // TR
    const p3 = measurementPoints[3]; // BL

    const widthPixels = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
    const heightPixels = Math.sqrt((p3.x - p0.x) ** 2 + (p3.y - p0.y) ** 2);
    const pixelSpan = calibrationDimension === 'width' ? widthPixels : heightPixels;

    if (pixelSpan < 20) {
      Alert.alert(
        'Frame Too Small',
        'The measured frame appears too small on screen. Move closer to the frame and re-measure, then try calibrating again.'
      );
      return;
    }

    // Pinhole camera model: actualDepth = (knownDimension_cm * focalLength_px) / pixelSpan_px
    // This correctly estimates the real camera-to-surface distance.
    const fl = cameraIntrinsics.focalLength > 0
      ? cameraIntrinsics.focalLength
      : Dimensions.get('window').width * 0.8;
    const ppX = cameraIntrinsics.principalPointX > 0
      ? cameraIntrinsics.principalPointX
      : Dimensions.get('window').width / 2;
    const ppY = cameraIntrinsics.principalPointY > 0
      ? cameraIntrinsics.principalPointY
      : Dimensions.get('window').height / 2;

    const computedDepth = (knownValue * fl) / pixelSpan;

    // Recompute all 4 world points using the correctly estimated depth.
    // Using the same pinhole formula: worldCoord = (screenCoord - principalPoint) / focalLength * depth
    const recalculated = measurementPoints.map(pt => ({
      ...pt,
      worldX: ((pt.x - ppX) / fl) * computedDepth,
      worldY: ((pt.y - ppY) / fl) * computedDepth,
      worldZ: computedDepth,
    }));

    const [tl, tr, , bl] = recalculated;
    const newWidth = Math.sqrt(
      (tr.worldX - tl.worldX) ** 2 +
      (tr.worldY - tl.worldY) ** 2 +
      (tr.worldZ - tl.worldZ) ** 2
    );
    const newHeight = Math.sqrt(
      (bl.worldX - tl.worldX) ** 2 +
      (bl.worldY - tl.worldY) ** 2 +
      (bl.worldZ - tl.worldZ) ** 2
    );

    setMeasurementPoints(recalculated);
    setMeasurements({ width: newWidth, height: newHeight });
    setFocusDistance(computedDepth); // Correctly set as camera-to-surface depth
    setCalibrationFactor(1);         // Factor is now baked into the depth calculation
    setIsCalibrated(true);
    setDepthEstimationMode('manual'); // Use the calibrated focusDistance for new taps
    setShowCalibrationModal(false);
    setCalibrationDistance('');

    Alert.alert(
      'Calibration Complete',
      `Surface estimated ${computedDepth.toFixed(0)} cm from camera.\n\nUpdated measurements:\nWidth: ${newWidth.toFixed(1)} cm\nHeight: ${newHeight.toFixed(1)} cm\n\nFuture taps will use this depth for accuracy.`
    );
  };
  
  const addReferencePoint = (screenX: number, screenY: number, realDepth: number) => {
    const worldPoint = screenToWorldCoordinateAR(screenX, screenY);
    const newRef = {
      screen: { x: screenX, y: screenY },
      world: { x: worldPoint.x, y: worldPoint.y, z: realDepth }
    };
    setReferencePoints(prev => [...prev, newRef]);
    setDepthEstimationMode('reference');
  };
  
  const clearReferencePoints = () => {
    setReferencePoints([]);
    setDepthEstimationMode('manual');
    setIsCalibrated(false);
  };

  const handleCloseCalibrationModal = () => {
    setShowCalibrationModal(false);
    setCalibrationDistance('');
    setCalibrationDimension('width');
  };

  // Adjust measurement depth based on device tilt
  const adjustDepthFromTilt = () => {
    const tiltAngle = Math.abs(deviceOrientation.pitch);
    const baseDepth = 100; // Base depth in cm
    const maxDepthAdjustment = 50; // Max adjustment based on tilt
    
    // More vertical = closer depth, more horizontal = further depth
    const depthAdjustment = (tiltAngle / 90) * maxDepthAdjustment;
    const newDepth = baseDepth + depthAdjustment;
    
    setMeasurementDepth(newDepth);
  };

  // Auto-adjust depth when device orientation changes with throttling
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      adjustDepthFromTilt();
    }, 100); // Throttle updates to prevent infinite re-renders
    
    return () => clearTimeout(timeoutId);
  }, [deviceOrientation.pitch]); // Only depend on pitch, not the whole object

  // Modal JSX - defined inline to prevent re-mounting on state changes
  const saveModalJSX = (
    <Modal
      visible={showSaveModal}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseModal}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Save Measurement</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={handleCloseModal}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalScrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Name *</Text>
              <TextInput
                style={styles.modalTextInput}
                value={measurementName}
                onChangeText={setMeasurementName}
                placeholder="e.g., Living Room Window"
                placeholderTextColor="#999"
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>
            
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.typeContainer}>
                {(['general', 'door', 'window', 'railing', 'wall'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      measurementType === type && styles.typeButtonActive
                    ]}
                    onPress={() => setMeasurementType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      measurementType === type && styles.typeButtonTextActive
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextArea]}
                value={measurementNotes}
                onChangeText={setMeasurementNotes}
                placeholder="Add any notes about this measurement..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                returnKeyType="done"
                textAlignVertical="top"
              />
            </View>
            
            {/* Show measurement summary */}
            <View style={styles.modalSummary}>
              <Text style={styles.modalSummaryTitle}>Frame Measurement:</Text>
              {measurements && (
                <>
                  <Text style={styles.modalSummaryText}>
                    Width: {measurements.width.toFixed(2)} cm
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    Height: {measurements.height.toFixed(2)} cm
                  </Text>
                  <Text style={styles.modalSummaryText}>
                    Points: {measurementPoints.length}/4
                  </Text>
                </>
              )}
            </View>
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={handleCloseModal}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButtonSave, isSaving && styles.modalButtonDisabled]}
              onPress={handleSaveMeasurement}
              disabled={isSaving}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonSaveText}>
                {isSaving ? 'Saving...' : 'Save Measurement'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // All Measurements Modal
  const allMeasurementsModalJSX = (
    <Modal
      visible={showAllMeasurements}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseAllMeasurements}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '90%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Saved Measurements</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={handleCloseAllMeasurements}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={[styles.modalScrollView, { maxHeight: 500 }]}
            showsVerticalScrollIndicator={true}
          >
            {savedMeasurements.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="straighten" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No saved measurements yet</Text>
                <Text style={styles.emptyStateSubtext}>Your saved measurements will appear here</Text>
              </View>
            ) : (
              savedMeasurements.map((measurement) => (
                <View key={measurement.id} style={styles.allMeasurementItem}>
                  <TouchableOpacity 
                    style={styles.allMeasurementInfo}
                    onPress={() => {
                      // Handle both old and new measurement formats
                      const measurementDisplay = measurement.distances 
                        ? (Array.isArray(measurement.distances)
                          ? `Measurements: ${measurement.distances.map((d, i) => `\n  Side ${i + 1}: ${d.toFixed(2)} cm`).join('')}`
                          : `Width: ${(measurement.distances as {width: number; height: number}).width?.toFixed(2) || 'N/A'} cm\nHeight: ${(measurement.distances as {width: number; height: number}).height?.toFixed(2) || 'N/A'} cm`)
                        : 'No measurements available';
                        
                      Alert.alert(
                        measurement.measurement_name,
                        `Type: ${measurement.measurement_type}\nCreated: ${new Date(measurement.created_at!).toLocaleString()}\n${measurementDisplay}\nNotes: ${measurement.notes || 'None'}`,
                        [
                          { text: 'Close' },
                          { 
                            text: 'Delete', 
                            style: 'destructive',
                            onPress: () => {
                              deleteMeasurement(measurement.id!, measurement.measurement_name);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.allMeasurementName}>{measurement.measurement_name}</Text>
                    <Text style={styles.allMeasurementType}>
                      {measurement.measurement_type.charAt(0).toUpperCase() + measurement.measurement_type.slice(1)}
                      {' • '}
                      {Array.isArray(measurement.distances) ? `${measurement.distances.length} measurements` : 'Frame measurement'}
                    </Text>
                    <Text style={styles.allMeasurementDate}>
                      Created: {new Date(measurement.created_at!).toLocaleString()}
                    </Text>
                    {measurement.notes && (
                      <Text style={styles.allMeasurementNotes} numberOfLines={2}>
                        Notes: {measurement.notes}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <View style={styles.allMeasurementActions}>
                    <TouchableOpacity
                      onPress={() => toggleFavorite(measurement.id!, measurement.is_favorite!)}
                      style={styles.actionButton}
                    >
                      <MaterialIcons 
                        name={measurement.is_favorite ? "favorite" : "favorite-border"} 
                        size={20} 
                        color={measurement.is_favorite ? "#ff6b6b" : "#ccc"} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteMeasurement(measurement.id!, measurement.measurement_name)}
                      style={styles.actionButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButtonCancel, { flex: 0, paddingHorizontal: 24 }]}
              onPress={handleCloseAllMeasurements}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Calibration Modal
  const calibrationModalJSX = (
    <Modal
      visible={showCalibrationModal}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCloseCalibrationModal}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Calibrate AR Measurements</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={handleCloseCalibrationModal}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            style={styles.modalScrollView}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            <View style={styles.calibrationInstructions}>
              <MaterialIcons name="straighten" size={48} color="#a81d1d" />
              <Text style={styles.calibrationInstructionTitle}>Frame Measurement Calibration:</Text>
              <Text style={styles.calibrationInstructionText}>
                1. Tap the 4 corners of a frame with a known real-world size{'\n'}
                2. Choose whether you know the Width or Height{'\n'}
                3. Enter the actual measurement in cm (e.g. 90cm wide door){'\n'}
                4. The system re-calculates depth and updates all measurements instantly{'\n'}
                Scroll down for the input section.{'\n'}
              </Text>
              
              {measurements && 'width' in measurements && 'height' in measurements && (
                <View style={styles.currentMeasurementInfo}>
                  <Text style={styles.currentMeasurementLabel}>Current frame measurement:</Text>
                  <Text style={styles.calibrationMeasurementValue}>
                    Width: {measurements.width.toFixed(2)} cm
                  </Text>
                  <Text style={styles.calibrationMeasurementValue}>
                    Height: {measurements.height.toFixed(2)} cm
                  </Text>
                  <Text style={styles.currentMeasurementLabel}>
                    Estimated depth: {focusDistance} cm
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Which dimension are you entering?</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, calibrationDimension === 'width' && styles.typeButtonActive]}
                  onPress={() => setCalibrationDimension('width')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeButtonText, calibrationDimension === 'width' && styles.typeButtonTextActive]}>
                    Width
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, calibrationDimension === 'height' && styles.typeButtonActive]}
                  onPress={() => setCalibrationDimension('height')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.typeButtonText, calibrationDimension === 'height' && styles.typeButtonTextActive]}>
                    Height
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>
                Actual {calibrationDimension === 'width' ? 'Width' : 'Height'} (cm) *
              </Text>
              <TextInput
                style={styles.modalTextInput}
                value={calibrationDistance}
                onChangeText={setCalibrationDistance}
                placeholder={calibrationDimension === 'width' ? 'e.g., 90 (standard door width)' : 'e.g., 210 (standard door height)'}
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            
            <View style={styles.calibrationTips}>
              <Text style={styles.calibrationTipsTitle}>3D Measurement Tips:</Text>
              <Text style={styles.calibrationTipText}>• Use &quot;Manual&quot; mode and adjust focus distance</Text>
              <Text style={styles.calibrationTipText}>• &quot;Auto&quot; mode uses device tilt for depth</Text>
              <Text style={styles.calibrationTipText}>• &quot;Reference&quot; mode uses calibrated points</Text>
              <Text style={styles.calibrationTipText}>• Hold device perpendicular to surface</Text>
              <Text style={styles.calibrationTipText}>• Ensure stable hand position</Text>
            </View>

            {/* Scroll hint */}
            <View style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={18} color="#aaa" />
              <Text style={styles.scrollHintText}>Scroll down for more</Text>
              <Ionicons name="chevron-down" size={18} color="#aaa" />
            </View>
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalButtonCancel}
              onPress={handleCloseCalibrationModal}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButtonSave, (!calibrationDistance.trim() || !measurements) && styles.modalButtonDisabled]}
              onPress={handleCalibration}
              disabled={!calibrationDistance.trim() || !measurements}
              activeOpacity={0.7}
            >
              <Text style={styles.modalButtonSaveText}>Calibrate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (showCamera) {
    if (!permission?.granted) {
      return (
        <View style={styles.cameraContainer}>
          {saveModalJSX}
          {allMeasurementsModalJSX}
          {calibrationModalJSX}
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        {saveModalJSX}
        {allMeasurementsModalJSX}
        {calibrationModalJSX}
        <CameraView style={styles.camera} facing="back">
          {/* Main tap area for placing points */}
          <Pressable 
            style={styles.cameraTouchArea}
            onPress={handleScreenTap}
          >
            {/* SVG Overlay for Frame Lines */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              {/* Draw rectangle frame when 4 points are available */}
              {measurementPoints.length === 4 && (
                <>
                  {/* Top edge */}
                  <Line
                    x1={measurementPoints[0].x}
                    y1={measurementPoints[0].y}
                    x2={measurementPoints[1].x}
                    y2={measurementPoints[1].y}
                    stroke="#00ff00"
                    strokeWidth="3"
                  />
                  {/* Right edge */}
                  <Line
                    x1={measurementPoints[1].x}
                    y1={measurementPoints[1].y}
                    x2={measurementPoints[2].x}
                    y2={measurementPoints[2].y}
                    stroke="#00ff00"
                    strokeWidth="3"
                  />
                  {/* Bottom edge */}
                  <Line
                    x1={measurementPoints[2].x}
                    y1={measurementPoints[2].y}
                    x2={measurementPoints[3].x}
                    y2={measurementPoints[3].y}
                    stroke="#00ff00"
                    strokeWidth="3"
                  />
                  {/* Left edge */}
                  <Line
                    x1={measurementPoints[3].x}
                    y1={measurementPoints[3].y}
                    x2={measurementPoints[0].x}
                    y2={measurementPoints[0].y}
                    stroke="#00ff00"
                    strokeWidth="3"
                  />
                </>
              )}
              
              {/* Draw temporary lines for partial frame */}
              {measurementPoints.length > 0 && measurementPoints.length < 4 && measurementPoints.map((point, index) => {
                if (index < measurementPoints.length - 1) {
                  const nextPoint = measurementPoints[index + 1];
                  return (
                    <Line
                      key={`temp-line-${index}`}
                      x1={point.x}
                      y1={point.y}
                      x2={nextPoint.x}
                      y2={nextPoint.y}
                      stroke="#ffff00"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  );
                }
                return null;
              })}
              
              {/* Draw points as circles with corner numbers */}
              {measurementPoints.map((point, index) => (
                <Circle
                  key={`circle-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="12"
                  fill="#00ff00"
                  stroke="#fff"
                  strokeWidth="2"
                />
              ))}
            </Svg>

            {/* Corner labels - pointer events disabled */}
            {measurementPoints.map((point, index) => (
              <View
                key={`label-${index}`}
                pointerEvents="none"
                style={[
                  styles.measurementPoint,
                  { left: point.x - 12, top: point.y - 12 }
                ]}
              >
                <Text style={styles.pointLabel}>
                  {index === 0 ? 'TL' : index === 1 ? 'TR' : index === 2 ? 'BR' : 'BL'}
                </Text>
              </View>
            ))}

            {/* Frame Dimension Labels - pointer events disabled */}
            {measurements && 'width' in measurements && 'height' in measurements && measurementPoints.length === 4 && (
              <>
                {/* Width Label (top edge) */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.distanceLabel,
                    { 
                      left: (measurementPoints[0].x + measurementPoints[1].x) / 2 - 35, 
                      top: (measurementPoints[0].y + measurementPoints[1].y) / 2 - 25 
                    }
                  ]}
                >
                  <Text style={styles.distanceText}>W: {measurements.width?.toFixed(1)} cm</Text>
                </View>
                
                {/* Height Label (right edge) */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.distanceLabel,
                    { 
                      left: (measurementPoints[1].x + measurementPoints[2].x) / 2 + 10, 
                      top: (measurementPoints[1].y + measurementPoints[2].y) / 2 - 12 
                    }
                  ]}
                >
                  <Text style={styles.distanceText}>H: {measurements.height?.toFixed(1)} cm</Text>
                </View>
              </>
            )}
          </Pressable>

          {/* Header - with stopPropagation */}
          <View style={styles.cameraHeader} pointerEvents="box-none">
            <TouchableOpacity 
              onPress={(e) => { e.stopPropagation(); closeCamera(); }} 
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>AR Measurement</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Compact instruction at top */}
          <View style={styles.compactInstruction} pointerEvents="none">
            <Text style={styles.compactInstructionText}>
              {measurementPoints.length === 0 && "Tap frame corners • Top-left → Top-right → Bottom-right → Bottom-left"}
              {measurementPoints.length === 1 && "Point 1/4 • Now tap top-right corner"}
              {measurementPoints.length === 2 && "Point 2/4 • Now tap bottom-right corner"} 
              {measurementPoints.length === 3 && "Point 3/4 • Now tap bottom-left corner"}
              {measurementPoints.length >= 4 && "✓ Frame measured • Ready to save"}
            </Text>
          </View>

          {/* Bottom Controls - Simplified */}
          <View style={styles.bottomControls} pointerEvents="box-none">
            {/* Measurement summary - compact */}
            {measurements && 'width' in measurements && 'height' in measurements && (
              <View style={styles.compactSummary} pointerEvents="none">
                <Text style={styles.compactSummaryText}>
                  Width: {measurements.width.toFixed(1)}cm • Height: {measurements.height.toFixed(1)}cm
                </Text>
              </View>
            )}
            
            {/* Control buttons */}
            <View style={styles.controlButtonsRow}>
              <View style={styles.undoStack}>
                <TouchableOpacity 
                  style={[styles.smallButton, styles.undoButton, measurementPoints.length === 0 && styles.disabledButton]}
                  onPress={(e) => { e.stopPropagation(); undoLastPoint(); }}
                  disabled={measurementPoints.length === 0}
                >
                  <Ionicons name="arrow-undo" size={20} color="#fff" />
                  <Text style={styles.smallButtonText}>Undo</Text>
                </TouchableOpacity>

                {measurementPoints.length >= 2 && (
                  <TouchableOpacity 
                    style={[styles.smallButton, styles.undoAllButton]}
                    onPress={(e) => { e.stopPropagation(); resetMeasurement(); }}
                  >
                    <MaterialIcons name="clear-all" size={20} color="#fff" />
                    <Text style={styles.smallButtonText}>Undo All</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.smallButton, styles.calibrateButton]}
                onPress={(e) => { e.stopPropagation(); startCalibration(); }}
              >
                <MaterialIcons name="tune" size={20} color="#fff" />
                <Text style={styles.smallButtonText}>Cal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.smallButton,
                  styles.saveButtonNew,
                  (measurementPoints.length < 4 || !measurements) && styles.disabledButton
                ]}
                onPress={(e) => { e.stopPropagation(); saveMeasurement(); }}
                disabled={measurementPoints.length < 4 || !measurements}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.smallButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {saveModalJSX}
      {allMeasurementsModalJSX}
      {calibrationModalJSX}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AR Measurement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <MaterialIcons name="straighten" size={48} color="#a81d1d" />
          <Text style={styles.infoTitle}>Frame Measurement Tool</Text>
          <Text style={styles.infoText}>
            Precisely measure the width and height of door and window frames by tapping the four corners. Perfect for custom product sizing.
          </Text>
        </View>

        {/* Feature List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="phone-portrait" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Hold phone steady while measuring</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="scan" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Tap frame corners in correct order</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="resize" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Calibrate for accurate results</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="save" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Save measurements for your order</Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startButton} onPress={startARMeasurement}>
          <MaterialIcons name="straighten" size={24} color="#fff" />
          <Text style={styles.startButtonText}>Start Measurement</Text>
        </TouchableOpacity>

        {/* Requirements */}
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>📋 How to Measure Frame:</Text>
          <Text style={styles.requirementText}>1. Hold your phone parallel to the frame surface</Text>
          <Text style={styles.requirementText}>2. Keep phone steady - don&apos;t move while tapping</Text>
          <Text style={styles.requirementText}>3. Tap corners in order: Top-left → Top-right → Bottom-right → Bottom-left</Text>
          <Text style={styles.requirementText}>4. Calibrate with a known measurement for accuracy</Text>
        </View>

        {measurements && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Frame Measurement:</Text>
            <View style={styles.measurementRow}>
              <Text style={styles.measurementLabel}>Width:</Text>
              <Text style={styles.measurementValue}>{measurements.width.toFixed(2)} cm</Text>
            </View>
            <View style={styles.measurementRow}>
              <Text style={styles.measurementLabel}>Height:</Text>
              <Text style={styles.measurementValue}>{measurements.height.toFixed(2)} cm</Text>
            </View>
          </View>
        )}
        
        {/* Saved Measurements Section */}
        {user && savedMeasurements.length > 0 && (
          <View style={styles.savedMeasurementsCard}>
            <View style={styles.savedMeasurementsHeader}>
              <Text style={styles.savedMeasurementsTitle}>Your Saved Measurements ({savedMeasurements.length})</Text>
              <TouchableOpacity onPress={loadSavedMeasurements}>
                <Ionicons name="refresh" size={20} color="#a81d1d" />
              </TouchableOpacity>
            </View>
            {savedMeasurements.slice(0, 3).map((measurement) => (
              <View key={measurement.id} style={styles.savedMeasurementItem}>
                <TouchableOpacity 
                  style={styles.savedMeasurementInfo}
                  onPress={() => {
                    Alert.alert(
                      measurement.measurement_name,
                      `Type: ${measurement.measurement_type}\nCreated: ${new Date(measurement.created_at!).toLocaleString()}\nMeasurement: ${!Array.isArray(measurement.distances) && typeof measurement.distances === 'object' && measurement.distances.width && measurement.distances.height ? `Width: ${measurement.distances.width.toFixed(1)}cm, Height: ${measurement.distances.height.toFixed(1)}cm` : `${Array.isArray(measurement.distances) ? measurement.distances.length : 0} measurements`}\nNotes: ${measurement.notes || 'None'}`,
                      [
                        { text: 'Close' },
                        { 
                          text: 'Delete', 
                          style: 'destructive',
                          onPress: () => deleteMeasurement(measurement.id!, measurement.measurement_name)
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.savedMeasurementName}>{measurement.measurement_name}</Text>
                  <Text style={styles.savedMeasurementType}>
                    {measurement.measurement_type.charAt(0).toUpperCase() + measurement.measurement_type.slice(1)}
                    {' • '}
                    {!Array.isArray(measurement.distances) && typeof measurement.distances === 'object' && measurement.distances.width && measurement.distances.height ? 'Frame measurement' : `${Array.isArray(measurement.distances) ? measurement.distances.length : 0} measurements`}
                    {' • '}
                    {new Date(measurement.created_at!).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleFavorite(measurement.id!, measurement.is_favorite!)}
                  style={styles.favoriteButton}
                >
                  <MaterialIcons 
                    name={measurement.is_favorite ? "favorite" : "favorite-border"} 
                    size={20} 
                    color={measurement.is_favorite ? "#ff6b6b" : "#ccc"} 
                  />
                </TouchableOpacity>
              </View>
            ))}
            {savedMeasurements.length > 3 && (
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={handleViewAllMeasurements}
              >
                <Text style={styles.viewAllButtonText}>View All Measurements →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 48,
    marginBottom: 16,
  },
  placeholderSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  cameraSimulation: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  cameraTouchArea: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  instructionBox: {
    position: 'absolute',
    top: 190,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 5,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  measurementPoint: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 0, 0.9)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointLabel: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
  },
  measurementLineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 30,
    left: 10,
    right: 10,
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  controlButton: {
    backgroundColor: 'rgba(168, 29, 29, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: 'rgba(11, 159, 52, 0.9)',
  },
  warningButton: {
    backgroundColor: 'rgba(255, 170, 0, 0.9)',
  },
  disabledButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.6)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  distanceLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  distanceText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
  },
  measurementSummary: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  summaryText: {
    color: '#00ff00',
    fontSize: 14,
    marginBottom: 4,
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  currentMeasurement: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  currentMeasurementTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  currentMeasurementValue: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#a81d1d',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  infoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 16,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresList: {
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  featureText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  startButton: {
    backgroundColor: '#a81d1d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  requirementsCard: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ffe066',
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  requirementText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  resultsCard: {
    backgroundColor: '#e8f9ef',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#0b9f34',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementLabel: {
    fontSize: 16,
    color: '#666',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0b9f34',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  modalTextInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
  },
  typeButtonActive: {
    backgroundColor: '#a81d1d',
    borderColor: '#a81d1d',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSummary: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modalSummaryText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalButtonSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#a81d1d',
    alignItems: 'center',
  },
  modalButtonSaveText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  modalButtonDisabled: {
    backgroundColor: '#ccc',
  },
  // Saved measurements styles
  savedMeasurementsCard: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#a81d1d',
  },
  savedMeasurementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  savedMeasurementsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
  },
  savedMeasurementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  savedMeasurementInfo: {
    flex: 1,
  },
  savedMeasurementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  savedMeasurementType: {
    fontSize: 12,
    color: '#666',
  },
  favoriteButton: {
    padding: 8,
  },
  viewAllButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewAllButtonText: {
    fontSize: 14,
    color: '#a81d1d',
    fontWeight: '600',
  },
  // All measurements modal styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  allMeasurementItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  allMeasurementInfo: {
    flex: 1,
    marginRight: 12,
  },
  allMeasurementName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  allMeasurementType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  allMeasurementDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  allMeasurementNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  allMeasurementActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  // AR Status and Calibration styles
  arStatusBar: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 10,
  },
  arStatusItem: {
    alignItems: 'center',
    flex: 1,
  },
  arStatusLabel: {
    fontSize: 10,
    color: '#ccc',
    marginBottom: 2,
  },
  arStatusValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Calibration modal styles
  calibrationInstructions: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  calibrationInstructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  calibrationInstructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  currentMeasurementInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#e8f9ef',
    borderRadius: 6,
    alignItems: 'center',
  },
  currentMeasurementLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  calibrationMeasurementValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b9f34',
  },
  calibrationTips: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  calibrationTipsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  calibrationTipText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
    paddingLeft: 8,
  },
  scrollHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  scrollHintText: {
    color: '#999',
    fontSize: 12,
    marginHorizontal: 8,
  },
  
  // Depth Control Styles
  depthControls: {
    position: 'absolute',
    bottom: 220,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    zIndex: 10,
  },
  depthControlButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  depthControlText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  activeDepthControl: {
    color: '#00ff00',
    fontWeight: 'bold',
  },
  clearRefButton: {
    backgroundColor: 'rgba(255,0,0,0.3)',
  },
  clearRefText: {
    color: '#ff6b6b',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Depth Slider Styles
  depthSliderContainer: {
    position: 'absolute',
    bottom: 270,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    alignItems: 'center',
    zIndex: 10,
  },
  depthSliderLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  depthSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  depthAdjustButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depthAdjustText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  depthSlider: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  depthRangeText: {
    color: '#ccc',
    fontSize: 12,
  },
  
  // New compact UI styles
  compactInstruction: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  compactInstructionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 30,
    left: 10,
    right: 10,
  },
  compactSummary: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  compactSummaryText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
  controlButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  undoStack: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 6,
  },
  undoButton: {
    backgroundColor: 'rgba(100, 100, 100, 0.9)',
  },
  undoAllButton: {
    backgroundColor: 'rgba(180, 60, 60, 0.9)',
  },
  calibrateButton: {
    backgroundColor: 'rgba(255, 170, 0, 0.9)',
  },
  saveButtonNew: {
    backgroundColor: 'rgba(11, 159, 52, 0.9)',
  },
});
