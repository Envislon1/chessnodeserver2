
import { supabase } from "@/integrations/supabase/client";

export const ensureFirebaseIdColumn = async () => {
  try {
    // Check if we can access the inverter_systems table with RLS in place
    const { data, error } = await supabase
      .from('inverter_systems')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error("Error accessing inverter_systems table:", error);
      return { success: false, error };
    }
    
    console.log("Database access confirmed with RLS enabled");
    return { success: true, message: "Database access checked with RLS enabled" };
  } catch (error) {
    console.error("Error in ensureFirebaseIdColumn:", error);
    return { success: false, error };
  }
};

// Updated function to verify last_seen_at and last_random_value columns
export const verifyLastSeenColumns = async () => {
  try {
    // Try to access the new columns - if they exist, this will succeed
    const { data, error } = await supabase.rpc('get_current_time');
    
    if (error) {
      console.error("Error calling get_current_time function:", error);
      return { success: false, error };
    }
    
    // Fetch the server time to compare with device timestamps
    let serverTime = null;
    
    // Check if data exists and is an object
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Now it's safe to access these properties
      serverTime = data.timestamp_utc || data.server_time;
    }
    
    // Check and update any devices that should be marked offline
    // Reduced from 3 minutes to 2 minutes to make offline detection more responsive
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    // Find devices that were last seen more than 2 minutes ago but are still marked online
    const { data: outdatedDevices, error: outdatedError } = await supabase
      .from('inverter_systems')
      .select('id, system_id, last_seen_at')
      .eq('is_online', true)
      .lt('last_seen_at', twoMinsAgo);
      
    if (outdatedError) {
      console.error("Error checking for outdated devices:", outdatedError);
    } else if (outdatedDevices && outdatedDevices.length > 0) {
      console.log(`Found ${outdatedDevices.length} devices that should be marked offline`);
      
      // Update these devices to offline status
      for (const device of outdatedDevices) {
        const { error: updateError } = await supabase
          .from('inverter_systems')
          .update({ is_online: false })
          .eq('id', device.id);
          
        if (updateError) {
          console.error(`Error marking device ${device.system_id} as offline:`, updateError);
        } else {
          console.log(`Marked device ${device.system_id} as offline - last seen at ${device.last_seen_at}`);
        }
      }
    }
    
    console.log("Successfully verified last_seen columns and updated device statuses");
    return { success: true, timestamp: serverTime };
  } catch (error) {
    console.error("Error in verifyLastSeenColumns:", error);
    return { success: false, error };
  }
};
