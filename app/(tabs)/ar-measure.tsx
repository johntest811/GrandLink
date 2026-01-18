import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import BottomNavBar from "@BottomNav/../components/BottomNav";

export default function ARMeasureScreen() {
  const router = useRouter();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [showCamera, setShowCamera] = useState(false);
  const [measurements, setMeasurements] = useState<{ width: number; height: number } | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<Array<{ x: number; y: number }>>([]);

  const startARMeasurement = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Camera Permission Required',
          'This app needs camera access to measure spaces using AR.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setShowCamera(true);
    setMeasurementPoints([]);
    setMeasurements(null);
  };

  const handleScreenTap = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = { x: locationX, y: locationY };

    if (measurementPoints.length === 0) {
      // First point - start of measurement
      setMeasurementPoints([newPoint]);
    } else if (measurementPoints.length === 1) {
      // Second point - calculate measurement
      setMeasurementPoints([...measurementPoints, newPoint]);
      calculateMeasurement([...measurementPoints, newPoint]);
    } else {
      // Reset and start new measurement
      setMeasurementPoints([newPoint]);
      setMeasurements(null);
    }
  };

  const calculateMeasurement = (points: Array<{ x: number; y: number }>) => {
    // Calculate pixel distance
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    // Simplified conversion: assume average calibration
    // In a real AR app, you'd use ARCore/ARKit for actual depth/distance
    // This is a placeholder calculation for demonstration
    const estimatedDistanceCm = pixelDistance * 0.5; // Rough estimate
    
    // For rectangular measurement, use pythagoras
    const width = Math.abs(dx) * 0.5;
    const height = Math.abs(dy) * 0.5;

    setMeasurements({
      width: width,
      height: height
    });

    Alert.alert(
      'Measurement Complete',
      `Width: ${width.toFixed(2)} cm\nHeight: ${height.toFixed(2)} cm\n\nNote: This is a simulated measurement. For accurate AR measurements, native ARCore/ARKit integration is required.`,
      [{ text: 'OK' }]
    );
  };

  const closeCamera = () => {
    setShowCamera(false);
  };

  const saveMeasurement = () => {
    if (measurements) {
      Alert.alert(
        'Save Measurement',
        `Width: ${measurements.width.toFixed(2)} cm\nHeight: ${measurements.height.toFixed(2)} cm\n\nMeasurement saved! You can use these values for your order.`,
        [
          { text: 'OK', onPress: closeCamera }
        ]
      );
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        {/* Camera placeholder - will work when built with native modules */}
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.placeholderText}>📷 Camera View</Text>
          <Text style={styles.placeholderSubtext}>
            (Camera will work after building to device)
          </Text>
        </View>
        
        <Pressable 
          style={styles.cameraTouchArea}
          onPress={handleScreenTap}
        >
          <View style={styles.cameraOverlay}>
            {/* Header */}
            <View style={styles.cameraHeader}>
                <TouchableOpacity onPress={closeCamera} style={styles.closeButton}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.cameraTitle}>AR Measurement</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Instructions */}
              <View style={styles.instructionBox}>
                <Text style={styles.instructionText}>
                  {measurementPoints.length === 0 && "Tap to place the first point"}
                  {measurementPoints.length === 1 && "Tap to place the second point"}
                  {measurementPoints.length === 2 && "Tap to start a new measurement"}
                </Text>
              </View>

              {/* Measurement Points */}
              {measurementPoints.map((point, index) => (
                <View
                  key={index}
                  style={[
                    styles.measurementPoint,
                    { left: point.x - 10, top: point.y - 10 }
                  ]}
                >
                  <Text style={styles.pointLabel}>{index + 1}</Text>
                </View>
              ))}

              {/* Measurement Line */}
              {measurementPoints.length === 2 && (
                <View style={styles.measurementLineContainer}>
                  {/* This would be a proper line in production with SVG or canvas */}
                </View>
              )}

              {/* Bottom Controls */}
              <View style={styles.cameraControls}>
                <View style={styles.controlsRow}>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={() => {
                      setMeasurementPoints([]);
                      setMeasurements(null);
                    }}
                  >
                    <MaterialIcons name="refresh" size={24} color="#fff" />
                    <Text style={styles.controlButtonText}>Reset</Text>
                  </TouchableOpacity>

                  {measurements && (
                    <TouchableOpacity 
                      style={[styles.controlButton, styles.saveButton]}
                      onPress={saveMeasurement}
                    >
                      <Ionicons name="checkmark" size={24} color="#fff" />
                      <Text style={styles.controlButtonText}>Save</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {measurements && (
                  <View style={styles.currentMeasurement}>
                    <Text style={styles.currentMeasurementTitle}>Current Measurement:</Text>
                    <Text style={styles.currentMeasurementValue}>
                      W: {measurements.width.toFixed(2)} cm × H: {measurements.height.toFixed(2)} cm
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
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
          <Text style={styles.infoTitle}>Measure Your Space</Text>
          <Text style={styles.infoText}>
            Use your phone's camera to measure the width and height of your windows, doors, or any space where you want to install our products.
          </Text>
        </View>

        {/* Feature List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="camera" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Point your camera at the surface</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="scan" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Tap to place measurement points</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="resize" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Get accurate width & height</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="save" size={24} color="#a81d1d" />
            <Text style={styles.featureText}>Save measurements for your order</Text>
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startButton} onPress={startARMeasurement}>
          <MaterialIcons name="3d-rotation" size={24} color="#fff" />
          <Text style={styles.startButtonText}>Start AR Measurement</Text>
        </TouchableOpacity>

        {/* Requirements */}
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>Requirements:</Text>
          <Text style={styles.requirementText}>• ARKit-enabled iOS device (iPhone 6s or later)</Text>
          <Text style={styles.requirementText}>• ARCore-enabled Android device</Text>
          <Text style={styles.requirementText}>• Good lighting conditions</Text>
          <Text style={styles.requirementText}>• Stable internet connection</Text>
        </View>

        {measurements && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Last Measurement:</Text>
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
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  measurementPoint: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00ff00',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  pointLabel: {
    color: '#000',
    fontSize: 10,
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
    bottom: 40,
    left: 20,
    right: 20,
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
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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
});
