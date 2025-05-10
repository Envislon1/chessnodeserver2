
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, remove } from 'firebase/database';
import { supabase } from '@/integrations/supabase/client';

const firebaseConfig = {
  apiKey: "AIzaSyCaJJ-2ExS5uGcH7jQ_9jwbHFIKLrj8J54",
  databaseURL: "https://powerverter-pro-default-rtdb.firebaseio.com/",
};

const app = initializeApp(firebaseConfig);
export const firebaseDb = getDatabase(app);

/**
 * Generates a short URL for firmware update
 * This makes it easier for embedded devices with limited memory to receive updates
 */
export const generateShortFirmwareUrl = async (originalUrl: string) => {
  try {
    if (!originalUrl) {
      throw new Error("Invalid URL provided");
    }
    
    // Generate a unique short ID
    const shortId = Math.random().toString(36).substring(2, 8);
    
    // Calculate expiry date (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Store the URL mapping in Supabase
    const { data, error } = await supabase
      .from('firmware_url_mapping')
      .insert({
        short_id: shortId,
        original_url: originalUrl,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    
    return {
      shortId,
      shortUrl: `${window.location.origin}/fw/${shortId}`,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error: any) {
    console.error('Error generating short URL:', error);
    throw error;
  }
};

/**
 * Subscribes to device data without the "_" prefix
 * This is for reading sensor/inverter data like voltage, current, etc.
 */
export const subscribeToDeviceData = (deviceId: string, callback: (data: any) => void) => {
  if (!deviceId) {
    console.error("Invalid deviceId provided to subscribeToDeviceData:", deviceId);
    return () => {}; // Return empty unsubscribe function
  }
  
  // Ensure we're using the deviceId WITHOUT underscore prefix for reading device data
  const cleanDeviceId = deviceId.replace(/^_+/, '');
  console.log(`Subscribing to Firebase device data for: ${cleanDeviceId}`);
  const deviceRef = ref(firebaseDb, `/${cleanDeviceId}`);

  return onValue(deviceRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`Received Firebase data for ${cleanDeviceId}:`, data);
    
    if (data) {
      // Parse hardware data string if present
      if (data.data && typeof data.data === 'string') {
        try {
          const values = data.data.split(',');
          if (values.length >= 21) {  // Changed from 18 to 21 to include all required fields
            // Map hardware variables to our expected format
            const mappedData = {
              ...data,
              voltage: parseFloat(values[0]) || 0,
              current: parseFloat(values[1]) || 0,
              // Now storing as 'load' instead of 'power'
              load: parseFloat(values[2]) || 0,
              energy: parseFloat(values[3]) || 0,
              frequency: parseFloat(values[4]) || 0,
              power_factor: parseFloat(values[5]) || 0,
              mains_present: values[6] === "1", // Convert "1" to true, anything else to false
              solar_present: values[7] === "1", // Convert "1" to true, anything else to false
              nominal_voltage: parseFloat(values[8]) || 0,
              device_capacity: parseFloat(values[9]) || 0,
              battery_voltage: parseFloat(values[10]) || 0,
              apparent_power: parseFloat(values[11]) || 0,
              reactive_power: parseFloat(values[12]) || 0,
              voltage_peak_peak: parseFloat(values[13]) || 0,
              current_peak_peak: parseFloat(values[14]) || 0,
              battery_percentage: parseFloat(values[15]) || 0,
              load_percentage: parseFloat(values[16]) || 0,
              analog_reading: parseFloat(values[17]) || 0,
              power_control: parseInt(values[19]) || 0,
              random_value: parseInt(values[20]) || 0,
            };
            callback(mappedData);
            return;
          }
        } catch (e) {
          console.error("Error parsing hardware data string:", e);
          // Continue with regular processing below
        }
      }

      // Regular processing if not using hardware data format
      const formattedData = {
        ...data,
        // Ensure we have the load field (this was previously power)
        load: data.load ?? 0 
      };
      callback(formattedData);
    } else {
      console.warn(`No data received from Firebase for device ${cleanDeviceId}`);
      // Return default structure to prevent undefined errors
      callback({
        load: 0,
        voltage: 0,
        current: 0,
        energy: 0,
        frequency: 0,
        power_factor: 0,
      });
    }
  }, (error) => {
    console.error(`Firebase subscription error for device ${cleanDeviceId}:`, error);
  });
};

/**
 * Subscribes to control states (power, loads) with the "_" prefix
 * This is for reading control data like power state and load states
 */
export const subscribeToControlStates = (deviceId: string, callback: (data: any) => void) => {
  if (!deviceId) {
    console.error("Invalid deviceId provided to subscribeToControlStates:", deviceId);
    return () => {}; // Return empty unsubscribe function
  }
  
  // Ensure we're using the deviceId WITH underscore prefix for control data
  const controlDeviceId = deviceId.startsWith('_') ? deviceId : `_${deviceId}`;
  console.log(`Subscribing to Firebase control states for: ${controlDeviceId}`);
  const controlRef = ref(firebaseDb, `/${controlDeviceId}`);

  return onValue(controlRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`Received Firebase control data for ${controlDeviceId}:`, data);
    
    if (data) {
      // Extract only the control states we're interested in
      const controlData = {
        power: data.power ?? 0,
        load_1: data.load_1 ?? data.load1 ?? 0,
        load_2: data.load_2 ?? data.load2 ?? 0,
        load_3: data.load_3 ?? data.load3 ?? 0,
        load_4: data.load_4 ?? data.load4 ?? 0,
        load_5: data.load_5 ?? data.load5 ?? 0,
        load_6: data.load_6 ?? data.load6 ?? 0,
        lastUpdate: data.lastUpdate,
        lastUserPower: data.lastUserPower
      };
      callback(controlData);
    } else {
      console.warn(`No control data received from Firebase for device ${controlDeviceId}`);
      // Return default structure to prevent undefined errors
      callback({
        power: 0,
        load_1: 0,
        load_2: 0,
        load_3: 0,
        load_4: 0,
        load_5: 0,
        load_6: 0
      });
    }
  }, (error) => {
    console.error(`Firebase control subscription error for device ${controlDeviceId}:`, error);
  });
};

