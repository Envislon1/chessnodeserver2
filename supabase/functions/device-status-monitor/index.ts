
// Follow this setup guide to integrate the Deno runtime with your project:
// https://deno.land/manual/examples/supabase-functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';

const FIREBASE_URL = 'https://powerverter-pro-default-rtdb.firebaseio.com/';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

// Create a Supabase client with the service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Main handler function for the Edge Function
serve(async (req) => {
  try {
    // Parse the request to determine operation mode
    const { mode } = await req.json();
    
    // Check if this is a one-time status check or a scheduled execution
    if (mode === 'check_all') {
      const result = await checkAllDevices();
      return new Response(
        JSON.stringify({ success: true, devices_checked: result.devicesChecked, updates: result.updates }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } else if (mode === 'check_device') {
      const { device_id } = await req.json();
      if (!device_id) {
        throw new Error('device_id is required for check_device mode');
      }
      
      const result = await checkDeviceStatus(device_id);
      return new Response(
        JSON.stringify({ success: true, device: device_id, ...result }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    } else {
      throw new Error('Invalid mode specified. Use "check_all" or "check_device"');
    }
  } catch (error) {
    console.error('Error in device status monitor:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// Function to check all devices in the database
async function checkAllDevices() {
  // Get all device IDs from the database
  const { data: systems, error: fetchError } = await supabase
    .from('inverter_systems')
    .select('id, system_id, last_random_value');
  
  if (fetchError) {
    console.error('Error fetching devices:', fetchError);
    throw fetchError;
  }
  
  console.log(`Checking status for ${systems.length} devices`);
  
  // Process each device in parallel
  const results = await Promise.allSettled(
    systems.map(system => checkDeviceStatus(system.system_id, system.last_random_value))
  );
  
  // Count successful updates
  const updates = results.filter(
    result => result.status === 'fulfilled' && result.value.updated
  ).length;
  
  return { devicesChecked: systems.length, updates };
}

// Function to check a single device status
async function checkDeviceStatus(deviceId: string, lastKnownValue?: number) {
  try {
    if (!deviceId) {
      console.error('Invalid device ID');
      return { updated: false, error: 'Invalid device ID' };
    }
    
    console.log(`Checking device status for: ${deviceId}`);
    
    // Clean the device ID (remove any underscore prefix for Firebase data path)
    const cleanDeviceId = deviceId.replace(/^_+/, '');
    
    // Fetch the current random value from Firebase
    const response = await fetch(`${FIREBASE_URL}/${cleanDeviceId}.json`);
    
    if (!response.ok) {
      console.error(`Firebase error: ${response.status} ${response.statusText}`);
      return { updated: false, error: 'Firebase fetch failed' };
    }
    
    const data = await response.json();
    
    // Extract the random value (should be at index 20 in the data array)
    let currentRandomValue: number | null = null;
    
    if (data) {
      // Try to extract from hardware data string format
      if (data.data && typeof data.data === 'string') {
        const values = data.data.split(',');
        if (values.length >= 21) {
          currentRandomValue = parseInt(values[20]) || 0;
        }
      } 
      // Or check if it's in the random_value property
      else if (data.random_value !== undefined) {
        currentRandomValue = parseInt(data.random_value);
      }
      // Check if the last field in data string indicates device power state
      else if (data.data && typeof data.data === 'string') {
        const values = data.data.split(',');
        if (values.length >= 22) { 
          // Check position 21 (last element, zero-indexed) for inverter_state
          const inverterState = values[21] === "1" || values[21] === "true";
          console.log(`Device ${deviceId} inverter state from data: ${inverterState}`);
        }
      }
    }
    
    // If we couldn't get a random value, we can't check status
    if (currentRandomValue === null) {
      console.log(`No random value found for device ${deviceId}`);
      return { updated: false, error: 'No random value found' };
    }
    
    console.log(`Device ${deviceId} current random value: ${currentRandomValue}, last known: ${lastKnownValue}`);
    
    // Only update if the random value has changed or this is first check
    if (lastKnownValue === undefined || currentRandomValue !== lastKnownValue) {
      try {
        // First check if the required columns exist
        const { data: columnCheck, error: columnError } = await supabase.rpc('run_add_last_seen_columns');
        
        if (columnError) {
          console.warn('Warning: last_seen columns may not exist, trying anyway:', columnError);
        }
      } catch (e) {
        console.warn('Error checking for last_seen columns:', e);
      }
      
      // Update the last_random_value and last_seen_at in the database
      const updateData: Record<string, any> = {
        last_random_value: currentRandomValue,
        last_seen_at: new Date().toISOString() // The trigger will handle this, but we set it explicitly as well
      };
      
      const { data, error } = await supabase
        .from('inverter_systems')
        .update(updateData)
        .eq('system_id', cleanDeviceId);
      
      if (error) {
        console.error(`Error updating device status for ${deviceId}:`, error);
        
        // Special handling for 3415fysgfy514514e5 system
        if (cleanDeviceId === '3415fysgfy514514e5') {
          console.log('Special handling for 3415fysgfy514514e5 system');
          
          // Try a simplified update without the last_seen_at field (might be missing)
          const simpleUpdateData: Record<string, any> = {
            last_random_value: currentRandomValue
          };
          
          const { error: simpleError } = await supabase
            .from('inverter_systems')
            .update(simpleUpdateData)
            .eq('system_id', cleanDeviceId);
          
          if (simpleError) {
            console.error(`Simplified update also failed for ${deviceId}:`, simpleError);
            return { updated: false, error: simpleError.message };
          } else {
            console.log(`Successfully updated last_random_value for ${deviceId} with special handling`);
            return { 
              updated: true, 
              currentRandomValue,
              lastKnownValue,
              note: 'Used special handling for 3415fysgfy514514e5'
            };
          }
        }
        
        return { updated: false, error: error.message };
      }
      
      console.log(`Updated last seen for device ${deviceId}`);
      return { 
        updated: true, 
        currentRandomValue,
        lastKnownValue
      };
    }
    
    return { 
      updated: false, 
      reason: 'No change in random value',
      currentRandomValue,
      lastKnownValue
    };
  } catch (error) {
    console.error(`Error checking device ${deviceId}:`, error);
    return { updated: false, error: error.message };
  }
}
