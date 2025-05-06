
import { supabase } from "@/integrations/supabase/client";

export const logInverterData = async (deviceId: string, data: any): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('device_data')
      .insert([
        { 
          device_id: deviceId, 
          data: JSON.stringify(data),
          timestamp: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error('Error logging data to Supabase:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error logging data:', err);
    return false;
  }
};

// Function to fetch historical inverter data from Supabase based on time range
export const fetchHistoricalInverterData = async (inverterId: string, timeRange: 'hour' | 'day' | '48hours'): Promise<any[]> => {
  try {
    // Calculate the start time based on the time range
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
        break;
      case '48hours':
      default:
        startTime = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
        break;
    }
    
    // Query Supabase for device data
    const { data, error } = await supabase
      .from('device_data')
      .select('*')
      .eq('device_id', inverterId)
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: true });
      
    if (error) {
      console.error('Error fetching historical inverter data:', error.message);
      return [];
    }
    
    // Parse JSON data if it's stored as a string
    const processedData = data.map(record => {
      try {
        let parsedData: any = {};
        
        if (record.data && typeof record.data === 'string') {
          parsedData = JSON.parse(record.data);
        } else {
          parsedData = record.data || {};
        }
        
        // Extract power value for chart display
        const output_power = typeof parsedData.power === 'number' ? parsedData.power : 0;
        
        return {
          ...record,
          output_power,
          timestamp: record.timestamp
        };
      } catch (err) {
        console.error('Error parsing data record:', err);
        return {
          ...record,
          output_power: 0
        };
      }
    });
    
    return processedData;
  } catch (err) {
    console.error('Error in fetchHistoricalInverterData:', err);
    return [];
  }
};

// Function to delete all inverter data for a specific device from Supabase
export const deleteAllInverterData = async (deviceId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('device_data')
      .delete()
      .eq('device_id', deviceId);
      
    if (error) {
      console.error('Error deleting inverter data:', error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error in deleteAllInverterData:', err);
    return false;
  }
};

// Fixed setupAutomaticDataLogging function
export const setupAutomaticDataLogging = async (inverterId: string, firebaseData: any) => {
  if (!inverterId || !firebaseData) return;
  
  try {
    // Only log data if device is powered on
    if (firebaseData.power !== 1) return;
    
    // Log current state to Supabase
    // Ensure we're passing a number for the power value
    const powerValue = typeof firebaseData?.load === 'number' ? 
      firebaseData.load : 
      (typeof firebaseData?.real_power === 'number' ? 
        firebaseData.real_power : 
        parseFloat(String(firebaseData?.load || firebaseData?.real_power || '0')));
    
    await logInverterData(inverterId, {
      power: powerValue,
      battery_percentage: firebaseData?.battery_percentage,
      battery_voltage: firebaseData?.battery_voltage,
      voltage: firebaseData?.voltage,
      current: firebaseData?.current,
      mains_present: !!firebaseData?.mains_present,
      solar_present: !!firebaseData?.solar_present,
      frequency: firebaseData?.frequency,
      power_factor: firebaseData?.power_factor,
      energy: firebaseData?.energy
    });
    
    console.log('Successfully logged inverter data from Firebase');
  } catch (err) {
    console.error('Error in setupAutomaticDataLogging:', err);
  }
};
