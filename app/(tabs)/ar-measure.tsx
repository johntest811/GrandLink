import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Line, Circle } from 'react-native-svg';
import BottomNavBar from "@BottomNav/../components/BottomNav";

export default function ARMeasureScreen() {
  const router = useRouter();
  const [showCamera, setShowCamera] = useState(false);
  const [measurements, setMeasurements] = useState<Array<number>>([]);
  const [measurementPoints, setMeasurementPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [permission, requestPermission] = useCameraPermissions();

  const startARMeasurement = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed for AR measurement');
        return;
      }
    }
    setShowCamera(true);
    setMeasurementPoints([]);
    setMeasurements([]);
  };

  const handleScreenTap = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    const newPoint = { x: locationX, y: locationY };
    const updatedPoints = [...measurementPoints, newPoint];
    setMeasurementPoints(updatedPoints);

    // Calculate distances after adding point
    if (updatedPoints.length >= 2) {
      calculateMeasurement(updatedPoints);
    }
  };

  const calculateMeasurement = (points: Array<{ x: number; y: number }>) => {
    // Calculate distances between consecutive points
    const distances: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const pixelDistance = Math.sqrt(dx * dx + dy * dy);
      // Convert to cm (calibration factor)
      const distanceCm = pixelDistance * 0.5;
      distances.push(distanceCm);
    }
    setMeasurements(distances);
  };

  const closeCamera = () => {
    setShowCamera(false);
  };

  const saveMeasurement = () => {
    if (measurementPoints.length >= 4 && measurements.length >= 3) {
      const measurementText = measurements.map((dist, idx) => 
        `Side ${idx + 1}: ${dist.toFixed(2)} cm`
      ).join('\n');
      
      Alert.alert(
        'Save Measurement',
        `${measurementText}\n\nMeasurement saved! You can use these values for your order.`,
        [
          { text: 'OK', onPress: closeCamera }
        ]
      );
    } else {
      Alert.alert('Incomplete', 'Please tap at least 4 points to measure doors/windows/railings');
    }
  };

  const resetMeasurement = () => {
    setMeasurementPoints([]);
    setMeasurements([]);
  };

  if (showCamera) {
    if (!permission?.granted) {
      return (
        <View style={styles.cameraContainer}>
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} facing="back">
          <Pressable 
            style={styles.cameraTouchArea}
            onPress={handleScreenTap}
          >
            {/* SVG Overlay for Lines */}
            <Svg style={StyleSheet.absoluteFill}>
              {/* Draw lines between consecutive points */}
              {measurementPoints.map((point, index) => {
                if (index < measurementPoints.length - 1) {
                  const nextPoint = measurementPoints[index + 1];
                  return (
                    <Line
                      key={`line-${index}`}
                      x1={point.x}
                      y1={point.y}
                      x2={nextPoint.x}
                      y2={nextPoint.y}
                      stroke="#00ff00"
                      strokeWidth="3"
                    />
                  );
                }
                return null;
              })}
              
              {/* Draw points as circles */}
              {measurementPoints.map((point, index) => (
                <Circle
                  key={`circle-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="8"
                  fill="#00ff00"
                  stroke="#fff"
                  strokeWidth="2"
                />
              ))}
            </Svg>

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
                  {measurementPoints.length === 0 && "Tap to place the first corner"}
                  {measurementPoints.length > 0 && measurementPoints.length < 4 && `Tap to place corner ${measurementPoints.length + 1} (need 4+ points)`}
                  {measurementPoints.length >= 4 && "Tap to add more points or save measurement"}
                </Text>
              </View>

              {/* Point Labels */}
              {measurementPoints.map((point, index) => (
                <View
                  key={`label-${index}`}
                  style={[
                    styles.measurementPoint,
                    { left: point.x - 15, top: point.y - 15 }
                  ]}
                >
                  <Text style={styles.pointLabel}>{index + 1}</Text>
                </View>
              ))}

              {/* Distance Labels */}
              {measurements.map((distance, index) => {
                const midX = (measurementPoints[index].x + measurementPoints[index + 1].x) / 2;
                const midY = (measurementPoints[index].y + measurementPoints[index + 1].y) / 2;
                return (
                  <View
                    key={`distance-${index}`}
                    style={[
                      styles.distanceLabel,
                      { left: midX - 40, top: midY - 15 }
                    ]}
                  >
                    <Text style={styles.distanceText}>{distance.toFixed(1)} cm</Text>
                  </View>
                );
              })}

              {/* Bottom Controls */}
              <View style={styles.cameraControls}>
                <View style={styles.controlsRow}>
                  <TouchableOpacity 
                    style={styles.controlButton}
                    onPress={resetMeasurement}
                  >
                    <MaterialIcons name="refresh" size={24} color="#fff" />
                    <Text style={styles.controlButtonText}>Reset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      styles.controlButton,
                      styles.saveButton,
                      measurementPoints.length < 4 && styles.disabledButton
                    ]}
                    onPress={saveMeasurement}
                    disabled={measurementPoints.length < 4}
                  >
                    <MaterialIcons name="save" size={24} color="#fff" />
                    <Text style={styles.controlButtonText}>
                      Save ({measurementPoints.length}/4+)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Measurement Summary */}
                {measurements.length > 0 && (
                  <View style={styles.measurementSummary}>
                    <Text style={styles.summaryTitle}>Measurements:</Text>
                    {measurements.map((dist, idx) => (
                      <Text key={idx} style={styles.summaryText}>
                        Side {idx + 1}: {dist.toFixed(2)} cm
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        </CameraView>
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

        {measurements.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>Last Measurement:</Text>
            {measurements.map((distance, index) => (
              <View key={index} style={styles.measurementRow}>
                <Text style={styles.measurementLabel}>Side {index + 1}:</Text>
                <Text style={styles.measurementValue}>{distance.toFixed(2)} cm</Text>
              </View>
            ))}
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  distanceText: {
    color: '#00ff00',
    fontSize: 14,
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
});
