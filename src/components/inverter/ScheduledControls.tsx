import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useScheduleCountdown } from "@/hooks/useScheduleCountdown";

// Type definitions
interface ScheduledControl {
  id: string;
  system_id: string;
  trigger_time: string;
  days_of_week: string[];
  state: boolean;
  is_active: boolean;
}

interface ScheduledControlsProps {
  inverterId: string;
  systemId: string | null;
}

export const ScheduledControls: React.FC<ScheduledControlsProps> = ({ 
  inverterId,
  systemId 
}) => {
  const [schedules, setSchedules] = useState<ScheduledControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    time: "08:00",
    days: [] as string[],
    state: true
  });
  const { nextSchedule, countdown } = useScheduleCountdown(schedules);

  // Get current server time
  const getCurrentTime = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_time');
      if (error) throw error;
      return data as { server_time: string, timezone: string };
    } catch (error) {
      console.error("Error fetching server time:", error);
      // Fallback to client time
      return { 
        server_time: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }
  };

  // Load schedules from the database
  useEffect(() => {
    const loadSchedules = async () => {
      if (!systemId) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('inverter_schedules')
          .select('*')
          .eq('system_id', systemId)
          .order('trigger_time');
          
        if (error) throw error;
        
        setSchedules(data || []);
      } catch (error) {
        console.error('Error loading schedules:', error);
        toast({
          title: "Error",
          description: "Could not load scheduled controls",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadSchedules();
  }, [systemId]);
  
  // Toggle the day selection in the new schedule form
  const toggleDay = (day: string) => {
    if (newSchedule.days.includes(day)) {
      setNewSchedule({
        ...newSchedule,
        days: newSchedule.days.filter(d => d !== day)
      });
    } else {
      setNewSchedule({
        ...newSchedule,
        days: [...newSchedule.days, day]
      });
    }
  };
  
  // Save a new schedule
  const saveNewSchedule = async () => {
    if (!systemId) return;
    
    if (newSchedule.days.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one day of the week",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inverter_schedules')
        .insert({
          system_id: systemId,
          trigger_time: newSchedule.time,
          days_of_week: newSchedule.days,
          state: newSchedule.state,
          is_active: true
        })
        .select()
        .single();
        
      if (error) throw error;
      
      setSchedules([...schedules, data]);
      setNewSchedule({
        time: "08:00",
        days: [],
        state: true
      });
      
      toast({
        title: "Schedule Created",
        description: "New power schedule has been created",
      });
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Could not create schedule",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Delete a schedule
  const deleteSchedule = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('inverter_schedules')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setSchedules(schedules.filter(s => s.id !== id));
      toast({
        title: "Schedule Deleted",
        description: "Power schedule has been removed",
      });
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Could not delete schedule",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };
  
  // Toggle the active state of a schedule
  const toggleScheduleActive = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('inverter_schedules')
        .update({ is_active: !currentValue })
        .eq('id', id);
        
      if (error) throw error;
      
      setSchedules(schedules.map(s => 
        s.id === id ? { ...s, is_active: !currentValue } : s
      ));
    } catch (error) {
      console.error('Error toggling schedule state:', error);
      toast({
        title: "Error",
        description: "Could not update schedule",
        variant: "destructive",
      });
    }
  };
  
  // Format days display
  const formatDays = (days: string[]) => {
    if (days.length === 7) return "Every day";
    if (days.length === 0) return "No days";
    
    const dayMap: Record<string, string> = {
      "sun": "Su",
      "mon": "Mo",
      "tue": "Tu",
      "wed": "We",
      "thu": "Th",
      "fri": "Fr",
      "sat": "Sa"
    };
    
    return days.map(day => dayMap[day] || day).join(", ");
  };

  // Days of the week for UI
  const daysOfWeek = [
    { id: "sun", label: "Su" },
    { id: "mon", label: "Mo" },
    { id: "tue", label: "Tu" },
    { id: "wed", label: "We" },
    { id: "thu", label: "Th" },
    { id: "fri", label: "Fr" },
    { id: "sat", label: "Sa" }
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Power Schedules</h3>
        <p className="text-sm text-gray-400">
          Set schedules to automatically turn power on or off at specific times
        </p>
      </div>
      
      {/* Next scheduled action */}
      {nextSchedule && (
        <div className="p-3 rounded-md bg-black/40 border border-orange-500/20">
          <h4 className="text-sm font-medium text-orange-400">Next Scheduled Action</h4>
          <div className="flex justify-between items-center mt-1">
            <div>
              <p className="text-sm text-white">
                {nextSchedule.state ? "Power On" : "Power Off"} at {nextSchedule.trigger_time}
              </p>
              <p className="text-xs text-gray-400">
                {formatDays([nextSchedule.next_day || ""])}
              </p>
            </div>
            <div className="text-sm font-mono text-orange-300">
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* New schedule form */}
      <div className="p-4 rounded-md bg-black/40 border border-orange-500/20 space-y-4">
        <h4 className="text-sm font-medium text-white">Create New Schedule</h4>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Time</label>
              <Input 
                type="time" 
                value={newSchedule.time}
                onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                className="bg-black/60 border-gray-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Action</label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  size="sm"
                  variant={newSchedule.state ? "default" : "outline"}
                  className={newSchedule.state ? "bg-green-600 hover:bg-green-700" : "border-gray-600 text-gray-400"}
                  onClick={() => setNewSchedule({...newSchedule, state: true})}
                >
                  On
                </Button>
                <Button 
                  type="button"
                  size="sm"
                  variant={!newSchedule.state ? "default" : "outline"}
                  className={!newSchedule.state ? "bg-red-600 hover:bg-red-700" : "border-gray-600 text-gray-400"}
                  onClick={() => setNewSchedule({...newSchedule, state: false})}
                >
                  Off
                </Button>
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Days</label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map(day => (
                <Button
                  key={day.id}
                  type="button"
                  size="sm"
                  variant={newSchedule.days.includes(day.id) ? "default" : "outline"}
                  className={newSchedule.days.includes(day.id) 
                    ? "bg-orange-600 hover:bg-orange-700" 
                    : "border-gray-600 text-gray-400"
                  }
                  onClick={() => toggleDay(day.id)}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
          
          <Button
            type="button"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            onClick={saveNewSchedule}
            disabled={saving || newSchedule.days.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Schedule
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* Existing schedules */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white">Current Schedules</h4>
        
        {loading ? (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-500" />
            <p className="text-sm text-gray-400 mt-2">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-400">
            No schedules yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(schedule => (
              <div 
                key={schedule.id}
                className={`p-3 rounded-md border ${
                  schedule.is_active 
                    ? "bg-black/40 border-orange-500/20" 
                    : "bg-black/20 border-gray-700/20 opacity-60"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        schedule.is_active 
                          ? schedule.state ? "text-green-400" : "text-red-400"
                          : "text-gray-500"
                      }`}>
                        {schedule.state ? "Power On" : "Power Off"}
                      </span>
                      <span className="text-sm text-white">
                        at {schedule.trigger_time}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {formatDays(schedule.days_of_week)}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 w-8 p-0 ${
                        schedule.is_active 
                          ? "text-orange-500 hover:text-orange-400" 
                          : "text-gray-500 hover:text-gray-400"
                      }`}
                      onClick={() => toggleScheduleActive(schedule.id, schedule.is_active)}
                    >
                      <span className="sr-only">
                        {schedule.is_active ? "Disable" : "Enable"}
                      </span>
                      <div className={`h-3 w-3 rounded-full ${
                        schedule.is_active ? "bg-green-500" : "bg-gray-600"
                      }`}></div>
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-400"
                      onClick={() => deleteSchedule(schedule.id)}
                      disabled={deleting === schedule.id}
                    >
                      <span className="sr-only">Delete</span>
                      {deleting === schedule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
