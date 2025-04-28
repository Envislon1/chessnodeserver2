
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { accountNumber, bankCode } = await req.json();
    
    if (!accountNumber || !bankCode) {
      return new Response(
        JSON.stringify({ 
          status: false, 
          message: "Account number and bank code are required" 
        }),
        { 
          headers: corsHeaders,
          status: 400 
        }
      );
    }
    
    // Get the API key from environment variables
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY not available");
      return new Response(
        JSON.stringify({ 
          status: false, 
          message: "Payment provider configuration error" 
        }),
        { 
          headers: corsHeaders,
          status: 500 
        }
      );
    }
    
    // Call Paystack account verification endpoint
    const verifyResponse = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const verifyData = await verifyResponse.json();
    
    // Return the response from Paystack
    return new Response(
      JSON.stringify(verifyData),
      { 
        headers: corsHeaders,
        status: verifyResponse.status 
      }
    );
    
  } catch (error) {
    console.error("Error in verify-withdrawal:", error);
    return new Response(
      JSON.stringify({ 
        status: false, 
        message: error.message || "An unexpected error occurred" 
      }),
      { 
        headers: corsHeaders,
        status: 500 
      }
    );
  }
});
