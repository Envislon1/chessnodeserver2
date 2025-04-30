import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToDeviceData, setAllDeviceStates } from "@/integrations/firebase/client";
import { ref, get } from "firebase/database";
import { firebaseDb } from "@/integrations/firebase/client";
import { toast } from "@/hooks/use-toast";

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
  const lastActivityRef = useRef<string | null>(null);

  // Fetch system_id based on inverterId
  useEffect(() => {
    let isMounted = true;
    const getSystemId = async () => {
      if (!inverterId) return;

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
        setSystemId(data.system_id);
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

  // Fetch initial device data from Firebase on systemId and loads ready
  useEffect(() => {
    if (!systemId || loads.length === 0) return;

    const fetchInitialFirebaseData = async () => {
      try {
        const deviceRef = ref(firebaseDb, `/_${systemId}`);
        const snapshot = await get(deviceRef);
        const data = snapshot.val();

        if (data) {
          const invState = data.power === 1;
          setInverterState(invState);

          setLoads((prevLoads) =>
            prevLoads.map(l => {
              let val = data[`load_${l.load_number}`] ?? data[`load${l.load_number}`] ?? 0;
              return { ...l, state: val === 1 };
            })
          );

          lastActivityRef.current = "Firebase initial states loaded";
        }
      } catch (error: any) {
        console.error("Error fetching initial Firebase device data:", error);
        toast({
          title: "Error",
          description: "Unable to load initial device states from Firebase",
          variant: "destructive",
        });
      }
    }

    fetchInitialFirebaseData();
  }, [systemId, loads.length]);

  // Subscribe to incoming deviceData for all state
  useEffect(() => {
    if (!systemId) return;
    const unsubscribe = subscribeToDeviceData(systemId, (deviceData) => {
      if (!deviceData) return;
      if ("power" in deviceData) setInverterState(deviceData.power === 1);
      setLoads((prevLoads) =>
        prevLoads.map((l) => {
          let val = deviceData[`load_${l.load_number}`] ?? deviceData[`load${l.load_number}`] ?? 0;
          return { ...l, state: val === 1 };
        })
      );
    });
    return () => unsubscribe();
  }, [systemId]);

  // Send all states to Firebase and update Supabase
  const setAllStates = async (next: { inverter: boolean, loads: LoadSwitch[] }) => {
    if (!systemId) return false;

    try {
      // 1. Prepare data shape for Firebase
      const firebaseUpdate: any = {
        power: next.inverter ? 1 : 0,
      };

      for (const load of next.loads) {
        firebaseUpdate[`load_${load.load_number}`] = load.state ? 1 : 0;
      }

      // 2. Set all in one go for Firebase
      await setAllDeviceStates(systemId, firebaseUpdate);

      // 3. Update Supabase for each changed load (by id)
      for (const load of next.loads) {
        await supabase
          .from('inverter_loads')
          .update({ state: load.state })
          .eq('id', load.id);
      }

      return true;
    } catch (error) {
      console.error("Error updating device states:", error);
      return false;
    }
  };

  // Handlers
  const setInverterAndLoads = async (newInverterState: boolean) => {
    // Send inverter update with current loads states
    const updates = { inverter: newInverterState, loads };
    const ok = await setAllStates(updates);
    if (ok) setInverterState(newInverterState);
    return ok;
  };

  const setSingleLoadAndAll = async (loadNumber: number, newState: boolean) => {
    // Change one load, keep others + inverter as is
    const newLoads = loads.map((l) =>
      l.load_number === loadNumber ? { ...l, state: newState } : l
    );

    // Send all states at once (inverter + all loads)
    const updates = { inverter: inverterState, loads: newLoads };
    const ok = await setAllStates(updates);

    if (ok) {
      // Only update the local state if the operations succeeded
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
  };
}
