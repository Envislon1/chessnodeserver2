
// This function runs periodically to check and execute scheduled inverter tasks
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to parse request body if present
    let requestData: any = {};
    let isManualTest = false;
    let executeSchedules = true; // By default, execute schedules
    let specificSystemId = null;
    let userTime = null;
    let testTime = null;
    let testDay = null;
    let diagnosticsOnly = false;

    if (req.method === 'POST') {
      try {
        requestData = await req.json();
        isManualTest = requestData.manual_test === true;
        executeSchedules = requestData.execute_schedules !== false; // Default to true unless explicitly false
        specificSystemId = requestData.system_id;
        userTime = requestData.user_time;
        diagnosticsOnly = requestData.diagnostics_only === true;
        testTime = requestData.test_time;
        testDay = requestData.test_day;
        console.log(`[DEBUG] Received request data: ${JSON.stringify(requestData)}`);
      } catch (e) {
        console.log("[DEBUG] No request body or invalid JSON");
      }
    }
    
    // If this is just a diagnostics request, return server time info without checking schedules
    if (diagnosticsOnly) {
      const serverTime = new Date();
      const serverTimeInfo = {
        server_time: serverTime.toISOString(),
        server_time_utc: serverTime.toUTCString(),
        server_hours_utc: serverTime.getUTCHours(),
        server_minutes_utc: serverTime.getUTCMinutes(),
        server_day_utc: serverTime.getUTCDay(),
        server_timestamp_ms: serverTime.getTime(),
        formatted_hhmm: `${String(serverTime.getUTCHours()).padStart(2, '0')}:${String(serverTime.getUTCMinutes()).padStart(2, '0')}`
      };
      
      // Log diagnostic request
      await supabase
        .from('scheduled_actions_log')
        .insert({
          system_id: specificSystemId || 'diagnostics',
          action: 'time_diagnostics',
          triggered_by: 'client',
          details: {
            server_time: serverTimeInfo,
            client_time: requestData.client_time,
            request_data: requestData
          }
        });
        
      return new Response(
        JSON.stringify(serverTimeInfo),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get server time information - first try using the SQL function
    let serverTimeData;
    let timeError = null;
    
    try {
      const { data, error } = await supabase.rpc('get_current_time');
      if (error) throw error;
      serverTimeData = data;
      console.log(`[DEBUG] Server time from SQL RPC: ${JSON.stringify(serverTimeData)}`);
    } catch (sqlError) {
      console.error("[ERROR] Failed to get time from SQL function:", sqlError);
      timeError = sqlError;
      
      // If SQL function fails, use our edge function directly as fallback
      try {
        const timeResponse = await fetch(
          `${supabaseUrl}/functions/v1/get-current-time`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            }
          }
        );
        
        if (!timeResponse.ok) {
          throw new Error(`Time function returned ${timeResponse.status}`);
        }
        
        serverTimeData = await timeResponse.json();
        console.log(`[DEBUG] Server time from edge function: ${JSON.stringify(serverTimeData)}`);
      } catch (edgeFunctionError) {
        console.error("[ERROR] Edge function time fetch failed too:", edgeFunctionError);
        
        // Last resort: use server's time directly
        const now = new Date();
        serverTimeData = {
          server_time: now.toISOString(),
          timezone: "UTC",
          timestamp_utc: now.toUTCString(),
          unix_timestamp: Math.floor(now.getTime() / 1000)
        };
        console.log("[DEBUG] Using fallback server time:", serverTimeData);
      }
    }
    
    // Parse server time data
    const now = new Date(serverTimeData.server_time);
    
    // Format time correctly for comparison with schedules
    // Schedules use HH:MM format in UTC, so we need to extract those components
    const hours = now.getUTCHours().toString().padStart(2, "0");
    const minutes = now.getUTCMinutes().toString().padStart(2, "0");
    const currentTime = testTime || `${hours}:${minutes}`;
    
    // Get current day name in English
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = testDay || dayNames[now.getUTCDay()]; // Use UTC day

    // Add more detailed logging
    console.log(`[DEBUG] Running schedule check at ${currentTime} on ${dayOfWeek} (${now.toISOString()})`);
    console.log(`[DEBUG] Server time: ${now.toString()}, Server timezone: ${serverTimeData.timezone}, UTC time: ${serverTimeData.timestamp_utc}`);
    console.log(`[DEBUG] Current UTC hours: ${hours}, UTC minutes: ${minutes}, UTC day: ${now.getUTCDay()} (${dayOfWeek})`);
    
    if (isManualTest) {
      console.log(`[DEBUG] MANUAL TEST MODE - User time info: ${JSON.stringify(userTime || "unknown")}`);
    }

    // Debug: Log all active schedules to see what's available
    let allSchedulesQuery = supabase.from('inverter_schedules').select('*').eq('is_active', true);
    
    // If this is a manual test for a specific system, filter for that system's schedules
    if (specificSystemId) {
      allSchedulesQuery = allSchedulesQuery.eq('system_id', specificSystemId);
    }
    
    const { data: allSchedules, error: allSchedulesError } = await allSchedulesQuery;

    if (allSchedulesError) {
      console.error("[ERROR] Error fetching all schedules:", allSchedulesError);
    } else {
      console.log(`[DEBUG] All active schedules (${allSchedules?.length || 0}):`);
      allSchedules?.forEach(schedule => {
        console.log(`[DEBUG] Schedule ID ${schedule.id} - Time: ${schedule.trigger_time}, Days: ${JSON.stringify(schedule.days_of_week)}, Action: ${schedule.state ? 'ON' : 'OFF'}, System: ${schedule.system_id}`);
      });
    }

    // IMPORTANT: Log the exact time we're matching against to help debug
    console.log(`[DEBUG] CRITICAL - Looking for schedules that match exactly: time="${currentTime}" day="${dayOfWeek}"`);

    // Find schedules that should run now
    let schedulesToRunQuery = supabase
      .from('inverter_schedules')
      .select('*')
      .eq('is_active', true);
      
    // For normal operation, filter by current time
    if (!isManualTest || (isManualTest && testTime)) {
      // CRITICAL FIX: Ensure proper time comparison by using exact string match
      schedulesToRunQuery = schedulesToRunQuery
        .eq('trigger_time', currentTime)
        .contains('days_of_week', [dayOfWeek]);
        
      console.log(`[DEBUG] Filtering schedules for time=${currentTime} and day=${dayOfWeek}`);
    }
    
    // For manual test with a specific system, only check that system's schedules
    if (specificSystemId) {
      schedulesToRunQuery = schedulesToRunQuery.eq('system_id', specificSystemId);
      console.log(`[DEBUG] Filtering for system ${specificSystemId}`);
    }
    
    const { data: schedulesToRun, error } = await schedulesToRunQuery;
      
    if (error) {
      console.error("[ERROR] Error fetching schedules:", error);
      throw error;
    }
    
    console.log(`[DEBUG] Found ${schedulesToRun?.length || 0} schedules ${isManualTest ? 'for testing' : 'to execute'}:`, JSON.stringify(schedulesToRun));
    
    // Add a debug log to Supabase for schedule checks, even if no schedule is found
    const logDetails = {
      server_info: serverTimeData,
      current_time: currentTime,
      day_of_week: dayOfWeek,
      timestamp: now.toISOString(),
      schedules_found: schedulesToRun?.length || 0,
      schedules: schedulesToRun || [],
      all_active_schedules: allSchedules?.length || 0,
      server_time: now.toString(),
      is_manual_test: isManualTest,
      execute_schedules: executeSchedules,
      request_data: requestData,
      time_error: timeError ? timeError.message : null,
      formatted_utc_server_time: {
        hours: hours,
        minutes: minutes,
        formatted: `${hours}:${minutes}`,
        day: dayOfWeek,
        day_number: now.getUTCDay()
      }
    };

    await supabase
      .from('scheduled_actions_log')
      .insert({
        system_id: specificSystemId || 'schedule-runner',
        action: isManualTest ? 'manual_test' : 'schedule_check',
        triggered_by: isManualTest ? 'user' : 'system',
        details: logDetails
      });
    
    // For manual tests or when execute_schedules is false, don't actually execute the schedules
    if (isManualTest && !executeSchedules) {
      return new Response(
        JSON.stringify({
          message: "Manual test completed without execution",
          server_time_info: serverTimeData,
          executed_at: now.toISOString(),
          current_time: currentTime,
          day_of_week: dayOfWeek,
          schedules_found: schedulesToRun?.length || 0,
          schedules: schedulesToRun,
          details: logDetails
        }),
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          } 
        }
      );
    }
    
    // Execute each schedule (for both normal operation and manual tests with executeSchedules=true)
    const results = [];
    for (const schedule of schedulesToRun || []) {
      try {
        console.log(`[DEBUG] Processing schedule: ${JSON.stringify(schedule)}`);
        
        // Get the system info including owner email
        const { data: systemInfo, error: systemError } = await supabase
          .from('inverter_systems')
          .select('*, profiles(email)')
          .eq('system_id', schedule.system_id)
          .maybeSingle();
          
        if (systemError) {
          console.error(`[ERROR] Error fetching system info for ${schedule.system_id}:`, systemError);
          throw new Error(`Error fetching system info: ${systemError.message}`);
        }
        
        if (!systemInfo) {
          throw new Error(`System ${schedule.system_id} not found`);
        }
          
        // Call the scheduled-inverter-control function
        const functionUrl = `${supabaseUrl}/functions/v1/scheduled-inverter-control`;
        console.log(`[DEBUG] Calling function at ${functionUrl} for system ${schedule.system_id} to set power state to ${schedule.state ? "ON" : "OFF"}`);
        
        const payload = {
          system_id: schedule.system_id,
          state: schedule.state,
          user_email: systemInfo?.profiles?.email || "schedule@system.auto",
          schedule_id: schedule.id,
          trigger_time: currentTime
        };
        
        console.log(`[DEBUG] Sending payload: ${JSON.stringify(payload)}`);
        
        // Make 3 attempts with increasing timeouts 
        let response;
        let attemptCount = 0;
        const maxAttempts = 3;
        
        while (attemptCount < maxAttempts) {
          try {
            console.log(`[DEBUG] Attempt ${attemptCount + 1} to call inverter control function`);
            
            response = await fetch(
              functionUrl,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify(payload)
              }
            );
            
            // If successful, break the retry loop
            if (response.ok) {
              console.log(`[DEBUG] Function call successful on attempt ${attemptCount + 1}`);
              break;
            }
            
            // If failed, log and try again (unless it's the last attempt)
            console.error(`[ERROR] Function returned status ${response.status} on attempt ${attemptCount + 1}`);
            attemptCount++;
            
            if (attemptCount < maxAttempts) {
              // Exponential backoff
              const waitMs = Math.pow(2, attemptCount) * 500;
              console.log(`[DEBUG] Waiting ${waitMs}ms before retry attempt ${attemptCount + 1}`);
              await new Promise(resolve => setTimeout(resolve, waitMs));
            }
          } catch (fetchError) {
            console.error(`[ERROR] Fetch error on attempt ${attemptCount + 1}:`, fetchError);
            attemptCount++;
            
            if (attemptCount < maxAttempts) {
              const waitMs = Math.pow(2, attemptCount) * 500;
              console.log(`[DEBUG] Waiting ${waitMs}ms before retry attempt ${attemptCount + 1}`);
              await new Promise(resolve => setTimeout(resolve, waitMs));
            } else {
              throw fetchError;
            }
          }
        }
        
        // Handle the final response
        if (!response || !response.ok) {
          throw new Error(`Function returned status ${response?.status || 'unknown'}`);
        }
        
        const responseText = await response.text();
        console.log(`[DEBUG] Function response status: ${response.status}, text: ${responseText}`);
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error("[ERROR] Could not parse response as JSON:", e);
          result = { raw_response: responseText };
        }
        
        // Log the execution
        await supabase
          .from('schedule_executions')
          .insert({
            schedule_id: schedule.id,
            system_id: schedule.system_id,
            executed_at: now.toISOString(),
            success: true,
            result: result
          });
          
        results.push({
          schedule_id: schedule.id,
          system_id: schedule.system_id,
          success: true,
          message: `Power set to ${schedule.state ? 'ON' : 'OFF'}`
        });
        
        console.log(`[DEBUG] Successfully executed schedule ${schedule.id} for system ${schedule.system_id}`);
      } catch (schedulingError) {
        console.error(`[ERROR] Error executing schedule ${schedule.id}:`, schedulingError);
        
        // Log the failed execution
        await supabase
          .from('schedule_executions')
          .insert({
            schedule_id: schedule.id,
            system_id: schedule.system_id,
            executed_at: now.toISOString(),
            success: false,
            error: schedulingError.message
          });
          
        results.push({
          schedule_id: schedule.id,
          system_id: schedule.system_id,
          success: false,
          error: schedulingError.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        executed_at: now.toISOString(),
        current_time: currentTime,
        day_of_week: dayOfWeek,
        schedules_executed: schedulesToRun?.length || 0,
        results: results
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  } catch (error) {
    console.error("[ERROR] Error in schedule runner:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        }, 
        status: 500 
      }
    );
  }
});
