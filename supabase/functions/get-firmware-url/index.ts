
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const shortId = url.pathname.split('/').pop()

    if (!shortId) {
      return new Response(
        JSON.stringify({ error: "No short ID provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the original URL from the database
    const { data, error } = await supabaseClient
      .from('firmware_url_mapping')
      .select('original_url, expires_at')
      .eq('short_id', shortId)
      .lt('expires_at', new Date(Date.now() + 86400000).toISOString()) // Check if not expired
      .maybeSingle()

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Short URL not found or expired" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Instead of redirecting, we'll fetch the binary file and serve it with proper headers
    try {
      console.log(`Fetching firmware from URL: ${data.original_url}`);
      
      // IMPORTANT: Get file size before downloading via HEAD request
      const headResponse = await fetch(data.original_url, {
        method: 'HEAD',
      });
      
      if (!headResponse.ok) {
        throw new Error(`Failed to get firmware headers: ${headResponse.status} ${headResponse.statusText}`);
      }
      
      // Get content length from the HEAD request
      const contentLength = headResponse.headers.get("content-length");
      
      if (!contentLength) {
        console.error("Content-Length header missing in source URL");
        // If content-length is missing, we need to fetch the whole file to determine size
        console.log("Content-Length not provided by source, fetching entire file...");
      }
      
      // Now fetch the actual file
      const firmwareResponse = await fetch(data.original_url);
      
      if (!firmwareResponse.ok) {
        throw new Error(`Failed to fetch firmware: ${firmwareResponse.status} ${firmwareResponse.statusText}`);
      }
      
      // Get the binary data
      const firmwareArrayBuffer = await firmwareResponse.arrayBuffer();
      const firmwareUint8Array = new Uint8Array(firmwareArrayBuffer);
      
      // Get the filename from the URL
      const urlParts = data.original_url.split('/');
      const filename = urlParts[urlParts.length - 1].split('?')[0]; // Remove query params
      
      // CRITICAL: Set Content-Length header accurately based on the actual binary size
      const actualContentLength = firmwareUint8Array.length.toString();
      console.log(`Serving firmware file: ${filename}, size: ${actualContentLength} bytes`);
      
      // Return the firmware with proper headers for ESP32
      return new Response(firmwareUint8Array, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': actualContentLength,
          'Cache-Control': 'no-cache'
        }
      });
    } catch (fetchError) {
      console.error("Error fetching firmware:", fetchError);
      
      // Fall back to redirect if direct serving fails
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': data.original_url
        }
      });
    }
  } catch (err) {
    console.error("Error handling firmware URL request:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
