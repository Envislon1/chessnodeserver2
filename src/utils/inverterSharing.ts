
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const findOrCreateSharedInverter = async (systemId: string) => {
  try {
    // Clean the system ID (remove any existing underscores at the start)
    const cleanSystemId = systemId.trim().replace(/^_+/, '');
    console.log("Looking for system with ID:", cleanSystemId);
    
    const userId = (await supabase.auth.getSession()).data.session?.user?.id;

    if (!userId) {
      return {
        success: false,
        message: "You must be logged in to connect to a shared inverter."
      };
    }

    // Check if this system exists - use ilike for case-insensitive comparison
    const { data: existingSystem, error: lookupError } = await supabase
      .from('inverter_systems')
      .select('*')
      .ilike('system_id', cleanSystemId)
      .limit(1)
      .maybeSingle();
      
    console.log("Existing system lookup result:", existingSystem);

    if (lookupError) {
      console.error("Lookup error:", lookupError);
      throw lookupError;
    }

    // Check if user already has this system
    const { data: userSystem, error: userSystemError } = await supabase
      .from('inverter_systems')
      .select('id')
      .eq('user_id', userId)
      .ilike('system_id', cleanSystemId)
      .maybeSingle();

    if (userSystemError) {
      console.error("User system error:", userSystemError);
      throw userSystemError;
    }

    if (userSystem) {
      return {
        success: false,
        message: "You've already added this system to your account."
      };
    }

    // If system exists, create a new entry for this user
    if (existingSystem) {
      // Generate Firebase ID with underscore if it doesn't exist
      const firebaseDeviceId = existingSystem.system_id ? `_${existingSystem.system_id}` : null;
      
      console.log("Creating shared inverter entry with Firebase ID:", firebaseDeviceId);
      
      const { error: insertError } = await supabase
        .from('inverter_systems')
        .insert({
          name: `Shared: ${existingSystem.name || cleanSystemId}`,
          location: existingSystem.location || "Unknown Location",
          model: existingSystem.model || "Standard Model",
          user_id: userId,
          system_id: cleanSystemId,
          firebase_id: firebaseDeviceId,
          shared: true
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }

      return {
        success: true,
        message: "Successfully connected to the shared inverter system."
      };
    } else {
      // System doesn't exist at all
      console.log("No system found with ID:", cleanSystemId);
      return {
        success: false,
        message: "This system ID doesn't exist. Please check the ID and try again."
      };
    }
  } catch (error: any) {
    console.error("Error in findOrCreateSharedInverter:", error);
    return {
      success: false,
      message: error.message || "Failed to connect to shared inverter."
    };
  }
};
