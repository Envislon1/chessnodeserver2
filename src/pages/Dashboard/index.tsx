
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from '@/components/ui/button';
import { AddInverterSystem } from '@/components/inverter/AddInverterSystem';
import { PowerSwitch } from '@/components/inverter/PowerSwitch';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from "@/hooks/use-mobile";
import { subscribeToDeviceData, subscribeToControlStates } from "@/integrations/firebase/client";
import { SystemSelector } from "./SystemSelector";
import { SystemInfoCard } from "./SystemInfoCard";
import { SystemTabs } from "./SystemTabs";

// Define the InverterSystem interface locally if not imported
interface InverterSystem {
  id: string;
  name: string;
  location: string;
  model: string;
  system_id: string;
  capacity?: number;
  user_id: string;
}

// Define the InverterSystemParameters interface
interface InverterSystemParameters {
  battery_percentage: number;
  battery_voltage: number;
  output_capacity: number;
  output_voltage: number;
  output_power: number;
  frequency: number;
  power_factor: number;
  mains_present: boolean;
  solar_present: boolean;
  energy_kwh: number;
  apparent_power: number;
  reactive_power: number;
  real_power: number;
  acv_rms: number;
  acv_peak_peak: number;
  acc_rms: number;
  acc_peak_peak: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [systems, setSystems] = useState<InverterSystem[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceData, setDeviceData] = useState<string | null>(null);
  const [deviceStateData, setDeviceStateData] = useState<any>(null);
  const [controlStateData, setControlStateData] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
      } else {
        setUserId(session.user.id);
      }
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchInverterSystems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // We'll update this function to use timestamp instead of created_at column
  useEffect(() => {
    if (!selectedSystem) return;
    
    const fetchDeviceData = async () => {
      try {
        const selectedSystemData = systems.find(s => s.id === selectedSystem);
        if (!selectedSystemData || !selectedSystemData.system_id) return;
        
        const { data, error } = await supabase
          .from('device_data')
          .select('data, timestamp')  // Using timestamp instead of created_at
          .eq('device_id', selectedSystemData.system_id)
          .order('timestamp', { ascending: false })  // Using timestamp for ordering
          .limit(1);
          
        if (error) throw error;
        
        if (data && data.length > 0 && data[0].data) {
          setDeviceData(data[0].data);
        } else {
          setDeviceData(null);
        }
      } catch (error) {
        console.error('Error fetching device data:', error);
        setDeviceData(null);
      }
    };
    
    // Initial fetch
    fetchDeviceData();
    
    // Set up interval for 1-second updates
    const interval = setInterval(fetchDeviceData, 1000);
    
    return () => clearInterval(interval);
  }, [selectedSystem, systems]);

  // Subscribe to Firebase device data (no prefix) when selectedSystem changes
  useEffect(() => {
    if (!selectedSystem) return;
    
    const selectedSystemData = systems.find(s => s.id === selectedSystem);
    if (!selectedSystemData || !selectedSystemData.system_id) return;
    
    console.log(`Subscribing to Firebase device data for system: ${selectedSystemData.system_id}`);
    
    const unsubscribe = subscribeToDeviceData(selectedSystemData.system_id, (data) => {
      if (data) {
        setDeviceStateData(data);
        console.log("Firebase device data received and state updated:", data);
      }
    });
    
    return () => {
      console.log("Unsubscribing from Firebase device data");
      unsubscribe();
    };
  }, [selectedSystem, systems]);

  // Subscribe to Firebase control states (with prefix) when selectedSystem changes
  useEffect(() => {
    if (!selectedSystem) return;
    
    const selectedSystemData = systems.find(s => s.id === selectedSystem);
    if (!selectedSystemData || !selectedSystemData.system_id) return;
    
    console.log(`Subscribing to Firebase control states for system: ${selectedSystemData.system_id}`);
    
    const unsubscribe = subscribeToControlStates(selectedSystemData.system_id, (data) => {
      if (data) {
        setControlStateData(data);
        console.log("Firebase control data received and state updated:", data);
      }
    });
    
    return () => {
      console.log("Unsubscribing from Firebase control states");
      unsubscribe();
    };
  }, [selectedSystem, systems]);

  const fetchInverterSystems = async () => {
    try {
      const { data, error } = await supabase
        .from('inverter_systems')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      
      setSystems(data || []);
      if (data?.length > 0 && !selectedSystem) {
        setSelectedSystem(data[0].id);
      }
    } catch (error: any) {
      console.error('Error fetching inverter systems:', error.message);
    }
  };

  // Convert Firebase data to parameters format used by components
  const getSystemParameters = (systemId: string): InverterSystemParameters | null => {
    if (!deviceStateData) return null;
    
    const selectedSystemData = systems.find(s => s.id === systemId);
    if (!selectedSystemData) return null;

    // Map the device data to our parameter format
    return {
      battery_percentage: deviceStateData.battery_percentage || 0,
      battery_voltage: deviceStateData.battery_voltage || 0,
      // Use device_capacity from Firebase or fallback to system's capacity
      output_capacity: deviceStateData.device_capacity || 0,
      output_voltage: deviceStateData.voltage || 0,
      output_power: deviceStateData.power || 0,
      // Use actual values from Firebase, no default fallbacks
      frequency: deviceStateData.frequency || 0,
      power_factor: deviceStateData.power_factor || 0,
      mains_present: !!deviceStateData.mains_present,
      solar_present: !!deviceStateData.solar_present,
      energy_kwh: deviceStateData.energy || 0,
      apparent_power: deviceStateData.apparent_power || 0,
      reactive_power: deviceStateData.reactive_power || 0,
      real_power: deviceStateData.power || 0,
      acv_rms: deviceStateData.voltage || 0,
      acv_peak_peak: deviceStateData.voltage_peak_peak || 0,
      acc_rms: deviceStateData.current || 0,
      acc_peak_peak: deviceStateData.current_peak_peak || 0,
    };
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const parameters = selectedSystem ? getSystemParameters(selectedSystem) : null;
  const selectedSystemData = systems.find(system => system.id === selectedSystem);

  // Check if power is controlled by Firebase (use control state data)
  const isPowerOn = controlStateData?.power === 1;

  // Combine data for display components
  const combinedFirebaseData = {
    ...deviceStateData,
    // Override with control state data (for power and loads)
    ...(controlStateData || {}),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 text-white p-2 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
          <h1 className="text-xl sm:text-3xl font-bold text-orange-500">Technautic Systems</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
          <div className="md:col-span-2">
            {systems.length > 0 ? (
              <div className="space-y-4 sm:space-y-8">
                <SystemSelector
                  systems={systems}
                  selectedSystem={selectedSystem}
                  setSelectedSystem={setSelectedSystem}
                  fetchInverterSystems={fetchInverterSystems}
                  isMobile={isMobile}
                />
                {selectedSystem && selectedSystemData && (
                  <>
                    <SystemInfoCard
                      selectedSystemData={selectedSystemData}
                      deviceData={deviceData}
                      showAdvanced={showAdvanced}
                      setShowAdvanced={setShowAdvanced}
                      handleSignOut={handleSignOut}
                      isMobile={isMobile}
                      firebaseData={combinedFirebaseData}
                    />
                    <PowerSwitch inverterId={selectedSystem} initialState={isPowerOn} />
                    <SystemTabs
                      parameters={parameters}
                      showAdvanced={showAdvanced}
                      deviceData={deviceData}
                      inverterId={selectedSystem}
                      firebaseData={combinedFirebaseData}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 sm:p-8 bg-black/40 border border-orange-500/20 rounded-lg">
                <p className="text-gray-300 mb-4 text-sm sm:text-base">
                  No inverter systems found. Add one to get started!
                </p>
                <div className="w-full max-w-xs sm:w-64">
                  <AddInverterSystem onSuccess={fetchInverterSystems} />
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="w-full">
              <AddInverterSystem onSuccess={fetchInverterSystems} />
            </div>
            
            {selectedSystemData?.system_id && (
              <div className="p-4 bg-black/40 border border-orange-500/20 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Share This System</h3>
                <p className="text-xs text-gray-300 mb-2">
                  Give this System ID to other users to allow them to access this inverter system:
                </p>
                <div className="flex items-center justify-between p-2 bg-black/60 rounded border border-orange-500/40">
                  <code className="text-orange-300 text-sm overflow-x-auto whitespace-nowrap max-w-full">
                    {selectedSystemData.system_id}
                  </code>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="border-orange-500/30 text-orange-500 hover:bg-orange-500/20"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSystemData.system_id || '');
                      toast({
                        title: "Copied!",
                        description: "System ID copied to clipboard",
                      });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
