
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
  refreshInterval = 10000, // Poll every 10 seconds
}: DeviceStatusMonitorProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [systemId, setSystemId] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  
  // Get the system_id and initial status for this inverter when component mounts
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
          console.log(`Retrieved device info for ${inverterId}:`, data);
          setSystemId(data.system_id);
          
          // Initialize online status based on is_online from database
          setIsOnline(data.is_online || false);
          
          // Set the last seen timestamp if available
          if (data.last_seen_at) {
            setLastSeenAt(data.last_seen_at);
            
            const now = Date.now();
            const lastSeen = new Date(data.last_seen_at).getTime();
            const timeSinceLastSeen = now - lastSeen;
            
            console.log(`Device ${data.system_id} initial status:`, {
              lastSeen: new Date(lastSeen).toISOString(),
              timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000) + 's',
              isOnline: data.is_online
            });
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
          if (payload.new) {
            console.log(`Realtime update received for inverter ${inverterId}:`, payload.new);
            processDeviceStatusUpdate(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status for inverter ${inverterId}:`, status);
      });
    
    return () => {
      console.log(`Cleaning up realtime subscription for inverter: ${inverterId}`);
      supabase.removeChannel(channel);
    };
  }, [inverterId]);

  // Poll for inverter system status updates periodically as a fallback
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
          console.log(`Poll status update for inverter ${inverterId}:`, data);
          processDeviceStatusUpdate(data);
        }
      } catch (error) {
        console.error('Error checking inverter status:', error);
      }
    };
    
    // Set up interval for periodic checks
    const interval = setInterval(checkStatus, refreshInterval);
    
    return () => {
      console.log(`Cleaning up status polling for inverter: ${inverterId}`);
      clearInterval(interval);
    };
  }, [inverterId, refreshInterval]);
  
  // Function to process device status updates from any source
  const processDeviceStatusUpdate = (data: any) => {
    if (!data) return;
    
    // Update online status directly from the database field
    const newOnlineStatus = data.is_online || false;
    
    // Update last seen time if available
    if (data.last_seen_at) {
      setLastSeenAt(data.last_seen_at);
      
      const lastSeen = new Date(data.last_seen_at).getTime();
      const now = Date.now();
      const timeSinceLastSeen = now - lastSeen;
      
      console.log(`Device ${data.system_id || inverterId} status update:`, {
        lastSeen: new Date(lastSeen).toISOString(),
        timeSinceLastSeen: Math.floor(timeSinceLastSeen / 1000) + 's',
        isOnline: newOnlineStatus
      });
    }
    
    // Only update state if there's a change to prevent unnecessary rerenders
    if (newOnlineStatus !== isOnline) {
      console.log(`Device status changed: ${isOnline ? 'online' : 'offline'} -> ${newOnlineStatus ? 'online' : 'offline'}`);
      setIsOnline(newOnlineStatus);
    }
  };

  // Helper function to get the time elapsed since the last update
  const getTimeAgo = () => {
    if (!lastSeenAt) return "never";
    return timeAgo(new Date(lastSeenAt).getTime());
  };

  return (
    <div className="flex items-center space-x-2">
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-400">Online</span>
          {lastSeenAt && (
            <span className="text-xs text-gray-400">
              • Last seen: {getTimeAgo()}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-400">Offline</span>
          {lastSeenAt && (
            <span className="text-xs text-gray-400">
              • Last seen: {getTimeAgo()}
            </span>
          )}
        </>
      )}
    </div>
  );
};
