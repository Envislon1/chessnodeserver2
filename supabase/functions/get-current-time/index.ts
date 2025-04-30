
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const now = new Date()
    const utcTime = new Date(now.toUTCString())
    
    const response = {
      server_time: now.toISOString(),
      timezone: "UTC",
      timestamp_utc: utcTime.toISOString(),
      unix_timestamp: Math.floor(now.getTime() / 1000)
    }
    
    return new Response(
      JSON.stringify(response),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
        status: 200 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { 
          ...corsHeaders,
          "Content-Type": "application/json" 
        },
        status: 500 
      }
    )
  }
})
