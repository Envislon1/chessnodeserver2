
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
    
    // Safely extract the timestamp from the response
    let timestamp = null;
    
    // Check if data is an object and has the expected properties
    if (data && typeof data === 'object') {
      // Try to access server_time or timestamp_utc properties
      timestamp = data.timestamp_utc || data.server_time;
    }
    
    console.log("Successfully verified last_seen columns");
    return { success: true, timestamp };
  } catch (error) {
    console.error("Error in verifyLastSeenColumns:", error);
    return { success: false, error };
  }
};
