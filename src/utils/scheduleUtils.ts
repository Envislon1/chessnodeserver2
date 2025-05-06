
import { supabase } from "@/integrations/supabase/client";
import { getUTCHHMMFormat } from "./timeUtils";

/**
 * Manually trigger the schedule-runner to check and run schedules
 * Useful for debugging scheduling issues
 * 
 * @param systemId Optional system ID to filter schedules
 * @param testTime Optional time to test in format "HH:MM"
 * @param testDay Optional day to test (Monday, Tuesday, etc.)
 * @param executeNow Whether to execute the schedules if found (default: false)
 * @returns Response from the schedule-runner function
 */
export async function manuallyTriggerScheduleCheck(
  systemId?: string,
  testTime?: string,
  testDay?: string,
  executeNow: boolean = false
) {
  try {
    // If no test time provided, use current UTC time in HH:MM format
    const currentTime = testTime || getUTCHHMMFormat(new Date());
    
    const { data, error } = await supabase.functions.invoke("schedule-runner", {
      method: "POST",
      body: {
        manual_test: !executeNow, // If executeNow is true, we want manual_test to be false
        execute_schedules: executeNow,
        system_id: systemId,
        test_time: currentTime,
        test_day: testDay,
        user_time: {
          local: new Date().toLocaleTimeString(),
          browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          current_utc: new Date().toUTCString(),
          formatted_utc_time: currentTime
        }
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error manually triggering schedule check:", error);
    throw error;
  }
}

/**
 * Force execute a specific schedule right now
 * 
 * @param scheduleId The ID of the schedule to execute
 * @param systemId The system ID associated with the schedule
 * @returns Response from the scheduled-inverter-control function
 */
export async function forceExecuteSchedule(scheduleId: string, systemId: string) {
  try {
    // First, get the schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from('inverter_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
      
    if (scheduleError) throw scheduleError;
    if (!schedule) throw new Error(`Schedule with ID ${scheduleId} not found`);
    
    // Execute the schedule by calling the scheduled-inverter-control function directly
    const { data, error } = await supabase.functions.invoke("scheduled-inverter-control", {
      method: "POST",
      body: {
        system_id: systemId,
        state: schedule.state,
        user_email: "manual-execution@user.request",
        schedule_id: scheduleId,
        trigger_time: schedule.trigger_time,
        manual_execution: true
      }
    });

    if (error) throw error;
    return { success: true, data, schedule };
  } catch (error) {
    console.error("Error forcing schedule execution:", error);
    throw error;
  }
}

/**
 * Add diagnostic logging for scheduling issues
 * 
 * @param systemId System ID to log against
 * @param message Message to log
 * @param details Additional details to include
 */
export async function logScheduleDiagnostics(systemId: string, message: string, details: any) {
  try {
    await supabase
      .from('scheduled_actions_log')
      .insert({
        system_id: systemId,
        action: 'diagnostic',
        triggered_by: 'client',
        details: {
          message,
          client_time: new Date().toISOString(),
          client_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...details
        }
      });
    console.log(`[Scheduler Diagnostics] ${message}`, details);
    return true;
  } catch (error) {
    console.error("Error logging diagnostics:", error);
    return false;
  }
}

/**
 * Get active schedules for a system
 * 
 * @param systemId System ID to get schedules for
 * @returns Array of active schedules
 */
export async function getActiveSchedules(systemId: string) {
  try {
    const { data, error } = await supabase
      .from('inverter_schedules')
      .select('*')
      .eq('system_id', systemId)
      .eq('is_active', true);
      
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching active schedules:", error);
    throw error;
  }
}

/**
 * Create a new diagnostics record to verify server time vs client time
 * 
 * @param systemId System ID to run the test for
 * @returns The data from the diagnostic test
 */
export async function runTimeAlignmentTest(systemId: string) {
  try {
    // Local time information
    const now = new Date();
    const localData = {
      local_time: now.toISOString(),
      local_utc_hhmm: getUTCHHMMFormat(now),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezone_offset: now.getTimezoneOffset()
    };
    
    // Make a call to get the server time directly
    const { data: serverTimeData, error: serverTimeError } = await supabase.functions.invoke("schedule-runner", {
      method: "POST",
      body: {
        diagnostics_only: true,
        client_time: localData,
        system_id: systemId
      }
    });
    
    if (serverTimeError) throw serverTimeError;
    
    // Log the results for future reference
    await logScheduleDiagnostics(systemId, "Time alignment test", {
      local: localData,
      server: serverTimeData
    });
    
    return {
      success: true,
      local: localData,
      server: serverTimeData
    };
  } catch (error) {
    console.error("Error in time alignment test:", error);
    throw error;
  }
}

/**
 * Verify that schedule formats match what's expected by the schedule runner
 * 
 * @param systemId System ID to check schedules for
 * @returns Validation results for schedules
 */
export async function verifySchedulesFormat(systemId: string) {
  try {
    const schedules = await getActiveSchedules(systemId);
    
    // Check each schedule for potential format issues
    const validationResults = schedules.map(schedule => {
      const issues = [];
      
      // Validate time format (should be exactly HH:MM with leading zeros)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(schedule.trigger_time)) {
        issues.push(`Invalid time format: "${schedule.trigger_time}" - should be HH:MM with 24-hour format`);
      }
      
      // Validate days of week (should be exactly matching the expected day names)
      const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      for (const day of schedule.days_of_week) {
        if (!validDays.includes(day)) {
          issues.push(`Invalid day: "${day}" - should be one of ${validDays.join(', ')}`);
        }
      }
      
      return {
        id: schedule.id,
        trigger_time: schedule.trigger_time,
        days: schedule.days_of_week,
        state: schedule.state ? "ON" : "OFF",
        is_active: schedule.is_active,
        issues: issues,
        valid: issues.length === 0
      };
    });
    
    // Log the validation results
    await logScheduleDiagnostics(systemId, "Schedule validation check", {
      schedules: validationResults,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: true,
      total_schedules: schedules.length,
      valid_schedules: validationResults.filter(r => r.valid).length,
      invalid_schedules: validationResults.filter(r => !r.valid).length,
      validation_results: validationResults
    };
  } catch (error) {
    console.error("Error verifying schedules format:", error);
    throw error;
  }
}

/**
 * Fix time format for a schedule to ensure it matches the expected HH:MM format
 * 
 * @param scheduleId Schedule ID to update
 * @param currentTime Current time value 
 * @returns Updated schedule if fixed, or null if no fix was needed
 */
export async function fixScheduleTimeFormat(scheduleId: string) {
  try {
    // Get the schedule
    const { data: schedule, error: getError } = await supabase
      .from('inverter_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
      
    if (getError) throw getError;
    if (!schedule) throw new Error(`Schedule with ID ${scheduleId} not found`);
    
    // Check if time format needs fixing
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (timeRegex.test(schedule.trigger_time)) {
      // Time format is already correct
      return null;
    }
    
    // Try to parse and fix the time
    let fixedTime = schedule.trigger_time;
    
    // Handle missing leading zeros
    if (/^\d{1}:\d{2}$/.test(schedule.trigger_time)) {
      fixedTime = `0${schedule.trigger_time}`;
    }
    // Handle missing leading zero in minutes
    else if (/^([01]\d|2[0-3]):\d{1}$/.test(schedule.trigger_time)) {
      fixedTime = `${schedule.trigger_time.split(':')[0]}:0${schedule.trigger_time.split(':')[1]}`;
    }
    // Handle other formats - convert to 24-hour HH:MM
    else {
      try {
        // Try to parse as a date
        const [hours, minutes] = schedule.trigger_time.split(':');
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        
        if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          fixedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        } else {
          throw new Error(`Cannot parse time: ${schedule.trigger_time}`);
        }
      } catch (parseError) {
        throw new Error(`Cannot fix time format for: ${schedule.trigger_time}`);
      }
    }
    
    // Update the schedule with fixed time
    const { data: updatedSchedule, error: updateError } = await supabase
      .from('inverter_schedules')
      .update({ trigger_time: fixedTime })
      .eq('id', scheduleId)
      .select()
      .single();
      
    if (updateError) throw updateError;
    
    return {
      original: schedule,
      updated: updatedSchedule,
      fixed_from: schedule.trigger_time,
      fixed_to: fixedTime
    };
  } catch (error) {
    console.error("Error fixing schedule time format:", error);
    throw error;
  }
}
