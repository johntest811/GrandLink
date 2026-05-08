// types/ARMeasurement.ts
export interface MeasurementPoint {
  x: number;
  y: number;
}

export interface DeviceInfo {
  platform: 'ios' | 'android';
  screenWidth: number;
  screenHeight: number;
  calibrationFactor: number;
  deviceModel?: string;
}

export interface ARMeasurement {
  id?: string;
  user_id?: string;
  measurement_name: string;
  measurement_type: 'door' | 'window' | 'railing' | 'wall' | 'ceiling' | 'floor' | 'general';
  points: MeasurementPoint[];
  distances: number[] | {width: number; height: number};
  total_measurements: number;
  unit: 'cm' | 'm' | 'ft' | 'in';
  created_at?: string;
  updated_at?: string;
  device_info?: DeviceInfo;
  notes?: string;
  is_favorite?: boolean;
}

export interface SaveMeasurementData {
  measurement_name: string;
  measurement_type: ARMeasurement['measurement_type'];
  points: MeasurementPoint[];
  distances: number[] | {width: number; height: number};
  unit: ARMeasurement['unit'];
  device_info?: DeviceInfo;
  notes?: string;
  is_favorite?: boolean;
}