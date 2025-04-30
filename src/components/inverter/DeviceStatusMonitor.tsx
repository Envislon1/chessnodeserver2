
import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatWestAfricaTime, timeAgo } from "@/utils/westAfricaTime";

interface DeviceStatusMonitorProps {
  inverterId: string;
  deviceData?: string;
  refreshInterval?: number;
}

export const DeviceStatusMonitor = ({
  inverterId,
  deviceData,
  refreshInterval = 120000, // Default to 2 minutes (120,000 ms)
}: DeviceStatusMonitorProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const lastRandomValueRef = useRef<number>(0);
  const [systemId, setSystemId] = useState<string | null>(null);

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
      const currentRandomValue = parseInt(values[20]) || 0;

      if (currentRandomValue !== lastRandomValueRef.current) {
        lastRandomValueRef.current = currentRandomValue;
        setLastUpdateTime(Date.now());
        setIsOnline(true);
      }
    } catch (error) {
      console.error('Error parsing device data:', error);
    }
  }, [deviceData]);

  // Check if device is online by checking time since last update
  useEffect(() => {
    const timer = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      if (timeSinceLastUpdate > refreshInterval) {
        setIsOnline(false);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [refreshInterval, lastUpdateTime]);

  // Subscribe to Firebase device data changes
  useEffect(() => {
    if (!systemId) return;
    
    const setupRealtimeSubscription = async () => {
      // Create a firebase_id by adding underscore prefix to system_id
      const deviceIdForFirebase = `_${systemId}`;
      
      console.log(`info: Subscribing to device data for: ${deviceIdForFirebase}`);
        
      const subscription = supabase
        .channel('device_data_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'device_data',
            filter: `device_id=eq.${systemId}`
          },
          (payload) => {
            if (payload.new && typeof payload.new.data === 'string') {
              console.log(`info: Received data for ${systemId}: ${JSON.stringify(payload.new)}`);
              const values = payload.new.data.split(',');
              const newRandomValue = parseInt(values[20]) || 0;
              
              if (newRandomValue !== lastRandomValueRef.current) {
                lastRandomValueRef.current = newRandomValue;
                setLastUpdateTime(Date.now());
                setIsOnline(true);
              }
            }
          }
        )
        .subscribe();
        
      return () => {
        subscription.unsubscribe();
      };
    };
    
    if (systemId) {
      setupRealtimeSubscription();
    }
  }, [systemId]);

  const getTimeAgo = () => {
    if (!lastUpdateTime) return "";
    return timeAgo(lastUpdateTime);
  };

  return (
    <div className="flex items-center space-x-2">
      {isOnline ? (
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
