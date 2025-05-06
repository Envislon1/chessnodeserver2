
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get current server time
    const now = new Date();
    
    // Format response
    const data = {
      server_time: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp_utc: now.toUTCString(),
      unix_timestamp: Math.floor(now.getTime() / 1000)
    };

    // Return the response
    return new Response(
      JSON.stringify(data),
      { headers: corsHeaders, status: 200 },
    );
  } catch (error) {
    console.error("Error getting server time:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString() 
      }),
      { headers: corsHeaders, status: 500 },
    );
  }
})
