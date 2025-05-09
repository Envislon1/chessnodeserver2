import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToDeviceData, subscribeToControlStates, setAllDeviceStates } from "@/integrations/firebase/client";
import { ref, get } from "firebase/database";
import { firebaseDb } from "@/integrations/firebase/client";
import { toast } from "@/components/ui/use-toast";

interface LoadSwitch {
  id: string;
  name: string;
  state: boolean;
  load_number: number;
}

export const useInverterAndLoadsSwitches = (inverterId: string) => {
  const [systemId, setSystemId] = useState<string | null>(null);
  const [inverterState, setInverterState] = useState<boolean>(false);
  const [loads, setLoads] = useState<LoadSwitch[]>([]);
  const [deviceData, setDeviceData] = useState<any>(null);
  const [firebaseId, setFirebaseId] = useState<string | null>(null);
  
  // Fetch system_id based on inverterId
  useEffect(() => {
    let isMounted = true;
    const getSystemId = async () => {
      if (!inverterId) return;

      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('system_id')
          .eq('id', inverterId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching system_id:', error);
          return;
        }

        if (data?.system_id && isMounted) {
          console.log(`Retrieved system_id: ${data.system_id} for inverterId: ${inverterId}`);
          setSystemId(data.system_id);
          
          // Create firebase_id from system_id
          const fbId = "_" + data.system_id;
          setFirebaseId(fbId);
          
          // Now fetch loads and initial state
          fetchLoads(data.system_id);
          subscribeToDeviceState(fbId);
        }
      } catch (err) {
        console.error('Exception in getSystemId:', err);
      }
    };

    getSystemId();
    return () => { isMounted = false };
  }, [inverterId]);

  // Fetch loads by system_id for global sharing across all users connected to a system
  useEffect(() => {
    let isMounted = true;
    const fetchLoads = async () => {
      if (!systemId) return;

      try {
        const { data: systemLoads, error } = await supabase
          .from('inverter_loads')
          .select('*')
          .eq('system_id', systemId)
          .order('load_number');

        if (error) {
          console.error('Error fetching loads by system_id:', error);
          return;
        }

        if (systemLoads && isMounted) {
          console.log(`Retrieved ${systemLoads.length} loads for system_id: ${systemId}`);
          setLoads(
            systemLoads.map((load) => ({
              id: load.id,
              name: load.name,
              state: load.state || false,
              load_number: load.load_number,
            }))
          );
        }
      } catch (error) {
        console.error('Error in fetchSwitches (systemId):', error);
      }
    };

    if (systemId) {
      fetchLoads();
    }
    return () => { isMounted = false }
  }, [systemId]);

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
      
      // Set up Firebase subscriptions
      if (systemId) {
        // Use clean system ID without prefix for device data
        console.log(`Subscribing to device data for system: ${systemId}`);
        const unsubscribeDeviceData = subscribeToDeviceData(systemId, (data) => {
          if (data) {
            setDeviceData(data);
            console.log("Firebase device data received:", data);
          }
        });
        
        // Use prefixed system ID for control states
        console.log(`Subscribing to control states for system: ${systemId}`);
        const unsubscribeControlStates = subscribeToControlStates(systemId, (controlData) => {
          if (controlData) {
            // Update inverter power state
            if ("power" in controlData) {
              setInverterState(controlData.power === 1);
            }
            
            // Update load states
            setLoads((prevLoads) =>
              prevLoads.map((l) => {
                let val = controlData[`load_${l.load_number}`] ?? controlData[`load${l.load_number}`] ?? 0;
                return { ...l, state: val === 1 };
              })
            );
          }
        });
        
        return () => {
          unsubscribeDeviceData();
          unsubscribeControlStates();
        };
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
      if (!firebaseId && !systemId) throw new Error("System ID not available");
      
      // Use systemId if firebaseId is not available
      const fbId = firebaseId || (systemId ? `_${systemId}` : null);
      if (!fbId) throw new Error("Firebase ID not available");

      // 1. Prepare data shape for Firebase - control data
      const firebaseUpdate: any = {
        power: newState ? 1 : 0,
      };
      
      // Include current load states
      for (const load of loads) {
        firebaseUpdate[`load_${load.load_number}`] = load.state ? 1 : 0;
      }

      console.log(`Updating Firebase with data:`, firebaseUpdate);
      
      // 2. Use setAllDeviceStates for Firebase
      await setAllDeviceStates(systemId!, firebaseUpdate);
      console.log("Firebase update successful");

      // Update local state
      setInverterState(newState);
      
      return true;
    } catch (error: any) {
      console.error('Error updating inverter state:', error);
      toast({
        title: "Error",
        description: "Failed to update inverter state: " + error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Set state for a single load
  const setSingleLoadAndAll = async (loadNumber: number, newState: boolean) => {
    try {
      if (!firebaseId && !systemId) throw new Error("System ID not available");
      
      // Use systemId if firebaseId is not available
      const fbId = firebaseId || (systemId ? `_${systemId}` : null);
      if (!fbId) throw new Error("Firebase ID not available");

      // Change one load, keep others + inverter as is
      console.log(`Setting load ${loadNumber} to ${newState}`);
      const newLoads = loads.map((l) =>
        l.load_number === loadNumber ? { ...l, state: newState } : l
      );
      
      // 1. Prepare data for Firebase update
      const firebaseUpdate: any = {
        power: inverterState ? 1 : 0,
      };
      
      // Include all load states
      for (const load of newLoads) {
        firebaseUpdate[`load_${load.load_number}`] = load.state ? 1 : 0;
      }
      
      console.log(`Updating Firebase with data:`, firebaseUpdate);
      
      // 2. Use setAllDeviceStates for Firebase
      await setAllDeviceStates(systemId!, firebaseUpdate);
      console.log("Firebase update successful");

      // Update local state only if Firebase update was successful
      setLoads(newLoads);
      
      return true;
    } catch (error: any) {
      console.error('Error updating load state:', error);
      toast({
        title: "Error",
        description: "Failed to update load state: " + error.message,
        variant: "destructive",
      });
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
    deviceData,
  };
};
