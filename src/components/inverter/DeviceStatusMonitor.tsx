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
  refreshInterval = 10000, // Poll every 10 seconds
}: DeviceStatusMonitorProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const [systemId, setSystemId] = useState<string | null>(null);
  const initialLoadRef = useRef<boolean>(true);
  const ignoredFirstUpdateRef = useRef<boolean>(false);

  // Get the system_id and online status for this inverter when component mounts
  useEffect(() => {
    const getDeviceInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('system_id, is_online, last_seen_at')
          .eq('id', inverterId)
          .single();
          
        if (error) {
          console.error('Error getting device info:', error);
          return;
        }
        
        if (data) {
          setSystemId(data.system_id);
          
          // Set initial online status from database
          setIsOnline(!!data.is_online);
          
          // Set last update time from last_seen_at
          if (data.last_seen_at) {
            const lastSeen = new Date(data.last_seen_at).getTime();
            setLastUpdateTime(lastSeen);
            
            // Check if device is actually online based on the last_seen_at timestamp
            const now = Date.now();
            const minutesAgo = Math.floor((now - lastSeen) / (60 * 1000));
            
            // If last seen more than 3 minutes ago, consider offline regardless of is_online flag
            if (minutesAgo > 3) {
              setIsOnline(false);
              console.log(`Device ${data.system_id} considered offline - last update: ${data.last_seen_at}, ${minutesAgo}m ago`);
            } else {
              console.log(`Device ${data.system_id} is ${data.is_online ? 'online' : 'offline'}, last seen ${minutesAgo}m ago`);
            }
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

  // Subscribe to Firebase device data when systemId changes
  useEffect(() => {
    if (!systemId) return;
    
    let unsubscribe: () => void;
    
    try {
      console.log(`Setting up Firebase subscription for device ID: ${systemId}`);
      
      // Set up Firebase subscription to monitor random value changes
      unsubscribe = subscribeToDeviceData(systemId, (data) => {
        if (!data) return;
        
        const now = Date.now();
        
        // Device is considered online if we're actively receiving data through Firebase
        setIsOnline(true);
        setLastUpdateTime(now);
        initialLoadRef.current = false;
      });
    } catch (error) {
      console.error('Error setting up Firebase subscription:', error);
    }
    
    // Return the cleanup function
    return () => {
      if (unsubscribe) {
        console.log(`Unsubscribing from Firebase updates for ${systemId}`);
        unsubscribe();
      }
    };
  }, [systemId]);

  // Subscribe to realtime updates from the inverter_systems table
  useEffect(() => {
    if (!inverterId) return;
    
    const channel = supabase
      .channel(`inverter_system_${inverterId}`)
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'inverter_systems',
          filter: `id=eq.${inverterId}`
        }, 
        (payload) => {
          if (payload.new) {
            // Update online status from database
            setIsOnline(!!payload.new.is_online);
            
            // Update last seen time
            if (payload.new.last_seen_at) {
              const lastSeen = new Date(payload.new.last_seen_at).getTime();
              setLastUpdateTime(lastSeen);
              
              // Check if device should be considered offline based on timestamp
              const now = Date.now();
              const secondsAgo = Math.floor((now - lastSeen) / 1000);
              
              // If last seen more than 3 minutes ago, consider offline regardless of is_online flag
              if (secondsAgo > 180) {
                setIsOnline(false);
                console.log(`Device ${payload.new.system_id} considered offline - last update: ${payload.new.last_seen_at}, ${secondsAgo}s ago`);
              } else {
                // Otherwise, use the is_online flag from the database
                setIsOnline(!!payload.new.is_online);
              }
            }
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [inverterId]);

  // Poll for inverter system status updates periodically
  useEffect(() => {
    if (!inverterId) return;
    
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('is_online, last_seen_at, system_id')
          .eq('id', inverterId)
          .single();
          
        if (error) {
          console.error('Error fetching inverter status:', error);
          return;
        }
        
        if (data) {
          // Update last seen time if available
          if (data.last_seen_at) {
            const lastSeen = new Date(data.last_seen_at).getTime();
            setLastUpdateTime(lastSeen);
            
            // Check if device should be considered offline based on timestamp
            const now = Date.now();
            const secondsAgo = Math.floor((now - lastSeen) / 1000);
            
            // If last seen more than 3 minutes ago, consider offline regardless of is_online flag
            if (secondsAgo > 180) {
              setIsOnline(false);
              console.log(`Device ${data.system_id} considered offline - last update: ${data.last_seen_at}, ${secondsAgo}s ago`);
            } else {
              // Otherwise, use the is_online flag from the database
              setIsOnline(!!data.is_online);
            }
          } else {
            // No last_seen_at value, use is_online flag
            setIsOnline(!!data.is_online);
          }
        }
      } catch (error) {
        console.error('Error checking inverter status:', error);
      }
    };
    
    // Initial check
    checkStatus();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkStatus, refreshInterval);
    
    return () => clearInterval(interval);
  }, [inverterId, refreshInterval]);

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

        setLastUpdateTime(Date.now());
        setIsOnline(true);
        initialLoadRef.current = false;
        console.log(`Device data received, setting device online. Timestamp: ${new Date().toISOString()}`);
      }
      
      // Check for inverter_state at position 21 if available (from Arduino code)
      if (values.length >= 22) {
        const inverterState = values[21] === "1" || values[21] === "true";
        console.log(`Inverter state from data: ${inverterState}`);
      }
    } catch (error) {
      console.error('Error parsing device data:', error);
    }
  }, [deviceData]);

  const getTimeAgo = () => {
    if (!lastUpdateTime) return "";
    return timeAgo(lastUpdateTime);
  };

  // Show as offline if we haven't received an update in more than 3 minutes
  const isOffline = !isOnline || (lastUpdateTime > 0 && Date.now() - lastUpdateTime > 3 * 60 * 1000);

  return (
    <div className="flex items-center space-x-2">
      {!isOffline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-400">Online</span>
          {lastUpdateTime > 0 && (
            <span className="text-xs text-gray-400">
              • Last seen: {getTimeAgo()}
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
