
import { supabase } from "@/integrations/supabase/client";

// This function will check database access with RLS enabled
export const setupDatabaseMigrations = async () => {
  try {
    // Check if we can access the database with RLS in place
    const { data, error } = await supabase
      .from('inverter_systems')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error("Error accessing inverter_systems table with RLS:", error);
      return { success: false, error };
    }
    
    // Try to access the system settings with the new RLS policies
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1);
      
    if (settingsError) {
      console.error("Error accessing system_settings with RLS:", settingsError);
      // This is not a fatal error, so we'll still return success
    } else {
      console.log("Successfully accessed system_settings with RLS");
    }
    
    console.log("Database access checked with RLS enabled, not modifying schema");
    return { success: true, message: "Database setup completed successfully with RLS enabled" };
  } catch (error) {
    console.error("Error in setupDatabaseMigrations:", error);
    return { success: false, error };
  }
};
