
import { useState, useEffect } from 'react';

interface Schedule {
  id: string;
  trigger_time: string;
  days_of_week: string[];
  state: boolean;
  is_active: boolean;
}

interface NextSchedule extends Schedule {
  next_day?: string;
}

export const useScheduleCountdown = (schedules: Schedule[]) => {
  const [nextSchedule, setNextSchedule] = useState<NextSchedule | null>(null);
  const [countdown, setCountdown] = useState<string>('');

  useEffect(() => {
    // Find the next upcoming schedule
    const findNextSchedule = () => {
      if (!schedules || schedules.length === 0) {
        setNextSchedule(null);
        setCountdown('');
        return;
      }

      const now = new Date();
      const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
      
      let nextSched: NextSchedule | null = null;
      let minDiff = Infinity;
      
      // Check all active schedules
      schedules
        .filter(schedule => schedule.is_active)
        .forEach(schedule => {
          // For each day in the schedule
          schedule.days_of_week.forEach(day => {
            const [hours, minutes] = schedule.trigger_time.split(':').map(Number);
            const scheduleDate = new Date();
            
            // If this is for a future day this week
            let dayDiff = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day) - 
                          ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(currentDay);
            
            if (dayDiff < 0) dayDiff += 7; // Next week if day has passed
            else if (dayDiff === 0) {
              // Today - check if time has passed
              if (hours < now.getHours() || 
                 (hours === now.getHours() && minutes <= now.getMinutes())) {
                dayDiff = 7; // Next week if time has passed today
              }
            }
            
            scheduleDate.setDate(now.getDate() + dayDiff);
            scheduleDate.setHours(hours, minutes, 0, 0);
            
            const diff = scheduleDate.getTime() - now.getTime();
            
            if (diff > 0 && diff < minDiff) {
              minDiff = diff;
              nextSched = { ...schedule, next_day: day };
            }
          });
        });
      
      setNextSchedule(nextSched);
    };
    
    // Calculate countdown time
    const updateCountdown = () => {
      if (!nextSchedule) {
        setCountdown('');
        return;
      }
      
      const now = new Date();
      const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
      const [hours, minutes] = nextSchedule.trigger_time.split(':').map(Number);
      
      let targetDate = new Date();
      let dayDiff = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(nextSchedule.next_day || '') - 
                    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(currentDay);
      
      if (dayDiff < 0) dayDiff += 7;
      else if (dayDiff === 0) {
        if (hours < now.getHours() || 
           (hours === now.getHours() && minutes <= now.getMinutes())) {
          dayDiff = 7;
        }
      }
      
      targetDate.setDate(now.getDate() + dayDiff);
      targetDate.setHours(hours, minutes, 0, 0);
      
      const diff = targetDate.getTime() - now.getTime();
      
      if (diff <= 0) {
        findNextSchedule(); // Recalculate next schedule if time has passed
        return;
      }
      
      // Format the countdown
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setCountdown(`${days}d ${remainingHours}h ${remainingMinutes}m`);
      } else if (remainingHours > 0) {
        setCountdown(`${remainingHours}h ${remainingMinutes}m`);
      } else {
        setCountdown(`${remainingMinutes}m`);
      }
    };
    
    findNextSchedule();
    
    if (nextSchedule) {
      updateCountdown();
    }
    
    const interval = setInterval(() => {
      updateCountdown();
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [schedules, nextSchedule]);
  
  return { nextSchedule, countdown };
};
