import { supabase } from "@/integrations/supabase/client";

/**
 * Logs inverter power and battery data to Supabase for historical tracking
 * and performance optimization
 */
export const logInverterData = async (
  systemId: string, 
  data: {
    power?: number;
    battery_percentage?: number;
    battery_voltage?: number;
    timestamp?: string;
    load?: number;
    voltage?: number;
    current?: number;
    mains_present?: boolean;
    solar_present?: boolean;
    frequency?: number;
    power_factor?: number;
    energy?: number;
    is_surge?: boolean;
  }
) => {
  try {
    if (!systemId) return false;
    
    // Ensure we have a valid timestamp or generate one
    const timestamp = data.timestamp || new Date().toISOString();
    
    // Prepare the data to log - clean up undefined values
    const cleanData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) cleanData[key] = value;
    });
    
    // Insert data into the inverter_parameters table
    // Note: We're now omitting the is_surge field since it doesn't exist in the table
    const { data: result, error } = await supabase
      .from('inverter_parameters')
      .insert({
        inverter_id: systemId, // Associate with the inverter system ID
        battery_percentage: data.battery_percentage,
        battery_voltage: data.battery_voltage,
        output_power: data.power || data.load,
        acv_rms: data.voltage,
        acc_rms: data.current,
        mains_present: data.mains_present,
        solar_present: data.solar_present,
        frequency: data.frequency,
        power_factor: data.power_factor,
        energy_kwh: data.energy,
        timestamp: timestamp,
        // Removed is_surge field as it doesn't exist in the database schema
      });
      
    if (error) {
      console.error("Error logging inverter data to Supabase:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Exception logging inverter data:", error);
    return false;
  }
};

/**
 * Fetches historical inverter data from Supabase for a given time range
 */
export const fetchHistoricalInverterData = async (
  inverterId: string,
  timeRange: 'hour' | 'day' | 'week' | '48hours' = 'hour',
  limit: number = 30 // Reduced from 200 to 30 to support fewer data points
) => {
  try {
    // Calculate time range based on the selected period
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '48hours':
        startTime = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'hour':
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
    }
    
    console.log(`Fetching data from ${startTime.toISOString()} to ${now.toISOString()} for timeRange: ${timeRange}`);
    
    // Query the inverter_parameters table for historical data
    const { data, error } = await supabase
      .from('inverter_parameters')
      .select('*')
      .eq('inverter_id', inverterId)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', now.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error("Error fetching historical inverter data:", error);
      return null;
    }
    
    console.log(`Retrieved ${data?.length || 0} historical data points`);
    return data;
  } catch (error) {
    console.error("Exception fetching historical inverter data:", error);
    return null;
  }
};

// Custom type for surge data to track high power events
type SurgeData = {
  id: string;
  inverter_id: string;
  output_power: number;
  timestamp: string;
};

/**
 * Fetches only surge data from Supabase for a given time range
 * This function uses output_power thresholds instead of the is_surge flag
 */
export const fetchSurgeData = async (
  inverterId: string,
  timeRange: 'hour' | 'day' | 'week' | '48hours' = 'day',
  limit: number = 30, // Reduced from 100 to 30
  surgeThreshold: number = 3000 // Default surge threshold in watts
) => {
  try {
    // Calculate time range based on the selected period
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '48hours':
        startTime = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'hour':
      default:
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
    }
    
    // Query the inverter_parameters table for high power readings instead of surge flag
    const { data, error } = await supabase
      .from('inverter_parameters')
      .select('*')
      .eq('inverter_id', inverterId)
      .gte('output_power', surgeThreshold) // Filter by high power readings
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', now.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error("Error fetching surge data:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Exception fetching surge data:", error);
    return null;
  }
};

/**
 * Deletes all inverter data from Supabase for a specific inverter
 * This will remove ALL historical data including surges
 */
export const deleteAllInverterData = async (inverterId: string) => {
  try {
    if (!inverterId) {
      console.error("No inverter ID provided for deletion");
      return false;
    }
    
    // Delete all records for this inverter from the inverter_parameters table
    const { error } = await supabase
      .from('inverter_parameters')
      .delete()
      .eq('inverter_id', inverterId);
      
    if (error) {
      console.error("Error deleting inverter data:", error);
      return false;
    }
    
    // Also remove any stored data in localStorage to ensure it doesn't reappear
    localStorage.removeItem(`chartData_${inverterId}`);
    localStorage.removeItem(`surgeData_${inverterId}`);
    
    console.log(`Successfully deleted all data for inverter: ${inverterId}`);
    return true;
  } catch (error) {
    console.error("Exception deleting inverter data:", error);
    return false;
  }
};

/**
 * Automatically log system data to Supabase on a regular interval
 * regardless of user being logged in or not
 */
export const setupAutomaticDataLogging = (firebaseData: any, inverterId: string) => {
  if (!firebaseData || !inverterId) return null;
  
  // Setup interval to log data every 30 seconds (more frequent for continuous plots)
  const interval = setInterval(async () => {
    try {
      // Map Firebase data to our format
      const dataToLog = {
        power: firebaseData.power === 1 ? parseFloat(firebaseData?.load || '0') || 0 : 0,
        load: firebaseData.load || 0,
        battery_percentage: firebaseData.battery_percentage || 0,
        battery_voltage: firebaseData.battery_voltage || 0,
        voltage: firebaseData.voltage || 0,
        current: firebaseData.current || 0,
        mains_present: firebaseData.mains_present ? true : false,
        solar_present: firebaseData.solar_present ? true : false,
        frequency: firebaseData.frequency || 0,
        power_factor: firebaseData.power_factor || 0,
        energy: firebaseData.energy || 0,
        timestamp: new Date().toISOString()
      };
      
      // Check if this is a surge (over 80% of capacity)
      const deviceCapacity = firebaseData?.device_capacity || 3;
      const systemCapacity = deviceCapacity * 0.75;
      const surgeThreshold = systemCapacity * 800; // 80% of system capacity in watts
      
      // Log data to Supabase (without surge flag since it doesn't exist in schema)
      await logInverterData(inverterId, dataToLog);
      
      // If this is a surge event, log it separately via a console message
      if (dataToLog.power > surgeThreshold) {
        console.log(`Surge detected: ${dataToLog.power}W (threshold: ${surgeThreshold}W)`);
      }
      
      console.log("Automatic data logged to Supabase");
    } catch (err) {
      console.error("Error in automatic data logging:", err);
    }
  }, 30000); // Log every 30 seconds
  
  return () => clearInterval(interval);
};
