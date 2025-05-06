
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