export const setDevicePowerState = async (deviceId: string, state: boolean) => {
  try {
    console.log(`Setting device ${deviceId} power state to ${state ? "ON" : "OFF"}`);
    
    if (!deviceId) {
      throw new Error("Invalid deviceId provided");
    }
    
    // Make sure we're using the correct Firebase path format with leading underscore
    const deviceRef = ref(firebaseDb, `/_${deviceId}`);
    
    // First get current data to preserve other fields
    const snapshot = await get(deviceRef);
    const currentData = snapshot.val() || {};
    
    // Get current user's email
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email || 'unknown';
    
    const updateData = {
      ...currentData,
      power: state ? 1 : 0,
      lastUserPower: userEmail,
      lastUpdate: new Date().toISOString()
    };
    
    console.log(`Updating Firebase with data:`, updateData);
    
    // Implement retry logic for Firebase updates
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!success && attempts < maxAttempts) {
      try {
        await set(deviceRef, updateData);
        success = true;
        console.log(`Successfully updated Firebase power state on attempt ${attempts + 1}`);
      } catch (error) {
        attempts++;
        console.error(`Firebase power update attempt ${attempts} failed:`, error);
        if (attempts >= maxAttempts) throw error;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Log to Supabase for auditing
    try {
      await supabase
        .from('scheduled_actions_log')
        .insert({
          system_id: deviceId,
          action: state ? "power_on" : "power_off",
          triggered_by: "manual_ui",
          details: { 
            user: userEmail, 
            timestamp: new Date().toISOString(),
            firebase_data: updateData
          }
        });
    } catch (error) {
      console.error('Error logging action to Supabase:', error);
      // Continue even if logging fails
    }
    
    return true;
  } catch (error) {
    console.error('Error setting device power state:', error);
    throw error;
  }
};

export const setDeviceLoadState = async (deviceId: string, loadNumber: number, state: boolean) => {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId provided");
    }
    
    console.log(`Setting device ${deviceId} load ${loadNumber} to ${state ? "ON" : "OFF"}`);
    // Ensure we're using the deviceId WITH underscore prefix for control data
    const controlDeviceId = deviceId.startsWith('_') ? deviceId : `_${deviceId}`;
    const deviceRef = ref(firebaseDb, `/${controlDeviceId}`);
    
    // First get current data to preserve other fields
    const snapshot = await get(deviceRef);
    const currentData = snapshot.val() || {};
    
    // Update the specific load state while preserving other load states and inverter state
    const loadStates = {
      load_1: currentData.load_1 ?? currentData.load1 ?? 0,
      load_2: currentData.load_2 ?? currentData.load2 ?? 0,
      load_3: currentData.load_3 ?? currentData.load3 ?? 0,
      load_4: currentData.load_4 ?? currentData.load4 ?? 0,
      load_5: currentData.load_5 ?? currentData.load5 ?? 0,
      load_6: currentData.load_6 ?? currentData.load6 ?? 0,
      power: currentData.power || 0, // Preserve inverter power state
    };
    
    // Update only the target load
    loadStates[`load_${loadNumber}`] = state ? 1 : 0;
    
    // Merge with current data and update timestamp
    const updateData = {
      ...currentData,
      ...loadStates,
      lastUpdate: new Date().toISOString()
    };
    
    console.log(`Updating Firebase with data:`, updateData);
    await set(deviceRef, updateData);
    
    return true;
  } catch (error) {
    console.error('Error setting device load state:', error);
    throw error;
  }
};

