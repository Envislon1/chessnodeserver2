import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface InverterDataLog {
  power: number;
  battery_percentage: number;
  battery_voltage: number;
  voltage: number;
  current: number;
  mains_present: boolean;
  solar_present: boolean;
  frequency: number;
  power_factor: number;
  energy: number;
}

/**
 * Logs inverter data to Supabase
 * @param system_id The system ID to log data for
 * @param data The data to log
 * @returns Promise<boolean> True if successful
 */
export const logInverterData = async (
  system_id: string,
  data: InverterDataLog
): Promise<boolean> => {
  try {
    // Extract key data points for logging
    const {
      power,
      battery_percentage,
      battery_voltage,
      voltage,
      current,
      mains_present,
      solar_present,
      frequency,
      power_factor,
      energy,
    } = data;

    // Insert data point into Supabase - use the "inverter_parameters" table
    const { error } = await supabase.from("inverter_parameters").insert({
      inverter_id: system_id,
      output_power: typeof power === 'string' ? parseFloat(power) : power,
      battery_percentage,
      battery_voltage,
      voltage,
      output_voltage: voltage, // Fixed: use voltage instead of undefined output_voltage
      frequency,
      power_factor,
      energy: energy,
      mains_present,
      solar_present,
      timestamp: new Date().toISOString()
    });

    if (error) {
      console.error("Error logging inverter data:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Exception in logInverterData:", error);
    return false;
  }
};

/**
 * Sets up automatic inverter data logging
 * @param systemId The system ID to log data for
 * @param firebaseData The Firebase data to monitor
 * @param interval The interval in milliseconds to log data (default: 5 minutes)
 * @returns A cleanup function to call when done
 */
export const setupAutomaticDataLogging = (
  systemId: string | null, 
  firebaseData: any, 
  interval = 5 * 60 * 1000 // Default to 5 minutes
): (() => void) => {
  if (!systemId || !firebaseData) {
    return () => {}; // No-op cleanup if no valid input
  }
  
  // Initial data log when first setting up
  if (firebaseData) {
    logDataIfValid(systemId, firebaseData);
  }
  
  // Set up the interval timer for periodic logging
  const timerId = setInterval(() => {
    if (firebaseData) {
      logDataIfValid(systemId, firebaseData);
    }
  }, interval);

  // Return cleanup function
  return () => {
    clearInterval(timerId);
  };
};

/**
 * Helper function to validate and log data
 */
const logDataIfValid = (systemId: string, data: any) => {
  // Check if we have essential data points before logging
  if (data && 
      // Convert undefined to 0, parse string to number if needed
      (data.power !== undefined || data.load !== undefined) && 
      data.battery_voltage !== undefined) {
    
    // Extract power from the appropriate field
    const powerValue = data.power !== undefined ? data.power : data.load;
    
    // Log the data
    logInverterData(systemId, {
      power: typeof powerValue === 'string' ? parseFloat(powerValue) : Number(powerValue),
      battery_percentage: data.battery_percentage || 0,
      battery_voltage: data.battery_voltage || 0,
      voltage: data.voltage || 0,
      current: data.current || 0,
      mains_present: data.mains_present === true || data.mains_present === 1,
      solar_present: data.solar_present === true || data.solar_present === 1,
      frequency: data.frequency || 0,
      power_factor: data.power_factor || 0,
      energy: data.energy || 0
    });
  }
};

/**
 * Update the last seen timestamp for a specific inverter system,
 * using the actual database ID for the record (not system_id)
 * @param inverterId The inverter database ID (UUID)
 * @returns Promise<boolean> True if successful
 */
export const updateInverterLastSeen = async (inverterId: string): Promise<boolean> => {
  try {
    console.log(`Updating last seen timestamp for inverter ID: ${inverterId}`);
    
    // Update the last_seen field directly using the inverterId (UUID)
    const { error } = await supabase
      .from('inverter_systems')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', inverterId);
    
    if (error) {
      console.error(`Error updating last seen for inverter ${inverterId}:`, error);
      return false;
    }
    
    console.log(`Successfully updated last_seen for inverter ID: ${inverterId}`);
    return true;
  } catch (error) {
    console.error(`Exception in updateInverterLastSeen for ${inverterId}:`, error);
    return false;
  }
};

/**
 * Get the last seen timestamp for a specific inverter
 * @param inverterId The inverter ID to fetch data for
 * @returns Promise<string | null> ISO timestamp string or null
 */
export const getInverterLastSeen = async (inverterId: string): Promise<string | null> => {
  try {
    console.log(`Fetching last seen timestamp for inverter ID: ${inverterId}`);
    
    const { data, error } = await supabase
      .from('inverter_systems')
      .select('last_seen')
      .eq('id', inverterId)
      .single();
    
    if (error || !data) {
      console.error(`Error fetching last seen for inverter ${inverterId}:`, error);
      return null;
    }
    
    console.log(`Retrieved last_seen for inverter ${inverterId}: ${data.last_seen}`);
    return data.last_seen;
  } catch (error) {
    console.error(`Exception in getInverterLastSeen for ${inverterId}:`, error);
    return null;
  }
};

/**
 * Fetch historical inverter data from Supabase
 * @param inverterId The inverter ID to fetch data for
 * @param timeRange The time range to fetch data for ('hour', 'day', '48hours')
 * @returns Promise<any[]> Array of inverter data records
 */
export const fetchHistoricalInverterData = async (
  inverterId: string, 
  timeRange: 'hour' | 'day' | '48hours'
): Promise<any[]> => {
  try {
    // Calculate the start time based on the selected time range
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
        startTime = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24 hours
    }
    
    // Format the start time as an ISO string
    const startTimeString = startTime.toISOString();
    
    // Query the database for historical data
    const { data, error } = await supabase
      .from('inverter_parameters')
      .select('*')
      .eq('inverter_id', inverterId)
      .gte('timestamp', startTimeString)
      .order('timestamp', { ascending: true });
    
    if (error) {
      console.error("Error fetching historical inverter data:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Exception in fetchHistoricalInverterData:", error);
    return [];
  }
};

/**
 * Delete all inverter data for a specific inverter
 * @param inverterId The inverter ID to delete data for
 * @returns Promise<boolean> True if successful
 */
export const deleteAllInverterData = async (inverterId: string): Promise<boolean> => {
  try {
    // Delete all records for this inverter from the inverter_parameters table
    const { error } = await supabase
      .from('inverter_parameters')
      .delete()
      .eq('inverter_id', inverterId);
    
    if (error) {
      console.error("Error deleting inverter data:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Exception in deleteAllInverterData:", error);
    return false;
  }
};
