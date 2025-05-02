
import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatWestAfricaTime, timeAgo } from "@/utils/westAfricaTime";
import { subscribeToDeviceData } from "@/integrations/firebase/client";

interface DeviceStatusMonitorProps {
  inverterId: string;
  deviceData?: string;
  refreshInterval?: number;
}

export const DeviceStatusMonitor = ({
  inverterId,
  deviceData,
  refreshInterval = 5000, // Extended to 5 seconds for more reliable status
}: DeviceStatusMonitorProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const lastRandomValueRef = useRef<number>(0);
  const [systemId, setSystemId] = useState<string | null>(null);
  const initialLoadRef = useRef<boolean>(true);
  const hasRandomValueChangedRef = useRef<boolean>(false);
  const ignoredFirstUpdateRef = useRef<boolean>(false);

  // First, get the system_id for this inverter when component mounts
  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('system_id')
          .eq('id', inverterId)
          .single();
          
        if (error) throw error;
        
        if (data && data.system_id) {
          setSystemId(data.system_id);
          console.log(`Setting up device monitoring for system ID: ${data.system_id}`);
          
          // Also fetch the last known random value from Supabase if we store it
          try {
            const { data: lastData, error: lastError } = await supabase
              .from('device_data')
              .select('data')
              .eq('device_id', data.system_id)
              .order('timestamp', { ascending: false })
              .limit(1);
              
            if (!lastError && lastData && lastData.length > 0 && lastData[0].data) {
              const values = lastData[0].data.split(',');
              if (values.length >= 21) {
                lastRandomValueRef.current = parseInt(values[20]) || 0;
                console.log(`Retrieved last known random value: ${lastRandomValueRef.current}`);
              }
            }
          } catch (e) {
            console.error('Error fetching last random value:', e);
          }
        }
      } catch (error) {
        console.error('Error getting device info:', error);
      }
    };
    
    if (inverterId) {
      getDeviceInfo();
    }
  }, [inverterId]);

  // Parse device data from a string when it changes
  useEffect(() => {
    if (!deviceData) {
      return;
    }

    try {
      const values = deviceData.split(',');
      
      // The random value is at position 20 in the array (0-indexed)
      if (values.length >= 21) {
        const currentRandomValue = parseInt(values[20]) || 0;

        // Ignore the first update to prevent false positive
        if (!ignoredFirstUpdateRef.current) {
          ignoredFirstUpdateRef.current = true;
          console.log('Ignoring first random value update to prevent false online status');
          return;
        }

        if (currentRandomValue !== lastRandomValueRef.current) {
          lastRandomValueRef.current = currentRandomValue;
          setLastUpdateTime(Date.now());
          setIsOnline(true);
          hasRandomValueChangedRef.current = true;
          initialLoadRef.current = false;
          console.log(`Random value changed to ${currentRandomValue}, setting device online`);
        }
      }
    } catch (error) {
      console.error('Error parsing device data:', error);
    }
  }, [deviceData]);

  // Check if device is online by checking time since last update
  useEffect(() => {
    const timer = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      if (lastUpdateTime > 0 && timeSinceLastUpdate > refreshInterval * 3) { // Consider device offline if no update for 3x the refresh interval
        setIsOnline(false);
      }
    }, 1000); // Check every second

    return () => clearInterval(timer);
  }, [refreshInterval, lastUpdateTime]);

  // Subscribe to Firebase device data changes through Supabase realtime
  useEffect(() => {
    if (!systemId) return;
    
    let subscription: any = null;
    
    const setupRealtimeSubscription = () => {
      console.log(`info: Setting up realtime subscription for device ID: ${systemId}`);
      
      try {
        // Use Supabase realtime subscription for updates
        subscription = supabase
          .channel(`device_data_${systemId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'device_data',
              filter: `device_id=eq.${systemId}`
            },
            (payload) => {
              console.log(`Received data change for ${systemId}:`, payload);
              if (payload.new) {
                setLastUpdateTime(Date.now());
                setIsOnline(true);
                hasRandomValueChangedRef.current = true;
                initialLoadRef.current = false;
              }
            }
          )
          .subscribe((status) => {
            console.log(`Supabase subscription status: ${status}`);
          });
      } catch (error) {
        console.error(`Error setting up realtime subscription: ${error}`);
      }
    };
    
    // Set up Firebase subscription (without prefix) to monitor random value changes
    const unsubscribe = subscribeToDeviceData(systemId, (data) => {
      if (data && data.random_value !== undefined) {
        const currentRandomValue = data.random_value;
        
        // Ignore the first update to prevent false positive when component loads
        if (!ignoredFirstUpdateRef.current) {
          ignoredFirstUpdateRef.current = true;
          console.log('Ignoring first Firebase update to prevent false online status');
          return;
        }
        
        if (currentRandomValue !== lastRandomValueRef.current) {
          lastRandomValueRef.current = currentRandomValue;
          setLastUpdateTime(Date.now());
          setIsOnline(true);
          hasRandomValueChangedRef.current = true;
          initialLoadRef.current = false;
          console.log(`Random value changed to ${currentRandomValue}, setting device online`);
        }
      }
    });
    
    // Call the setup function for Supabase
    setupRealtimeSubscription();
    
    // Return the cleanup function directly
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        console.log(`Unsubscribed from realtime updates for ${systemId}`);
      }
      unsubscribe();
    };
  }, [systemId]);

  const getTimeAgo = () => {
    if (!lastUpdateTime) return "";
    return timeAgo(lastUpdateTime);
  };

  // Don't show online status until we've confirmed a random value change
  // or received a real update from the database
  const showAsOnline = isOnline && (!initialLoadRef.current || hasRandomValueChangedRef.current);

  return (
    <div className="flex items-center space-x-2">
      {showAsOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-400">Online</span>
          {lastUpdateTime > 0 && (
            <span className="text-xs text-gray-400">
              • Last update: {getTimeAgo()}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-400">Offline</span>
          {lastUpdateTime > 0 && (
            <span className="text-xs text-gray-400">
              • Last seen: {getTimeAgo()}
            </span>
          )}
        </>
      )}
    </div>
  );
};
