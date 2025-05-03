
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LoadSwitch {
  id: string;
  name: string;
  state: boolean;
  load_number: number;
}

export const useInverterAndLoadsSwitches = (inverterId: string) => {
  const [systemId, setSystemId] = useState<string | null>(null);
  const [firebaseId, setFirebaseId] = useState<string | null>(null);
  const [loads, setLoads] = useState<LoadSwitch[]>([]);
  const [inverterState, setInverterState] = useState(false);

  // Get system ID from the database
  useEffect(() => {
    const getSystemId = async () => {
      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('system_id')
          .eq('id', inverterId)
          .single();

        if (error) throw error;
        
        if (data && data.system_id) {
          setSystemId(data.system_id);
          
          // Create firebase_id from system_id
          const fbId = "_" + data.system_id;
          setFirebaseId(fbId);
          
          // Now fetch loads and initial state
          fetchLoads(data.system_id);
          subscribeToDeviceState(fbId);
        }
      } catch (error) {
        console.error('Error fetching system ID:', error);
      }
    };

    if (inverterId) {
      getSystemId();
    }
  }, [inverterId]);

  // Fetch the loads associated with this system
  const fetchLoads = async (sysId: string) => {
    try {
      const { data: loadsData, error: loadsError } = await supabase
        .from('inverter_loads')
        .select('*')
        .eq('system_id', sysId)
        .order('load_number');

      if (loadsError) throw loadsError;

      setLoads(loadsData as LoadSwitch[] || []);
    } catch (error) {
      console.error('Error fetching loads:', error);
    }
  };

  // Subscribe to device state changes
  const subscribeToDeviceState = async (fbId: string) => {
    try {
      // For Firebase, we want to store the system ID with an underscore prefix
      const cleanFirebaseId = fbId.startsWith('_') ? fbId : `_${fbId}`;
      
      // Subscribe to real-time updates
      const channel = supabase.channel(`device_${cleanFirebaseId}`);
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'device_data',
            filter: `device_id=eq.${fbId.replace(/^_+/, '')}`
          },
          (payload) => {
            handleDeviceUpdate(payload.new);
          }
        )
        .subscribe();

      // Also fetch initial state
      const { data, error } = await supabase
        .from('device_data')
        .select('*')
        .eq('device_id', fbId.replace(/^_+/, ''))
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        handleDeviceUpdate(data);
      }
    } catch (error) {
      console.error('Error setting up device subscription:', error);
    }
  };

  // Handle device updates from Supabase or Firebase
  const handleDeviceUpdate = (deviceData: any) => {
    if (!deviceData) return;

    // Set inverter state
    setInverterState(deviceData.power === 1);

    // Update load states if they exist in the payload
    for (let i = 1; i <= 6; i++) {
      const loadState = deviceData[`load_${i}`];
      if (loadState !== undefined) {
        setLoads(prev => prev.map(load => 
          load.load_number === i ? { ...load, state: loadState === 1 } : load
        ));
      }
    }
  };

  // Send control commands to Firebase (with underscore prefix)
  const setInverterAndLoads = async (newState: boolean) => {
    try {
      if (!firebaseId) throw new Error("System ID not available");

      // Prepare the update data
      const updateData = {
        system_id: firebaseId,  // This should include underscore for Firebase
        state: newState ? 1 : 0,
        user_email: "system@inverter-control.app",
        timestamp: new Date().toISOString()
      };

      // Call the Supabase Edge Function to update Firebase
      const { data, error } = await supabase.functions.invoke("inverter-control", {
        body: updateData
      });

      if (error) throw error;

      // Update local state
      setInverterState(newState);

      return true;
    } catch (error: any) {
      console.error('Error updating inverter state:', error);
      return false;
    }
  };

  // Set state for a single load
  const setSingleLoadAndAll = async (loadNumber: number, newState: boolean) => {
    try {
      if (!firebaseId) throw new Error("System ID not available");

      const updateData = {
        system_id: firebaseId, // This should include underscore for Firebase
        load_number: loadNumber,
        state: newState ? 1 : 0, 
        user_email: "system@inverter-control.app",
        timestamp: new Date().toISOString()
      };

      // Call the Supabase Edge Function to update Firebase
      const { data, error } = await supabase.functions.invoke("load-control", {
        body: updateData
      });

      if (error) throw error;

      // Update local state
      setLoads(prev => prev.map(load => 
        load.load_number === loadNumber ? { ...load, state: newState } : load
      ));

      return true;
    } catch (error: any) {
      console.error('Error updating load state:', error);
      return false;
    }
  };

  return {
    loads,
    setLoads,
    systemId,
    inverterState,
    setInverterAndLoads,
    setSingleLoadAndAll,
  };
};