export const setAllDeviceStates = async (deviceId: string, updatePayload: any) => {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId provided");
    }
    
    console.log(`Setting all states for device ${deviceId}:`, updatePayload);
    // Ensure we're using the deviceId WITH underscore prefix for control data
    const controlDeviceId = deviceId.startsWith('_') ? deviceId : `_${deviceId}`;
    const deviceRef = ref(firebaseDb, `/${controlDeviceId}`);
    
    // Get current data to preserve fields not in the update
    const snapshot = await get(deviceRef);
    const currentData = snapshot.val() || {};
    
    // Get current user's email for logging
    let userEmail = 'unknown';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = user?.email || 'unknown';
    } catch (e) {
      console.error("Error getting user email:", e);
    }
    
    const finalData = {
      ...currentData,
      ...updatePayload,
      lastUserPower: userEmail,
      lastUpdate: new Date().toISOString(),
    };
    
    console.log(`Final data to be sent to Firebase:`, finalData);
    await set(deviceRef, finalData);
    
    return true;
  } catch (error) {
    console.error('Error updating all device states:', error);
    throw error;
  }
};

/**
 * Sends firmware update URL to device through Firebase
 * Now using double underscore prefix ("__") for the system ID
 */
export const sendFirmwareUpdateToDevice = async (deviceId: string, firmwareUrl: string) => {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId provided");
    }
    
    // Generate a short URL for embedded devices
    const shortUrlData = await generateShortFirmwareUrl(firmwareUrl);
    
    // Ensure we're using the deviceId with DOUBLE underscore prefix
    // Remove any existing underscores first to avoid multiple underscores
    const cleanDeviceId = deviceId.replace(/^_+/, '');
    const doubleUnderscoreDeviceId = `__${cleanDeviceId}`;
    
    console.log(`Sending firmware update to device ${doubleUnderscoreDeviceId} with URL: ${shortUrlData.shortUrl}`);
    
    // Create the path for the update
    const updateRef = ref(firebaseDb, `/${doubleUnderscoreDeviceId}/update`);
    
    // Set the update URL and additional info
    await set(updateRef, {
      url: firmwareUrl,
      short_url: shortUrlData.shortUrl,
      timestamp: new Date().toISOString(),
      version: firmwareUrl.split('_')[2] || 'latest' // Extract version from filename
    });
    
    return {
      success: true,
      shortUrl: shortUrlData.shortUrl
    };
  } catch (error) {
    console.error('Error sending firmware update:', error);
    throw error;
  }
};

/**
 * Clears the firmware update path after update is completed
 */
export const clearFirmwareUpdatePath = async (deviceId: string) => {
  try {
    if (!deviceId) {
      throw new Error("Invalid deviceId provided");
    }
    
    // Ensure we're using the deviceId with DOUBLE underscore prefix
    const cleanDeviceId = deviceId.replace(/^_+/, '');
    const doubleUnderscoreDeviceId = `__${cleanDeviceId}`;
    
    console.log(`Clearing firmware update path for device ${doubleUnderscoreDeviceId}`);
    
    // Create the path for the update
    const updateRef = ref(firebaseDb, `/${doubleUnderscoreDeviceId}/update`);
    
    // Remove the update node
    await remove(updateRef);
    
    return true;
  } catch (error) {
    console.error('Error clearing firmware update path:', error);
    throw error;
  }
};

/**
 * Subscribes to firmware update status from the device
 */
export const subscribeToFirmwareUpdateStatus = (deviceId: string, callback: (status: any) => void) => {
  if (!deviceId) {
    console.error("Invalid deviceId provided to subscribeToFirmwareUpdateStatus:", deviceId);
    return () => {}; // Return empty unsubscribe function
  }
  
  // Ensure we're using the deviceId with DOUBLE underscore prefix for firmware update status
  const cleanDeviceId = deviceId.replace(/^_+/, '');
  const doubleUnderscoreDeviceId = `__${cleanDeviceId}`;
  
  console.log(`Subscribing to firmware update status for: ${doubleUnderscoreDeviceId}`);
  const statusRef = ref(firebaseDb, `/${doubleUnderscoreDeviceId}/update_status`);
  
  return onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    console.log(`Received firmware update status for ${doubleUnderscoreDeviceId}:`, data);
    
    if (data) {
      callback(data);
    } else {
      // No status data available yet
      callback(null);
    }
  }, (error) => {
    console.error(`Firebase firmware status subscription error for device ${doubleUnderscoreDeviceId}:`, error);
  });
};
