// services/ARMeasurementService.ts
import { supabase } from '../app/supabaseClient';
import { ARMeasurement, SaveMeasurementData, MeasurementPoint, DeviceInfo } from '../types/ARMeasurement';
import { Dimensions, Platform } from 'react-native';

export class ARMeasurementService {
  /**
   * Save a new AR measurement to the database
   */
  static async saveMeasurement(data: SaveMeasurementData): Promise<{ success: boolean; data?: ARMeasurement; error?: string }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get device info
      const screenData = Dimensions.get('screen');
      const deviceInfo: DeviceInfo = {
        platform: Platform.OS as 'ios' | 'android',
        screenWidth: screenData.width,
        screenHeight: screenData.height,
        calibrationFactor: 0.5, // Current calibration factor
        ...data.device_info
      };

      // Prepare measurement data
      const measurementData = {
        user_id: user.id,
        measurement_name: data.measurement_name,
        measurement_type: data.measurement_type,
        points: data.points,
        distances: data.distances,
        total_measurements: data.distances.length,
        unit: data.unit,
        device_info: deviceInfo,
        notes: data.notes || '',
        is_favorite: data.is_favorite || false
      };

      // Insert into database
      const { data: result, error } = await supabase
        .from('ar_measurements')
        .insert([measurementData])
        .select()
        .single();

      if (error) {
        console.error('Error saving measurement:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: result };
    } catch (error: any) {
      console.error('Exception saving measurement:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Get all measurements for the current user
   */
  static async getUserMeasurements(): Promise<{ success: boolean; data?: ARMeasurement[]; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('ar_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching measurements:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Exception fetching measurements:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Delete a measurement
   */
  static async deleteMeasurement(measurementId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('ar_measurements')
        .delete()
        .eq('id', measurementId)
        .eq('user_id', user.id); // Ensure user can only delete their own measurements

      if (error) {
        console.error('Error deleting measurement:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Exception deleting measurement:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Update measurement as favorite/unfavorite
   */
  static async toggleFavorite(measurementId: string, isFavorite: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { error } = await supabase
        .from('ar_measurements')
        .update({ is_favorite: isFavorite })
        .eq('id', measurementId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating favorite:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Exception updating favorite:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }

  /**
   * Get measurement by ID
   */
  static async getMeasurementById(measurementId: string): Promise<{ success: boolean; data?: ARMeasurement; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('ar_measurements')
        .select('*')
        .eq('id', measurementId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching measurement:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Exception fetching measurement:', error);
      return { success: false, error: error.message || 'Unknown error occurred' };
    }
  }
}