
import React, { useState, useEffect } from "react";
import { supabase, getServerTime } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { 
  Clock, CalendarClock, Power, Trash2, History, RefreshCw, Info, 
  Loader2, AlertCircle, Check, AlertTriangle, HelpCircle, WrenchIcon 
} from "lucide-react";
import { useInverterAndLoadsSwitches } from "./useInverterAndLoadsSwitches";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifySchedulesFormat, fixScheduleTimeFormat } from "@/utils/scheduleUtils";
import { calculateCountdown } from '@/hooks/useScheduleCountdown';

interface Schedule {
  id: string;
  system_id: string;
  trigger_time: string;
  state: boolean;
  days_of_week: string[];
  is_active: boolean;
  created_at: string;
}

interface ScheduleExecution {
  id: string;
  schedule_id: string;
  system_id: string;
  executed_at: string;
  success: boolean;
  error?: string;
  result?: any;
}

interface ScheduledControlsProps {
  inverterId: string;
}

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

interface TimeSync {
  localTime: string;
  serverTime: string;
  serverUtcTime: string;
  timeDiff: number;
  timezone: string;
  isLoading: boolean;
  lastSync: number;
  isSynced: boolean;
}

const ScheduledControls = ({ inverterId }: ScheduledControlsProps) => {
  const { systemId } = useInverterAndLoadsSwitches(inverterId);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [newSchedule, setNewSchedule] = useState({
    time: "",
    state: true,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [testInProgress, setTestInProgress] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<ScheduleExecution[]>([]);
  const [scheduleLogs, setScheduleLogs] = useState<any[]>([]);
  const [refreshLogsCounter, setRefreshLogsCounter] = useState(0);
  const [testValues, setTestValues] = useState({
    testTime: "",
    testDay: "Monday"
  });
  const [timeSync, setTimeSync] = useState<TimeSync>({
    localTime: new Date().toLocaleTimeString(),
    serverTime: "",
    serverUtcTime: "",
    timeDiff: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isLoading: true,
    lastSync: 0,
    isSynced: false
  });
  const [forceExecutionInProgress, setForceExecutionInProgress] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [fixingInProgress, setFixingInProgress] = useState(false);

  const getHHMMFormat = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  };

  const syncServerTime = async () => {
    try {
      const data = await getServerTime();
      
      if (!data) throw new Error("Failed to get server time");
      
      const now = new Date();
      const serverTimeDate = new Date(data.server_time);
      const serverUtcDate = new Date(data.timestamp_utc);
      
      const timeDiff = serverTimeDate.getTime() - now.getTime();
      
      setTimeSync({
        localTime: now.toLocaleTimeString(),
        serverTime: serverTimeDate.toLocaleTimeString(),
        serverUtcTime: serverUtcDate.toLocaleTimeString() + " UTC",
        timeDiff: timeDiff,
        timezone: data.timezone || "UTC",
        isLoading: false,
        lastSync: now.getTime(),
        isSynced: true
      });
      
      setNewSchedule(prev => ({
        ...prev,
        time: getHHMMFormat(serverUtcDate)
      }));
      
      console.log("Successfully synced server time:", data);
    } catch (error) {
      console.error('Error syncing server time:', error);
      
      const now = new Date();
      const utcNow = new Date(now.getTime());
      utcNow.setMinutes(utcNow.getMinutes() - utcNow.getTimezoneOffset());
      
      setTimeSync(prev => ({
        ...prev,
        localTime: now.toLocaleTimeString(),
        serverUtcTime: utcNow.toLocaleTimeString() + " UTC (estimated)",
        isLoading: false,
        isSynced: false
      }));
      
      setNewSchedule(prev => ({
        ...prev,
        time: getHHMMFormat(utcNow)
      }));
      
      toast({
        title: "Time sync failed",
        description: "Using local time estimates instead. Schedules may not be perfectly accurate.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    syncServerTime();
    
    const localTimeInterval = setInterval(() => {
      const now = new Date();
      
      if (timeSync.isSynced) {
        const approximateServerTime = new Date(now.getTime() + timeSync.timeDiff);
        const approximateUtcTime = new Date(approximateServerTime.toISOString());
        
        setTimeSync(prev => ({
          ...prev,
          localTime: now.toLocaleTimeString(),
          serverTime: approximateServerTime.toLocaleTimeString(),
          serverUtcTime: approximateUtcTime.toLocaleTimeString() + " UTC"
        }));
      } else {
        setTimeSync(prev => ({
          ...prev,
          localTime: now.toLocaleTimeString()
        }));
      }
    }, 1000);
    
    const serverSyncInterval = setInterval(() => {
      syncServerTime();
    }, 5 * 60 * 1000);
    
    return () => {
      clearInterval(localTimeInterval);
      clearInterval(serverSyncInterval);
    };
  }, [timeSync.isSynced, timeSync.timeDiff]);

  useEffect(() => {
    if (!systemId) return;
    
    const fetchSchedules = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('inverter_schedules')
          .select('*')
          .eq('system_id', systemId)
          .order('trigger_time');
          
        if (error) throw error;
        
        setSchedules((data || []) as Schedule[]);
      } catch (error: any) {
        console.error('Error fetching schedules:', error);
        toast({
          title: "Failed to load schedules",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSchedules();
  }, [systemId]);

  useEffect(() => {
    if (!systemId || !showDebugLogs) return;
    
    const fetchExecutionLogs = async () => {
      try {
        const { data: executions, error: executionsError } = await supabase
          .from('schedule_executions')
          .select('*')
          .eq('system_id', systemId)
          .order('executed_at', { ascending: false })
          .limit(20);
          
        if (executionsError) throw executionsError;
        setExecutionLogs(executions || []);
        
        const { data: logs, error: logsError } = await supabase
          .from('scheduled_actions_log')
          .select('*')
          .or(`system_id.eq.${systemId},system_id.eq.schedule-runner,action.eq.schedule_check`)
          .order('created_at', { ascending: false })
          .limit(20);
          
        if (logsError) throw logsError;
        setScheduleLogs(logs || []);
        
      } catch (error: any) {
        console.error('Error fetching execution logs:', error);
        toast({
          title: "Failed to load execution logs",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    fetchExecutionLogs();
    const interval = setInterval(() => {
      setRefreshLogsCounter(prev => prev + 1);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [systemId, showDebugLogs, refreshLogsCounter]);

  const toggleDay = (day: string) => {
    setNewSchedule(prev => {
      if (prev.days.includes(day)) {
        return { ...prev, days: prev.days.filter(d => d !== day) };
      } else {
        return { ...prev, days: [...prev.days, day] };
      }
    });
  };

  const handleDayPreset = (preset: 'weekdays' | 'weekend' | 'everyday' | 'clear') => {
    switch (preset) {
      case 'weekdays':
        setNewSchedule(prev => ({ ...prev, days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }));
        break;
      case 'weekend':
        setNewSchedule(prev => ({ ...prev, days: ["Saturday", "Sunday"] }));
        break;
      case 'everyday':
        setNewSchedule(prev => ({ ...prev, days: [...DAYS_OF_WEEK] }));
        break;
      case 'clear':
        setNewSchedule(prev => ({ ...prev, days: [] }));
        break;
      default:
        break;
    }
  };

  const handleAddSchedule = async () => {
    if (!systemId) return;
    
    if (newSchedule.days.length === 0) {
      toast({
        title: "No days selected",
        description: "Please select at least one day for the schedule",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      let formattedTime = newSchedule.time;
      
      if (!timeRegex.test(newSchedule.time)) {
        const [hours, minutes] = newSchedule.time.split(':');
        const h = parseInt(hours, 10);
        const m = parseInt(minutes, 10);
        
        if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        } else {
          toast({
            title: "Invalid time format",
            description: "Time must be in 24-hour format (HH:MM)",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }
      
      const { data, error } = await supabase
        .from('inverter_schedules')
        .insert({
          system_id: systemId,
          trigger_time: formattedTime,
          state: newSchedule.state,
          days_of_week: newSchedule.days,
          is_active: newSchedule.is_active
        })
        .select();
        
      if (error) throw error;
      
      setSchedules(prevSchedules => [...prevSchedules, ...(data as Schedule[])]);
      
      toast({
        title: "Schedule added",
        description: `The inverter will turn ${newSchedule.state ? 'ON' : 'OFF'} at ${formattedTime} UTC`,
      });
      
      setNewSchedule(prev => ({
        ...prev,
        state: true,
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      }));
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      toast({
        title: "Failed to add schedule",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('inverter_schedules')
        .update({ is_active: !currentState })
        .eq('id', id);
        
      if (error) throw error;
      
      setSchedules(schedules.map(schedule => 
        schedule.id === id 
          ? { ...schedule, is_active: !currentState } 
          : schedule
      ));
      
      toast({
        title: `Schedule ${!currentState ? 'enabled' : 'disabled'}`,
        description: `The scheduled task is now ${!currentState ? 'active' : 'inactive'}`,
      });
    } catch (error: any) {
      console.error('Error toggling schedule:', error);
      toast({
        title: "Failed to update schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inverter_schedules')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setSchedules(schedules.filter(schedule => schedule.id !== id));
      
      toast({
        title: "Schedule deleted",
        description: "The scheduled task has been removed",
      });
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Failed to delete schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatDays = (days: string[]) => {
    if (days.length === 7) return "Every day";
    if (days.length === 5 && 
        days.includes("Monday") && 
        days.includes("Tuesday") && 
        days.includes("Wednesday") && 
        days.includes("Thursday") && 
        days.includes("Friday")) return "Weekdays";
    if (days.length === 2 && 
        days.includes("Saturday") && 
        days.includes("Sunday")) return "Weekends";
    return days.join(", ");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getResultDetails = (result: any) => {
    if (!result) return 'No details available';
    
    try {
      if (typeof result === 'string') {
        return result;
      }
      
      return JSON.stringify(result, null, 2);
    } catch (e) {
      return 'Invalid result data';
    }
  };

  const testScheduleTrigger = async (executeNow = false) => {
    if (!systemId) return;

    try {
      setTestInProgress(true);
      setTestResult(null);
      
      await supabase
        .from('scheduled_actions_log')
        .insert({
          system_id: systemId,
          action: 'manual_test',
          triggered_by: 'user',
          details: { 
            message: executeNow ? "Manual execution triggered" : "Manual test triggered by user",
            timestamp: new Date().toISOString(),
            browser_time: timeSync.localTime,
            server_time: timeSync.serverTime,
            server_utc_time: timeSync.serverUtcTime,
            test_time: testValues.testTime || null,
            test_day: testValues.testDay || null,
            execute_now: executeNow,
            schedules: schedules.filter(s => s.is_active).map(s => ({
              id: s.id,
              time: s.trigger_time,
              days: s.days_of_week,
              state: s.state ? "ON" : "OFF"
            }))
          }
        });
      
      const { manuallyTriggerScheduleCheck } = await import("@/utils/scheduleUtils");
      
      const result = await manuallyTriggerScheduleCheck(
        systemId,
        testValues.testTime || null,
        testValues.testDay || null,
        executeNow
      );
      
      setTestResult(result);
      
      toast({
        title: executeNow ? "Schedule execution triggered" : "Schedule check triggered",
        description: testValues.testTime 
          ? `${executeNow ? "Execution" : "Test"} completed for ${testValues.testTime} on ${testValues.testDay}` 
          : executeNow 
            ? "Execution completed with current server time"
            : "Manual test completed with current server time",
      });
      
      setRefreshLogsCounter(prev => prev + 1);
    } catch (error: any) {
      console.error('Error triggering schedule check:', error);
      toast({
        title: executeNow ? "Failed to execute schedule" : "Failed to trigger schedule check",
        description: error.message,
        variant: "destructive",
      });
      setTestResult({ error: error.message });
    } finally {
      setTestInProgress(false);
      
      setTimeout(() => {
        setRefreshLogsCounter(prev => prev + 1);
      }, 2000);
    }
  };

  const forceExecuteSpecificSchedule = async (scheduleId: string) => {
    if (!systemId) return;
    
    setForceExecutionInProgress(true);
    try {
      const { forceExecuteSchedule } = await import("@/utils/scheduleUtils");
      
      const result = await forceExecuteSchedule(scheduleId, systemId);
      
      toast({
        title: "Schedule executed manually",
        description: `Schedule power state set to ${result.schedule.state ? "ON" : "OFF"}`,
      });
      
      setRefreshLogsCounter(prev => prev + 1);
    } catch (error: any) {
      console.error('Error executing schedule:', error);
      toast({
        title: "Failed to execute schedule",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setForceExecutionInProgress(false);
      
      setTimeout(() => {
        setRefreshLogsCounter(prev => prev + 1);
      }, 2000);
    }
  };

  const getTimeDifferenceText = () => {
    if (!timeSync.isSynced) return "Server time not synchronized";
    
    const diffMinutes = Math.abs(Math.round(timeSync.timeDiff / 60000));
    if (diffMinutes < 1) return "Your time is in sync with the server";
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    let diffText = "Your time is ";
    diffText += timeSync.timeDiff > 0 ? "behind" : "ahead of";
    diffText += " server time by ";
    
    if (hours > 0) {
      diffText += `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) diffText += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      diffText += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    return diffText;
  };

  const validateScheduleFormats = async () => {
    if (!systemId) return;
    
    try {
      setFixingInProgress(true);
      const results = await verifySchedulesFormat(systemId);
      setValidationResults(results);
      
      if (results.invalid_schedules > 0) {
        toast({
          title: "Found schedule format issues",
          description: `${results.invalid_schedules} of ${results.total_schedules} schedules have format issues that may prevent them from triggering.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "All schedules have valid formats",
          description: "No format issues detected that would prevent schedules from triggering.",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error('Error validating schedules:', error);
      toast({
        title: "Failed to validate schedules",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFixingInProgress(false);
    }
  };

  const fixScheduleFormat = async (scheduleId: string) => {
    if (!systemId) return;
    
    try {
      setFixingInProgress(true);
      const result = await fixScheduleTimeFormat(scheduleId);
      
      if (result) {
        setSchedules(prev => prev.map(s => 
          s.id === scheduleId 
            ? {...s, trigger_time: result.fixed_to} 
            : s
        ));
        
        if (validationResults) {
          setValidationResults(prev => ({
            ...prev,
            validation_results: prev.validation_results.map((r: any) => 
              r.id === scheduleId 
                ? {...r, trigger_time: result.fixed_to, issues: [], valid: true} 
                : r
            ),
            invalid_schedules: prev.invalid_schedules - 1,
            valid_schedules: prev.valid_schedules + 1
          }));
        }
        
        toast({
          title: "Schedule time format fixed",
          description: `Changed time from "${result.fixed_from}" to "${result.fixed_to}"`,
        });
      } else {
        toast({
          title: "No fix needed",
          description: "The schedule time format is already correct",
        });
      }
    } catch (error: any) {
      console.error('Error fixing schedule format:', error);
      toast({
        title: "Failed to fix schedule format",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFixingInProgress(false);
    }
  };

  const fixAllInvalidSchedules = async () => {
    if (!systemId || !validationResults) return;
    
    try {
      setFixingInProgress(true);
      const invalidSchedules = validationResults.validation_results.filter((r: any) => !r.valid);
      
      let fixedCount = 0;
      for (const schedule of invalidSchedules) {
        try {
          const result = await fixScheduleTimeFormat(schedule.id);
          if (result) {
            fixedCount++;
            setSchedules(prev => prev.map(s => 
              s.id === schedule.id 
                ? {...s, trigger_time: result.fixed_to} 
                : s
            ));
          }
        } catch (e) {
          console.error(`Error fixing schedule ${schedule.id}:`, e);
        }
      }
      
      await validateScheduleFormats();
      
      toast({
        title: `Fixed ${fixedCount} schedules`,
        description: fixedCount > 0 
          ? "Schedule formats have been updated to ensure proper triggering" 
          : "No schedules needed to be fixed",
      });
    } catch (error: any) {
      console.error('Error fixing all schedules:', error);
      toast({
        title: "Error fixing schedules",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFixingInProgress(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-black/40 border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-orange-500" />
            Scheduled Controls
          </CardTitle>
          <CardDescription className="text-gray-300">
            Set up automatic power switching for your inverter
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Time information section */}
            <div className="mb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 pb-2">
                <div className="flex items-center">
                  <span className="text-xs text-blue-400 font-mono">Server Time (UTC): 
                    <span className="font-semibold ml-1">
                      {timeSync.isLoading ? 'Syncing...' : timeSync.serverUtcTime}
                    </span>
                  </span>
                  {!timeSync.isLoading && !timeSync.isSynced && (
                    <Badge variant="outline" className="ml-2 text-xs bg-yellow-900/30 text-yellow-300 border-yellow-500/30">
                      Not Synced
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-gray-400 font-mono sm:ml-2">
                  &nbsp;| Your Local: <span className="font-semibold text-orange-200">{timeSync.localTime}</span> 
                  <span className="text-gray-400">({timeSync.timezone})</span>
                </span>
              </div>
              
              {timeSync.isSynced && Math.abs(timeSync.timeDiff) > 60000 && (
                <Alert variant="destructive" className="bg-yellow-950/30 border-yellow-500/30 py-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-xs text-yellow-300">
                    {getTimeDifferenceText()}. This may affect schedule timing.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="text-xs text-yellow-300 mb-1">
                <strong>Note:</strong> All schedules are set and triggered in <span className="font-bold underline">UTC time</span>. 
                The time you enter below will be saved directly as UTC time.
              </div>
            </div>

            {/* Time and action inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-time" className="text-white">Time (UTC)</Label>
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-gray-400" />
                  <Input 
                    id="schedule-time"
                    type="time" 
                    value={newSchedule.time}
                    step={60}
                    onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                    className="bg-black/60 border-orange-500/30 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Action</Label>
                <div className="flex items-center justify-between p-2 bg-black/60 rounded-md border border-orange-500/30">
                  <span className="text-white">Turn {newSchedule.state ? 'ON' : 'OFF'}</span>
                  <Switch 
                    checked={newSchedule.state} 
                    onCheckedChange={(checked) => setNewSchedule({...newSchedule, state: checked})}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>
              </div>
            </div>
            
            {/* Schedule days section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white">Schedule Days</Label>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="text-orange-400 hover:text-orange-300 -mr-2 -mt-1 p-2 h-8"
                >
                  {showAdvancedOptions ? "Hide Options" : "Show Options"}
                </Button>
              </div>
              
              {showAdvancedOptions ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`day-${day}`} 
                          checked={newSchedule.days.includes(day)}
                          onCheckedChange={() => toggleDay(day)}
                          className="data-[state=checked]:bg-orange-500 border-orange-500/50"
                        />
                        <label
                          htmlFor={`day-${day}`}
                          className="text-sm font-medium text-white leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {day.substring(0, 3)}
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDayPreset('weekdays')}
                      className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                    >
                      Weekdays
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDayPreset('weekend')}
                      className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                    >
                      Weekend
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDayPreset('everyday')}
                      className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                    >
                      All Days
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDayPreset('clear')}
                      className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1 bg-black/60 p-2 rounded-md border border-orange-500/30">
                  {newSchedule.days.length === 0 ? (
                    <span className="text-red-400 text-sm">No days selected</span>
                  ) : (
                    <span className="text-white text-sm">{formatDays(newSchedule.days)}</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Add schedule button */}
            <div className="pt-4">
              <Button 
                onClick={handleAddSchedule} 
                disabled={loading || newSchedule.days.length === 0 || !newSchedule.time}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" /> 
                    Adding Schedule...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Power className="mr-2 h-4 w-4 text-white" /> 
                    Add Schedule
                  </div>
                )}
              </Button>
            </div>
          </div>
          
          {/* Active schedules section */}
          <div className="border-t border-orange-500/10 my-4 pt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-sm font-semibold flex items-center">
                <CalendarClock className="mr-2 h-4 w-4 text-orange-400" />
                Active Schedules
              </h3>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" 
                  size="sm"
                  disabled={fixingInProgress}
                  onClick={validateScheduleFormats}
                  className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                >
                  {fixingInProgress ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <WrenchIcon className="mr-1 h-3 w-3" />
                  )}
                  Validate Time Formats
                </Button>
                
                {validationResults && validationResults.invalid_schedules > 0 && (
                  <Button
                    variant="outline" 
                    size="sm"
                    disabled={fixingInProgress}
                    onClick={fixAllInvalidSchedules}
                    className="text-xs h-8 border-orange-500/20 hover:border-orange-500/40 text-orange-400"
                  >
                    Fix All Invalid
                  </Button>
                )}
              </div>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-orange-500 mr-2" />
                <span className="text-gray-300">Loading schedules...</span>
              </div>
            ) : schedules.length === 0 ? (
              <div className="border border-dashed border-orange-500/20 rounded-md p-4 text-center">
                <p className="text-gray-400 text-sm">No schedules found. Add your first schedule above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="bg-black/60 rounded-md border border-orange-500/20 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${schedule.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <span className={`text-sm font-medium ${schedule.is_active ? 'text-white' : 'text-gray-400'}`}>
                          {schedule.trigger_time} UTC
                        </span>
                        <Badge className="text-xs bg-orange-500/20 text-orange-300 border-none">
                          Turn {schedule.state ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {schedule.is_active && (
                          <span className="text-xs text-gray-400 mr-2">
                            {calculateCountdown(schedule.trigger_time, schedule.days_of_week[0])}
                          </span>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => forceExecuteSpecificSchedule(schedule.id)}
                          disabled={forceExecutionInProgress}
                          className="h-7 w-7 p-0"
                        >
                          {forceExecutionInProgress ? (
                            <Loader2 className="h-3.5 w-3.5 text-orange-400 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5 text-orange-400" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleScheduleActive(schedule.id, schedule.is_active)}
                          className="h-7 w-7 p-0"
                        >
                          {schedule.is_active ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSchedule(schedule.id)}
                          className="h-7 w-7 p-0 text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-1">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-gray-400">
                          {formatDays(schedule.days_of_week)}
                        </span>
                        
                        {validationResults?.validation_results?.find((r: any) => r.id === schedule.id && !r.valid) && (
                          <Badge variant="outline" className="text-xs bg-yellow-900/30 text-yellow-300 border-yellow-500/30 ml-2">
                            Invalid Format
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => fixScheduleFormat(schedule.id)}
                              disabled={fixingInProgress}
                              className="h-4 w-4 p-0 ml-1"
                            >
                              {fixingInProgress ? (
                                <Loader2 className="h-3 w-3 text-yellow-300 animate-spin" />
                              ) : (
                                <WrenchIcon className="h-3 w-3 text-yellow-300" />
                              )}
                            </Button>
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Debug toggle section */}
            <div className="mt-4 pt-2 border-t border-orange-500/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                className="text-xs h-8 w-full border-orange-500/20 hover:border-orange-500/40 text-orange-400"
              >
                {showDebugLogs ? "Hide Debug Logs" : "Show Debug Tools"}
              </Button>
              
              {showDebugLogs && (
                <div className="mt-4 space-y-4">
                  <div className="bg-black/60 rounded-md border border-blue-500/20 p-3">
                    <h4 className="text-sm font-medium text-blue-400 mb-2">Manual Testing & Execution</h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="space-y-2">
                        <Label htmlFor="test-time" className="text-xs text-white">Test Time (UTC)</Label>
                        <Input 
                          id="test-time"
                          type="time" 
                          value={testValues.testTime}
                          onChange={(e) => setTestValues({...testValues, testTime: e.target.value})}
                          className="bg-black/60 border-blue-500/30 text-white h-8 text-xs"
                          placeholder="Optional - uses current time if empty"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="test-day" className="text-xs text-white">Test Day</Label>
                        <select
                          id="test-day"
                          value={testValues.testDay}
                          onChange={(e) => setTestValues({...testValues, testDay: e.target.value})}
                          className="w-full h-8 bg-black/60 border border-blue-500/30 rounded-md text-white text-xs px-2"
                        >
                          {DAYS_OF_WEEK.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testScheduleTrigger(false)}
                        disabled={testInProgress}
                        className="text-xs h-8 flex-1 border-blue-500/20 hover:border-blue-500/40 text-blue-400"
                      >
                        {testInProgress ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Info className="mr-1 h-3 w-3" />
                        )}
                        Test Without Execution
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testScheduleTrigger(true)}
                        disabled={testInProgress}
                        className="text-xs h-8 flex-1 border-green-500/20 hover:border-green-500/40 text-green-400"
                      >
                        {testInProgress ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Power className="mr-1 h-3 w-3" />
                        )}
                        Execute Now
                      </Button>
                    </div>
                    
                    {testResult && (
                      <div className="mt-3 p-2 bg-black/80 rounded border border-blue-500/20 text-xs font-mono text-blue-300 max-h-40 overflow-auto">
                        <pre>{JSON.stringify(testResult, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                  
                  {/* Execution logs section */}
                  {executionLogs.length > 0 && (
                    <div className="bg-black/60 rounded-md border border-purple-500/20 p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-purple-400">Execution Logs</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRefreshLogsCounter(prev => prev + 1)}
                          className="h-6 w-6 p-0"
                        >
                          <RefreshCw className="h-3 w-3 text-purple-400" />
                        </Button>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {executionLogs.map(log => (
                          <div key={log.id} className="p-2 bg-black/40 rounded border border-purple-500/10 text-xs">
                            <div className="flex justify-between text-purple-300 mb-1">
                              <span>Schedule {log.schedule_id.substring(0, 8)}...</span>
                              <span>{formatDate(log.executed_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className={log.success ? 'text-green-300' : 'text-red-300'}>
                                {log.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                            {log.error && (
                              <div className="mt-1 text-red-300">{log.error}</div>
                            )}
                            {log.result && (
                              <div className="mt-1 font-mono text-gray-400 text-2xs">
                                {getResultDetails(log.result)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduledControls;
