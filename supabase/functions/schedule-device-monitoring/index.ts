
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://hzqnccsmejplilhmisgu.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const PROJECT_URL = 'https://hzqnccsmejplilhmisgu.supabase.co'

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

    // Call the device-status-monitor function with strong cache busting
    const timestamp = new Date().getTime();
    const response = await fetch(`${PROJECT_URL}/functions/v1/device-status-monitor?_cb=${timestamp}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to call device-status-monitor function: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    console.log('Device monitoring execution successful:', result)

    return new Response(JSON.stringify({ 
      success: true, 
      timestamp: new Date().toISOString(),
      checked_devices: result.results ? result.results.length : 0,
      updated_devices: result.results ? result.results.filter((r: any) => r.updated).length : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in schedule-device-monitoring function:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
