
import { useState, useEffect, useRef } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatWestAfricaTime, timeAgo } from "@/utils/westAfricaTime";
import { subscribeToDeviceData } from "@/integrations/firebase/client";
import { logInverterData, updateInverterLastSeen, getInverterLastSeen } from "@/utils/dataLogging";

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
  const [lastDbUpdateTime, setLastDbUpdateTime] = useState<string | null>(null);
  const lastRandomValueRef = useRef<number>(0);
  const [systemId, setSystemId] = useState<string | null>(null);
  const initialLoadRef = useRef<boolean>(true);
  const hasRandomValueChangedRef = useRef<boolean>(false);
  const ignoredFirstUpdateRef = useRef<boolean>(false);
  const lastSystemIdRef = useRef<string | null>(null);
  
  // Unique channel name per inverter component instance
  const channelNameRef = useRef<string>(`device_data_${inverterId}_${Math.random().toString(36).substring(7)}`);

  // First, get the system_id for this inverter when component mounts
  useEffect(() => {
    console.log(`DeviceStatusMonitor initialized for inverter ID: ${inverterId}`);
    
    const getDeviceInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('inverter_systems')
          .select('system_id, last_seen')
          .eq('id', inverterId)
          .single();
          
        if (error) throw error;
        
        if (data && data.system_id) {
          // Reset our flags when system ID changes
          if (lastSystemIdRef.current !== data.system_id) {
            console.log(`System ID changed from ${lastSystemIdRef.current} to ${data.system_id}, resetting online detection for inverter ${inverterId}`);
            lastSystemIdRef.current = data.system_id;
            ignoredFirstUpdateRef.current = false;
            setIsOnline(false);
            hasRandomValueChangedRef.current = false;
            initialLoadRef.current = true;
            
            // Set the last update time from database if available
            if (data.last_seen) {
              const lastSeenDate = new Date(data.last_seen).getTime();
              setLastDbUpdateTime(data.last_seen);
              
              // If last_seen is recent (within the past minute), consider the device online
              const oneMinuteAgo = Date.now() - 60000;
              if (lastSeenDate > oneMinuteAgo) {
                setLastUpdateTime(lastSeenDate);
                setIsOnline(true);
                initialLoadRef.current = false;
              }
            }
          }
          
          setSystemId(data.system_id);
          console.log(`Inverter ${inverterId} has system_id: ${data.system_id} - Setting up device monitoring`);
          
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
                console.log(`Retrieved last known random value for inverter ${inverterId}: ${lastRandomValueRef.current}`);
              }
            }
          } catch (e) {
            console.error(`Error fetching last random value for inverter ${inverterId}:`, e);
          }
        }
      } catch (error) {
        console.error(`Error getting device info for inverter ${inverterId}:`, error);
      }
    };
    
    if (inverterId) {
      getDeviceInfo();
    }
    
    // When component unmounts or inverterId changes, reset state
    return () => {
      console.log(`DeviceStatusMonitor cleanup for inverter ${inverterId}`);
      ignoredFirstUpdateRef.current = false;
      setIsOnline(false);
      hasRandomValueChangedRef.current = false;
      initialLoadRef.current = true;
    };
  }, [inverterId]);

  // Fetch the last seen time from the database periodically for THIS specific inverter
  useEffect(() => {
    if (!inverterId) return;
    
    console.log(`Setting up last seen polling for inverter ${inverterId}`);
    
    const fetchLastSeen = async () => {
      const lastSeen = await getInverterLastSeen(inverterId);
      console.log(`Fetched last seen for inverter ${inverterId}: ${lastSeen}`);
      
      if (lastSeen) {
        setLastDbUpdateTime(lastSeen);
        
        // Check if this timestamp is recent enough to consider online
        const lastSeenTime = new Date(lastSeen).getTime();
        const threeMinutesAgo = Date.now() - 180000;
        
        if (lastSeenTime > threeMinutesAgo) {
          setIsOnline(true);
          setLastUpdateTime(lastSeenTime);
        } else if (isOnline) {
          // If it was online but the timestamp is now old, set offline
          setIsOnline(false);
        }
      }
    };
    
    // Fetch initially
    fetchLastSeen();
    
    // Set up interval to fetch periodically
    const interval = setInterval(fetchLastSeen, 30000); // Check every 30 seconds
    
    return () => {
      console.log(`Cleaning up last seen polling for inverter ${inverterId}`);
      clearInterval(interval);
    };
  }, [inverterId, isOnline]);

  // Parse device data from a string when it changes
  useEffect(() => {
    if (!deviceData || !systemId || systemId !== lastSystemIdRef.current) {
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
          console.log(`Ignoring first random value update for ${inverterId} to prevent false online status`);
          return;
        }

        if (currentRandomValue !== lastRandomValueRef.current) {
          console.log(`Random value changed from ${lastRandomValueRef.current} to ${currentRandomValue} for inverter ${inverterId}`);
          lastRandomValueRef.current = currentRandomValue;
          const now = Date.now();
          setLastUpdateTime(now);
          setIsOnline(true);
          hasRandomValueChangedRef.current = true;
          initialLoadRef.current = false;
          
          // Update the last_seen timestamp in the database FOR THIS SPECIFIC INVERTER
          updateInverterLastSeen(inverterId)
            .then(success => {
              if (success) {
                console.log(`Last seen timestamp updated for inverter ${inverterId}`);
              } else {
                console.error(`Failed to update last seen timestamp for inverter ${inverterId}`);
              }
            });
          
          // Log data to Supabase if we have system_id
          if (systemId && values.length >= 21) {
            // Parse the data and log it
            const dataToLog = {
              power: parseFloat(values[2]) || 0, // Load/Power at index 2
              battery_percentage: parseFloat(values[15]) || 0,
              battery_voltage: parseFloat(values[10]) || 0,
              voltage: parseFloat(values[0]) || 0,
              current: parseFloat(values[1]) || 0,
              mains_present: values[6] === "1",
              solar_present: values[7] === "1",
              frequency: parseFloat(values[4]) || 0,
              power_factor: parseFloat(values[5]) || 0,
              energy: parseFloat(values[3]) || 0
            };
            
            logInverterData(systemId, dataToLog)
              .then(success => {
                if (success) console.log(`Successfully logged inverter data for ${inverterId} to Supabase`);
              })
              .catch(err => {
                console.error(`Failed to log inverter data for ${inverterId}:`, err);
              });
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing device data for ${inverterId}:`, error);
    }
  }, [deviceData, systemId, inverterId]);

  // Check if device is online by checking time since last update - this is system specific
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
    
    console.log(`Setting up Firebase subscription for system ID: ${systemId} (inverter: ${inverterId})`);
    
    // Set up Firebase subscription (without prefix) to monitor random value changes
    const unsubscribe = subscribeToDeviceData(systemId, (data) => {
      if (data && data.random_value !== undefined) {
        const currentRandomValue = data.random_value;
        
        // Ignore the first update to prevent false positive
        if (!ignoredFirstUpdateRef.current) {
          ignoredFirstUpdateRef.current = true;
          console.log(`Ignoring first Firebase update for ${inverterId} to prevent false online status`);
          return;
        }
        
        if (currentRandomValue !== lastRandomValueRef.current) {
          console.log(`Firebase: Random value changed from ${lastRandomValueRef.current} to ${currentRandomValue} for inverter ${inverterId}`);
          lastRandomValueRef.current = currentRandomValue;
          const now = Date.now();
          setLastUpdateTime(now);
          setIsOnline(true);
          hasRandomValueChangedRef.current = true;
          initialLoadRef.current = false;
          
          // Update the last_seen in the database FOR THIS SPECIFIC INVERTER by UUID
          updateInverterLastSeen(inverterId)
            .then(success => {
              if (success) {
                console.log(`Last seen timestamp updated for inverter ${inverterId} via Firebase`);
              } else {
                console.error(`Failed to update last seen timestamp for inverter ${inverterId} via Firebase`);
              }
            });
          
          // Log Firebase data to Supabase
          if (systemId && data) {
            logInverterData(systemId, {
              power: data.power || data.load || 0,
              battery_percentage: data.battery_percentage || 0,
              battery_voltage: data.battery_voltage || 0,
              voltage: data.voltage || 0,
              current: data.current || 0,
              mains_present: data.mains_present === true || data.mains_present === 1,
              solar_present: data.solar_present === true || data.solar_present === 1,
              frequency: data.frequency || 0,
              power_factor: data.power_factor || 0,
              energy: data.energy || 0
            })
              .then(success => {
                if (success) console.log(`Successfully logged Firebase data for ${inverterId} to Supabase`);
              })
              .catch(err => {
                console.error(`Failed to log Firebase data for ${inverterId}:`, err);
              });
          }
        }
      }
    });
    
    // Unique channel name for each component instance to avoid shared updates
    const channelName = channelNameRef.current;
    
    // Use Supabase realtime subscription with a unique channel name per component
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_data',
          filter: `device_id=eq.${systemId}`
        },
        (payload) => {
          console.log(`Received data change for ${systemId} (inverter: ${inverterId}) on channel ${channelName}:`, payload);
          
          // Ignore first update after system change
          if (!ignoredFirstUpdateRef.current) {
            ignoredFirstUpdateRef.current = true;
            console.log(`Ignoring first Supabase update for ${inverterId} to prevent false online status`);
            return;
          }
          
          const now = Date.now();
          setLastUpdateTime(now);
          setIsOnline(true);
          hasRandomValueChangedRef.current = true;
          initialLoadRef.current = false;
          
          // Update the last_seen in the database specifically for this inverter using its UUID
          updateInverterLastSeen(inverterId)
            .then(success => {
              if (success) {
                console.log(`Last seen timestamp updated for inverter ${inverterId} via Supabase`);
              } else {
                console.error(`Failed to update last seen timestamp for inverter ${inverterId} via Supabase`);
              }
            });
        }
      )
      .subscribe((status) => {
        console.log(`Supabase subscription status for ${inverterId} on channel ${channelName}: ${status}`);
      });
    
    // Return cleanup function
    return () => {
      console.log(`Cleaning up subscriptions for inverter ${inverterId}`);
      unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [systemId, inverterId]);

  const getTimeAgo = () => {
    // If we have a real-time update, use it
    if (lastUpdateTime > 0) {
      return timeAgo(lastUpdateTime);
    }
    // Otherwise fall back to the database last_seen if available
    else if (lastDbUpdateTime) {
      return timeAgo(new Date(lastDbUpdateTime).getTime());
    }
    return "";
  };

  // Don't show online status until we've confirmed a random value change
  // or received a real update from the database, and have properly ignored the first update
  const showAsOnline = isOnline && (!initialLoadRef.current || hasRandomValueChangedRef.current) && ignoredFirstUpdateRef.current;

  return (
    <div className="flex items-center space-x-2">
      {showAsOnline ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" />
          <span className="text-xs text-green-400">Online</span>
          {(lastUpdateTime > 0 || lastDbUpdateTime) && (
            <span className="text-xs text-gray-400">
              • Last update: {getTimeAgo()}
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" />
          <span className="text-xs text-red-400">Offline</span>
          {(lastUpdateTime > 0 || lastDbUpdateTime) && (
            <span className="text-xs text-gray-400">
              • Last seen: {getTimeAgo()}
            </span>
          )}
        </>
      )}
    </div>
  );
};
