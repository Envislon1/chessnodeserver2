
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Set the Lichess API token and URL
const LICHESS_API_URL = "https://lichess.org/api";
const LICHESS_API_TOKEN = Deno.env.get("LICHESS_API_TOKEN") || "lip_suKGoqMXNMRAEzpR6zeP";

// CORS headers for browser access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  console.log("Lichess challenge function called");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }), 
        { status: 405, headers: corsHeaders }
      );
    }

    // Parse the request body
    let reqBody;
    try {
      reqBody = await req.json();
      console.log("Request body:", JSON.stringify(reqBody));
    } catch (e) {
      console.error("Failed to parse request body:", e);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    const { timeControl, mode = 'casual', color = 'random', variant = 'standard', increment = 0 } = reqBody;

    if (!timeControl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: timeControl' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Creating Lichess open challenge with time control: ${timeControl}, mode: ${mode}, color: ${color}, variant: ${variant}, increment: ${increment}`);

    // Convert minutes to seconds for Lichess API
    const clockLimit = parseInt(timeControl) * 60;
    
    // Create form data for the request
    const params = new URLSearchParams();
    params.append('clock.limit', clockLimit.toString());
    params.append('clock.increment', increment.toString());
    params.append('rated', mode === 'rated' ? 'true' : 'false');
    params.append('variant', variant);
    
    // Add color preference if not random
    if (color !== 'random') {
      params.append('color', color);
    }
    
    // Make it visible in the public pool to encourage joins
    params.append('keepAliveStream', 'true');
    
    // Add these additional parameters to ensure the challenge is properly created
    params.append('noGiveTime', 'true');  // Prevent players from giving time
    params.append('fen', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');  // Standard starting position
    params.append('timeout', '300');  // 5 minutes timeout for the challenge
    
    console.log(`Using API token: ${LICHESS_API_TOKEN ? "Token set" : "No token"}`);
    console.log(`Request parameters: ${params.toString()}`);
    
    // Call Lichess API to create an open challenge
    const response = await fetch(`${LICHESS_API_URL}/challenge/open`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LICHESS_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    console.log(`Lichess API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error from Lichess API:', errorText);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Lichess API error: ${response.status} ${response.statusText}`,
          details: errorText
        }), 
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    console.log('Challenge created successfully:', JSON.stringify(data));
    
    // Extract essential information for the client
    const challengeId = data.challenge.id;
    const challengeUrl = data.challenge.url;
    
    // Verify the challenge exists by checking its status
    try {
      const verifyResponse = await fetch(`${LICHESS_API_URL}/challenge/${challengeId}`, {
        headers: {
          'Authorization': `Bearer ${LICHESS_API_TOKEN}`
        }
      });
      
      console.log(`Challenge verification status: ${verifyResponse.status}`);
      
      if (!verifyResponse.ok) {
        console.warn(`Challenge may not be ready yet: ${verifyResponse.status}`);
      } else {
        console.log('Challenge verified successfully');
      }
      
    } catch (verifyError) {
      console.error('Error verifying challenge:', verifyError);
    }
    
    // Return successful response with challenge details
    return new Response(
      JSON.stringify({
        success: true,
        challengeId: challengeId,
        challengeUrl: challengeUrl,
        gameId: challengeId,
        status: 'active',
        message: "Challenge created successfully. Share the URL with your opponent."
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error creating challenge:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
