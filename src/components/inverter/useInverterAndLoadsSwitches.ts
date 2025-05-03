import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToDeviceData, subscribeToControlStates, setAllDeviceStates } from "@/integrations/firebase/client";
import { ref, get } from "firebase/database";
import { firebaseDb } from "@/integrations/firebase/client";
import { toast } from "@/components/ui/use-toast";

export interface LoadSwitch {
  id: string;
  name: string;
  state: boolean;
  load_number: number;
}

export function useInverterAndLoadsSwitches(inverterId: string) {
  const [systemId, setSystemId] = useState<string | null>(null);
  const [inverterState, setInverterState] = useState<boolean>(false);
  const [loads, setLoads] = useState<LoadSwitch[]>([]);
  const [deviceData, setDeviceData] = useState<any>(null);
  const lastActivityRef = useRef<string | null>(null);

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
    const fetchSwitches = async () => {
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
      fetchSwitches();
    }
    return () => { isMounted = false }
  }, [systemId]);

  // Fetch initial control data from Firebase on systemId and loads ready
  useEffect(() => {
    if (!systemId || loads.length === 0) return;

    const fetchInitialControlData = async () => {
      try {
        // Use the prefixed ID for control data
        const controlDeviceId = `_${systemId}`;
        console.log(`Fetching initial Firebase control data for: ${controlDeviceId}`);
        const deviceRef = ref(firebaseDb, `/${controlDeviceId}`);
        const snapshot = await get(deviceRef);
        const data = snapshot.val();

        if (data) {
          console.log(`Initial Firebase control data received:`, data);
          const invState = data.power === 1;
          setInverterState(invState);

          setLoads((prevLoads) =>
            prevLoads.map(l => {
              let val = data[`load_${l.load_number}`] ?? data[`load${l.load_number}`] ?? 0;
              return { ...l, state: val === 1 };
            })
          );

          lastActivityRef.current = "Firebase initial control states loaded";
        }
      } catch (error: any) {
        console.error("Error fetching initial Firebase control data:", error);
        toast({
          title: "Error",
          description: "Unable to load initial control states from Firebase",
          variant: "destructive",
        });
      }
    }

    fetchInitialControlData();
  }, [systemId, loads.length]);

  // Subscribe to device data (voltage, current, etc.) from Firebase without "_" prefix
  useEffect(() => {
    if (!systemId) return;
    
    // Use clean system ID without prefix for device data
    console.log(`Subscribing to device data for system: ${systemId}`);
    const unsubscribe = subscribeToDeviceData(systemId, (data) => {
      if (!data) return;
      setDeviceData(data);
    });
    
    return () => unsubscribe();
  }, [systemId]);

  // Subscribe to control states (power, loads) from Firebase with "_" prefix
  useEffect(() => {
    if (!systemId) return;
    
    // Control states need prefix
    console.log(`Subscribing to control states for system: ${systemId}`);
    const unsubscribe = subscribeToControlStates(systemId, (controlData) => {
      if (!controlData) return;
      
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
    });
    
    return () => unsubscribe();
  }, [systemId]);

  // Send all states to Firebase with "_" prefix and update Supabase
  const setAllStates = async (next: { inverter: boolean, loads: LoadSwitch[] }) => {
    if (!systemId) {
      console.error("Cannot update states: systemId is null");
      return false;
    }

    try {
      // 1. Prepare data shape for Firebase - control data
      const firebaseUpdate: any = {
        power: next.inverter ? 1 : 0,
      };

      for (const load of next.loads) {
        firebaseUpdate[`load_${load.load_number}`] = load.state ? 1 : 0;
      }

      console.log(`Updating Firebase with data:`, firebaseUpdate);

      // 2. Set all in one go for Firebase with prefix
      await setAllDeviceStates(systemId, firebaseUpdate);
      console.log("Firebase update successful");

      // 3. Update Supabase for each changed load (by id)
      for (const load of next.loads) {
        await supabase
          .from('inverter_loads')
          .update({ state: load.state })
          .eq('id', load.id);
      }
      console.log("Supabase update successful");

      return true;
    } catch (error) {
      console.error("Error updating device states:", error);
      return false;
    }
  };

  // Handlers
  const setInverterAndLoads = async (newInverterState: boolean) => {
    // Send inverter update with current loads states
    console.log(`Setting inverter state to ${newInverterState}`);
    const updates = { inverter: newInverterState, loads };
    const ok = await setAllStates(updates);
    if (ok) setInverterState(newInverterState);
    return ok;
  };

  const setSingleLoadAndAll = async (loadNumber: number, newState: boolean) => {
    // Change one load, keep others + inverter as is
    console.log(`Setting load ${loadNumber} to ${newState}`);
    const newLoads = loads.map((l) =>
      l.load_number === loadNumber ? { ...l, state: newState } : l
    );

    // Send all states at once (inverter + all loads)
    const updates = { inverter: inverterState, loads: newLoads };
    const ok = await setAllStates(updates);

    if (ok) {
      // Only update the local state if the operations succeeded
      console.log(`Successfully updated load ${loadNumber} to ${newState}`);
      setLoads(newLoads);
    }

    return ok;
  };

  return {
    inverterState,
    setInverterAndLoads,
    loads,
    setSingleLoadAndAll,
    setLoads,
    setInverterState,
    systemId,
    deviceData,
  };
}
