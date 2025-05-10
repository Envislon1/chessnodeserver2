
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://hzqnccsmejplilhmisgu.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const FIREBASE_URL = 'https://powerverter-pro-default-rtdb.firebaseio.com/'

// For devices that have gone offline, check less frequently (every 5 minutes)
const OFFLINE_POLLING_INTERVAL = 5 * 60 * 1000 // 5 minutes in milliseconds
// For devices that are online, check more frequently (every 1 minute)
const ONLINE_POLLING_INTERVAL = 1 * 60 * 1000 // 1 minute in milliseconds
// Set device offline if no activity for 3 minutes
const OFFLINE_THRESHOLD = 3 * 60 * 1000 // 3 minutes in milliseconds

// Track when we last checked each device
const deviceLastChecked = new Map<string, number>()
// Track the online/offline status of each device
const deviceStatus = new Map<string, boolean>()

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
    }

    // Initialize Supabase client with the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // Get all device IDs from the inverter_systems table
    const { data: systems, error: systemsError } = await supabase
      .from('inverter_systems')
      .select('id, system_id, last_random_value, last_seen_at, is_online')

    if (systemsError) {
      throw new Error(`Error fetching inverter systems: ${systemsError.message}`)
    }

    console.log(`Found ${systems.length} inverter systems to check`)

    const now = Date.now()
    const results = []

    // Check each device
    for (const system of systems) {
      if (!system.system_id) {
        console.log(`System ${system.id} has no system_id, skipping`)
        continue
      }

      const deviceId = system.system_id
      const isCurrentlyOnline = system.is_online || false
      const lastChecked = deviceLastChecked.get(deviceId) || 0

      // Initialize device status map from database value
      if (!deviceStatus.has(deviceId)) {
        deviceStatus.set(deviceId, isCurrentlyOnline)
      }

      // Determine if we should check this device now based on its current status
      const checkInterval = isCurrentlyOnline 
        ? ONLINE_POLLING_INTERVAL 
        : OFFLINE_POLLING_INTERVAL
      
      // Always check on first run, then respect interval
      if (lastChecked > 0 && now - lastChecked < checkInterval) {
        console.log(`Skipping device ${deviceId}, checked recently (${Math.floor((now - lastChecked) / 1000)}s ago)`)
        continue
      }

      // Update the last checked timestamp
      deviceLastChecked.set(deviceId, now)

      try {
        // Generate timestamp for strong cache busting
        const timestampNow = new Date().getTime()
        // Use a cache busting parameter to ensure we get fresh data
        const cacheBustParam = `_cb=${timestampNow}`
        
        console.log(`Checking device ${deviceId} with cache buster: ${cacheBustParam}`)
        
        // Fetch the current data from Firebase
        const response = await fetch(`${FIREBASE_URL}/${deviceId}.json?${cacheBustParam}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        
        if (!response.ok) {
          console.error(`Failed to fetch data for device ${deviceId}: ${response.statusText}`)
          
          // If we can't reach Firebase, mark device as offline if it was previously online
          if (isCurrentlyOnline) {
            await updateDeviceStatus(supabase, system.id, false)
            deviceStatus.set(deviceId, false)
            results.push({ deviceId, status: 'offline', updated: true, reason: 'firebase_unreachable' })
          }
          
          continue
        }

        const data = await response.json()
        
        if (!data) {
          console.log(`No data found for device ${deviceId}`)
          
          // If no data in Firebase, mark device as offline if it was previously online
          if (isCurrentlyOnline) {
            await updateDeviceStatus(supabase, system.id, false)
            deviceStatus.set(deviceId, false)
            results.push({ deviceId, status: 'offline', updated: true, reason: 'no_data' })
          }
          
          continue
        }

        // Extract the random value from the Firebase data (crucial for detecting changes)
        const randomValue = getDeviceRandomValue(data)
        const lastSeenAt = system.last_seen_at ? new Date(system.last_seen_at).getTime() : 0
        
        // Log for debugging
        console.log(`Device ${deviceId}: current random value = ${randomValue}, previous = ${system.last_random_value}, last seen: ${system.last_seen_at}`)
        
        if (randomValue === undefined) {
          console.log(`No random value found for device ${deviceId}`)
          // If no random value and was previously online, mark as offline
          if (isCurrentlyOnline) {
            await updateDeviceStatus(supabase, system.id, false)
            deviceStatus.set(deviceId, false)
            results.push({ deviceId, status: 'offline', updated: true, reason: 'no_random_value' })
          }
          continue
        }

        // Logic for active devices:
        // If random value has changed since the last check, the device is actively sending data
        const valueHasChanged = randomValue !== system.last_random_value && randomValue !== 0
        
        // Check time since last activity
        const timeSinceLastSeen = lastSeenAt ? now - lastSeenAt : Infinity
        const isInactive = timeSinceLastSeen > OFFLINE_THRESHOLD
        
        // Debug logs
        console.log(`Device ${deviceId}: valueHasChanged=${valueHasChanged}, timeSinceLastSeen=${Math.floor(timeSinceLastSeen/1000)}s, isInactive=${isInactive}`)
        
        if (valueHasChanged) {
          // Device is active, update as online with new timestamp and random_value
          const { error: updateError } = await supabase
            .from('inverter_systems')
            .update({
              last_seen_at: new Date().toISOString(),
              last_random_value: randomValue,
              is_online: true
            })
            .eq('id', system.id)

          if (updateError) {
            console.error(`Error updating device ${deviceId} as online:`, updateError)
            results.push({ deviceId, status: 'error', message: updateError.message })
          } else {
            console.log(`Updated device ${deviceId} as ONLINE, new random_value: ${randomValue}`)
            deviceStatus.set(deviceId, true)
            results.push({ deviceId, status: 'online', updated: true })
          }
        } else if (isInactive) {
          // No activity for a while, mark as offline
          if (isCurrentlyOnline) {
            await updateDeviceStatus(supabase, system.id, false)
            deviceStatus.set(deviceId, false)
            console.log(`Updated device ${deviceId} as OFFLINE, no activity for > ${OFFLINE_THRESHOLD/1000}s`)
            results.push({ deviceId, status: 'offline', updated: true, reason: 'inactivity' })
          } else {
            results.push({ deviceId, status: 'still_offline', updated: false })
          }
        } else {
          // No change but not inactive yet, maintain current status
          console.log(`Device ${deviceId}: No change in random_value, maintaining current online status: ${isCurrentlyOnline}`)
          results.push({ deviceId, status: 'no change', updated: false })
        }
      } catch (error) {
        console.error(`Error checking device ${deviceId}:`, error)
        results.push({ deviceId, status: 'error', message: error.message })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in device status monitor function:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to extract random value from different data formats
function getDeviceRandomValue(data: any): number | undefined {
  // First check if the data field contains a comma-separated string with the random value at position 20
  if (data.data && typeof data.data === 'string') {
    try {
      const values = data.data.split(',')
      if (values.length >= 21) {
        // From the hardware code, we know the random value is at position 20
        return parseInt(values[20], 10) || 0
      }
    } catch (e) {
      console.error(`Error parsing data string:`, e)
    }
  }
  
  // Check if random_value exists directly in the data object
  if (data.random_value !== undefined) {
    return parseInt(String(data.random_value), 10) || 0
  }
  
  return undefined
}

// Helper function to update device status
async function updateDeviceStatus(supabase: any, systemId: string, isOnline: boolean) {
  const updateData: any = { 
    is_online: isOnline
  };
  
  // Only update last_seen_at if going online
  if (isOnline) {
    updateData.last_seen_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('inverter_systems')
    .update(updateData)
    .eq('id', systemId)
  
  if (error) {
    console.error(`Error updating device status to ${isOnline ? 'online' : 'offline'}:`, error)
    return false
  }
  return true
}
