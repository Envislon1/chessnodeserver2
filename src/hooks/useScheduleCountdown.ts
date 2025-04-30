import { useState, useEffect, useRef } from 'react';

// This hook calculates a countdown to a scheduled event
export const useScheduleCountdown = (triggerTime: string, dayOfWeek: string) => {
  const [countdown, setCountdown] = useState<string>('');
  const lastCalculationRef = useRef<number>(0);
  const triggerRef = useRef<boolean>(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      lastCalculationRef.current = now.getTime();
      
      // Parse the trigger time correctly
      const [hours, minutes] = triggerTime.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) {
        console.error(`Invalid trigger time format: "${triggerTime}"`);
        return 'Invalid time format';
      }
      
      // Create target date with proper UTC handling
      const targetDate = new Date();
      targetDate.setUTCHours(hours, minutes, 0, 0);
      
      // If the target time has passed today, move to next occurrence
      if (targetDate.getTime() < now.getTime()) {
        targetDate.setUTCDate(targetDate.getUTCDate() + 1);
      }
      
      // Calculate days until next occurrence based on day of week
      const currentDay = now.getUTCDay();
      const dayMap: Record<string, number> = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };
      const targetDay = dayMap[dayOfWeek];
      
      if (targetDay === undefined) {
        console.error(`Invalid day of week: "${dayOfWeek}"`);
        return 'Invalid day format';
      }
      
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && targetDate.getTime() < now.getTime()) daysUntil = 7;
      
      targetDate.setUTCDate(targetDate.getUTCDate() + daysUntil);
      
      // Calculate difference
      let timeDiff = targetDate.getTime() - now.getTime();
      
      // Detailed logging for debugging
      console.log(`Schedule calculation for ${triggerTime} on ${dayOfWeek}:`, {
        now: now.toISOString(),
        targetDate: targetDate.toISOString(),
        currentDay,
        targetDay,
        daysUntil,
        diffMs: timeDiff,
        diffMinutes: Math.floor(timeDiff / (1000 * 60))
      });
      
      // Important: Set trigger state when we're extremely close to or past the trigger time
      if (timeDiff <= 0) {
        triggerRef.current = true;
        console.log(`TRIGGER STATE ACTIVATED for ${triggerTime} on ${dayOfWeek}! Exact trigger time reached.`);
        return 'Triggering...';
      }
      
      if (timeDiff < 60000) { // Less than a minute
        triggerRef.current = true;
        console.log(`TRIGGER STATE ACTIVATED for ${triggerTime} on ${dayOfWeek}! Less than a minute away.`);
        return 'Triggering soon';
      }
      
      triggerRef.current = false;
      
      // Convert to days, hours, minutes
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      timeDiff -= days * (1000 * 60 * 60 * 24);
      
      const hrs = Math.floor(timeDiff / (1000 * 60 * 60));
      timeDiff -= hrs * (1000 * 60 * 60);
      
      const mins = Math.floor(timeDiff / (1000 * 60));
      
      if (days > 0) {
        return `in ${days}d ${hrs}h ${mins}m`;
      } else if (hrs > 0) {
        return `in ${hrs}h ${mins}m`;
      } else if (mins > 0) {
        return `in ${mins}m`;
      } else {
        return 'Triggering soon';
      }
    };

    // Initial calculation
    setCountdown(calculateTimeRemaining());
    
    // Update more frequently as we get closer to the trigger time
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setCountdown(remaining);
      
      // If we're close to triggering, update more frequently
      if (remaining === 'Triggering soon' || remaining === 'Triggering...') {
        clearInterval(interval);
        const quickInterval = setInterval(() => {
          const nowState = calculateTimeRemaining();
          setCountdown(nowState);
          
          // Auto-trigger execution when we hit the exact time
          const shouldAutoTrigger = triggerRef.current && (nowState === 'Triggering...' || nowState === 'Triggering soon');
      
          if (shouldAutoTrigger) {
            console.log(`AUTO-TRIGGER ATTEMPT for ${triggerTime} on ${dayOfWeek}`);
            console.log('Trigger conditions met:', {
              triggerState: triggerRef.current,
              currentState: nowState,
              triggerTime,
              dayOfWeek
            });
          }
        }, 1000); // Check every second when close to trigger time
        
        // Clean up the quick interval after 2 minutes
        setTimeout(() => {
          clearInterval(quickInterval);
        }, 120000);
      }
    }, 10000); // Update every 10 seconds normally (increased frequency from 30s)
    
    return () => clearInterval(interval);
  }, [triggerTime, dayOfWeek]);

  return countdown;
};

// This function calculates the countdown without using hooks
// It can be safely used in loops or array iterations
export const calculateCountdown = (triggerTime: string, dayOfWeek: string): string => {
  const now = new Date();
  
  // Parse the trigger time correctly
  const [hours, minutes] = triggerTime.split(':').map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) {
    return 'Invalid time';
  }
  
  // Create target date with proper UTC handling
  const targetDate = new Date();
  targetDate.setUTCHours(hours, minutes, 0, 0);
  
  // If the target time has passed today, move to next occurrence
  if (targetDate.getTime() < now.getTime()) {
    targetDate.setUTCDate(targetDate.getUTCDate() + 1);
  }
  
  // Calculate days until next occurrence based on day of week
  const currentDay = now.getUTCDay();
  const dayMap: Record<string, number> = {
    'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 
    'Thursday': 4, 'Friday': 5, 'Saturday': 6
  };
  const targetDay = dayMap[dayOfWeek];
  
  if (targetDay === undefined) {
    return 'Invalid day';
  }
  
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  if (daysUntil === 0 && targetDate.getTime() < now.getTime()) daysUntil = 7;
  
  targetDate.setUTCDate(targetDate.getUTCDate() + daysUntil);
  
  // Calculate difference
  let diff = targetDate.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Triggering...';
  }
  
  if (diff < 60000) { // Less than a minute
    return 'Triggering soon';
  }
  
  // Convert to days, hours, minutes
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * (1000 * 60 * 60 * 24);
  
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  diff -= hrs * (1000 * 60 * 60);
  
  const mins = Math.floor(diff / (1000 * 60));
  
  if (days > 0) {
    return `in ${days}d ${hrs}h ${mins}m`;
  } else if (hrs > 0) {
    return `in ${hrs}h ${mins}m`;
  } else if (mins > 0) {
    return `in ${mins}m`;
  } else {
    return 'Triggering soon2';
  }
};
