
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
    
    // Extract status indicator value (random_value or inverter_state)
    let statusValue: number | undefined = undefined;
    
    if (data.random_value !== undefined) {
      statusValue = data.random_value;
    } else if (data.inverter_state !== undefined) {
      statusValue = data.inverter_state ? 1 : 0;
    } else if (data.power !== undefined) {
      statusValue = data.power ? 1 : 0;
    }
    
    // Only update last_seen_at if we have a positive status value
    if (statusValue !== undefined && statusValue > 0) {
      try {
        // First, get the inverter system by device ID
        const { data: systems, error: systemsError } = await supabase
          .from('inverter_systems')
          .select('id, last_random_value')
          .eq('system_id', deviceId);
          
        if (systemsError) {
          console.error('Error getting inverter system:', systemsError.message);
        }
        else if (systems && systems.length > 0) {
          const system = systems[0];
          
          // Only update if status value has changed or it's the first update
          if (system.last_random_value !== statusValue) {
            const { error: updateError } = await supabase
              .from('inverter_systems')
              .update({
                last_seen_at: new Date().toISOString(),
                is_online: true,
                last_random_value: statusValue
              })
              .eq('id', system.id);
              
            if (updateError) {
              console.error('Error updating last_seen_at:', updateError.message);
            } else {
              console.log(`Updated last_seen_at and last_random_value (${statusValue}) for device ${deviceId}`);
            }
          }
        }
      } catch (err) {
        console.error('Error updating last_seen_at:', err);
      }
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
