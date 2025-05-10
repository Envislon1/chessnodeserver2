
import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatWestAfricaTime, timeAgo } from "@/utils/westAfricaTime";
import { toast } from "@/hooks/use-toast";

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
  const lastCheckRef = useRef<number>(Date.now());
  const [lastStatusChangeTime, setLastStatusChangeTime] = useState<number>(0);

  // Constants for status determination
  const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes to consider device offline
  
  // Get the system_id for this inverter when component mounts
  useEffect(() => {
    const getDeviceInfo = async () => {
      if (!inverterId) return;

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
          console.log(`Retrieved device info:`, data);
          setSystemId(data.system_id);
          
          // Initialize online status based on last_seen_at timestamp
          if (data.last_seen_at) {
            const lastSeen = new Date(data.last_seen_at).getTime();
            setLastUpdateTime(lastSeen);
            
            // Check if device is actually online based on last_seen_at timestamp
            const now = Date.now();
            const timeSinceLastSeen = now - lastSeen;
            const deviceIsOnline = timeSinceLastSeen < OFFLINE_THRESHOLD;
            
            console.log(`Device ${data.system_id} initial status check:`, {
              lastSeen: new Date(lastSeen).toISOString(),
              timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000) + 's',
              deviceIsOnline
            });
            
            setIsOnline(deviceIsOnline);
            if (deviceIsOnline !== isOnline) {
              setLastStatusChangeTime(now);
            }
          } else {
            setIsOnline(false);
          }
        }
      } catch (error) {
        console.error('Error getting device info:', error);
      }
    };
    
    getDeviceInfo();
  }, [inverterId]);

  // Subscribe to realtime updates from the inverter_systems table
  useEffect(() => {
    if (!inverterId) return;
    
    console.log(`Setting up realtime subscription for inverter: ${inverterId}`);
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
          console.log(`Realtime update received for inverter ${inverterId}:`, payload.new);
          if (payload.new) {
            processDeviceStatusUpdate(payload.new);
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
        // Only check if enough time has passed since the last check
        const now = Date.now();
        if (now - lastCheckRef.current < refreshInterval) {
          return;
        }
        
        lastCheckRef.current = now;
        
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('is_online, last_seen_at, system_id, last_random_value')
          .eq('id', inverterId)
          .single();
          
        if (error) {
          console.error('Error fetching inverter status:', error);
          return;
        }
        
        if (data) {
          console.log(`Poll status update for inverter ${inverterId}:`, data);
          processDeviceStatusUpdate(data);
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
  
  // Function to process device status updates from any source
  const processDeviceStatusUpdate = (data: any) => {
    if (!data) return;
    
    // Update last seen time if available
    if (data.last_seen_at) {
      const lastSeen = new Date(data.last_seen_at).getTime();
      setLastUpdateTime(lastSeen);
      
      // Check if device should be considered offline based on timestamp
      const now = Date.now();
      const timeSinceLastSeen = now - lastSeen;
      const deviceShouldBeOnline = timeSinceLastSeen < OFFLINE_THRESHOLD;
      
      console.log(`Device ${data.system_id} status evaluation:`, {
        lastSeen: new Date(lastSeen).toISOString(),
        timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000) + 's',
        threshold: Math.floor(OFFLINE_THRESHOLD / 1000) + 's',
        currentStatus: isOnline ? 'online' : 'offline',
        newStatus: deviceShouldBeOnline ? 'online' : 'offline'
      });
      
      // Only update state if there's a change to prevent unnecessary rerenders
      if (deviceShouldBeOnline !== isOnline) {
        console.log(`Device status changed: ${isOnline ? 'online' : 'offline'} -> ${deviceShouldBeOnline ? 'online' : 'offline'}`);
        setIsOnline(deviceShouldBeOnline);
        setLastStatusChangeTime(now);
      }
    }
  };

  const getTimeAgo = () => {
    if (!lastUpdateTime) return "";
    return timeAgo(lastUpdateTime);
  };

  // Show as offline if we haven't received an update in more than the threshold
  const isOffline = !isOnline || (lastUpdateTime > 0 && Date.now() - lastUpdateTime > OFFLINE_THRESHOLD);

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
