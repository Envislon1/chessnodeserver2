
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
    
    // Check if last_random_value column exists by attempting a query
    const { data: columnCheck, error: columnError } = await supabase
      .from('inverter_systems')
      .select('last_random_value')
      .limit(1);
      
    let columnsExist = !columnError;
    
    console.log("Database access confirmed with RLS enabled");
    console.log("Required columns exist:", columnsExist);
    
    // If columns don't exist, run the migration
    if (!columnsExist) {
      console.log("Columns don't exist, running migration...");
      const migrationResult = await runLastSeenMigration();
      
      if (!migrationResult.success) {
        return { 
          success: false, 
          error: migrationResult.error,
          message: "Failed to add required columns. Please contact support."
        };
      }
      
      console.log("Successfully ran migration");
      return { 
        success: true, 
        message: "Migration completed successfully",
        columnsExist: true
      };
    }
    
    return { 
      success: true, 
      message: "Database access checked with RLS enabled",
      columnsExist
    };
  } catch (error) {
    console.error("Error in ensureFirebaseIdColumn:", error);
    return { success: false, error };
  }
};

// Function to manually run the migrations
export const runLastSeenMigration = async () => {
  try {
    // First try the edge function approach
    try {
      const { data, error } = await supabase.functions.invoke('run-migrations', {
        body: { migration: 'add_last_seen_columns' }
      });
      
      if (error) {
        console.error("Error running migration via edge function:", error);
        // Continue to fallback method instead of returning early
      } else {
        console.log("Migration via edge function successful");
        return { success: true, data };
      }
    } catch (e) {
      console.error("Exception in edge function migration:", e);
      // Continue to fallback method
    }
    
    // Fallback: Try to run the function directly
    try {
      const { data, error } = await supabase.rpc('run_add_last_seen_columns');
      
      if (error) {
        console.error("Error running rpc migration function:", error);
        return { success: false, error };
      }
      
      console.log("Migration via RPC successful");
      return { success: true, data };
    } catch (e) {
      console.error("Exception in RPC migration:", e);
      return { success: false, error: e };
    }
  } catch (error) {
    console.error("Error in runLastSeenMigration:", error);
    return { success: false, error };
  }
};

// New function to directly query last seen data with better error handling
export const getDeviceLastSeenData = async (systemId: string) => {
  try {
    // First check if columns exist
    const columnsCheck = await checkLastSeenColumnsExist();
    
    if (!columnsCheck.exists) {
      console.log("Last seen columns don't exist yet. Running migration...");
      await runLastSeenMigration();
      // Give the migration a moment to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Try to query with the columns
    try {
      const { data, error } = await supabase
        .from('inverter_systems')
        .select('last_seen_at, last_random_value')
        .eq('system_id', systemId)
        .single();
        
      if (error) {
        console.error("Error fetching device last seen data:", error);
        
        // Fallback to just getting the system data without the columns
        const { data: basicData } = await supabase
          .from('inverter_systems')
          .select('*')
          .eq('system_id', systemId)
          .single();
          
        return basicData;
      }
      
      return data;
    } catch (error) {
      console.error("Exception in getDeviceLastSeenData:", error);
      return null;
    }
  } catch (error) {
    console.error("Exception in getDeviceLastSeenData top level:", error);
    return null;
  }
};

// Helper function to check if the last_seen columns exist
async function checkLastSeenColumnsExist() {
  try {
    // Try to access the last_seen_at column
    const { data, error } = await supabase
      .from('inverter_systems')
      .select('last_seen_at, last_random_value')
      .limit(1);
      
    if (error) {
      console.error("Error checking for last_seen columns:", error);
      return { exists: false, error };
    }
    
    return { exists: true };
  } catch (error) {
    console.error("Exception checking for last_seen columns:", error);
    return { exists: false, error };
  }
}
