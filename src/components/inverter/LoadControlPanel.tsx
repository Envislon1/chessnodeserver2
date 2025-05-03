import { useState } from "react";
import { Plus, AlertTriangle, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadControlSwitch } from "./LoadControlSwitch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { useInverterAndLoadsSwitches } from "./useInverterAndLoadsSwitches";

interface LoadControlPanelProps {
  inverterId: string;
}

export const LoadControlPanel = ({ inverterId }: LoadControlPanelProps) => {
  const {
    loads,
    setSingleLoadAndAll,
    setLoads,
    systemId,
    inverterState,
    setInverterAndLoads,
  } = useInverterAndLoadsSwitches(inverterId);

  const [newSwitchName, setNewSwitchName] = useState("");
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const MAX_LOADS = 6;

  const handleAddSwitch = async () => {
    if (!newSwitchName.trim() || !inverterId || !systemId) {
      toast({
        title: "Error",
        description: "System information not available",
        variant: "destructive",
      });
      return;
    }

    if (loads.length >= MAX_LOADS) {
      toast({
        title: "Cannot add more loads",
        description: "This inverter can only control a maximum of 6 loads",
        variant: "destructive",
      });
      return;
    }

    // Find next available load number - important for shared systems
    const usedNumbers = loads.map(l => l.load_number);
    let loadNumber = 1;
    while (usedNumbers.includes(loadNumber) && loadNumber <= MAX_LOADS) {
      loadNumber++;
    }

    try {
      // Insert the load with system_id (not inverter_id) to make it shared for all users
      const { data, error } = await supabase
        .from('inverter_loads')
        .insert({
          system_id: systemId,
          name: newSwitchName.trim(),
          state: false,
          load_number: loadNumber
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newSwitch = {
          id: data.id,
          name: data.name,
          state: data.state || false,
          load_number: data.load_number
        };

        setLoads([...loads, newSwitch]);
        setNewSwitchName("");
        setLastActivity(`Added load: ${newSwitch.name}`);

        toast({
          title: "Load added",
          description: `${newSwitch.name} has been added successfully`,
        });
      }
    } catch (error: any) {
      console.error("Error adding load:", error);
      toast({
        title: "Failed to add load",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (loadId: string, loadName: string) => {
    try {
      const { error } = await supabase
        .from('inverter_loads')
        .delete()
        .eq('id', loadId);

      if (error) throw error;

      setLoads(loads.filter(s => s.id !== loadId));
      setLastActivity(`Deleted load: ${loadName}`);

      toast({
        title: "Load deleted",
        description: `${loadName} has been removed successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete load",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleInverterPower = async () => {
    try {
      const newState = !inverterState;
      const success = await setInverterAndLoads(newState);
      
      if (success) {
        setLastActivity(`Set inverter power to ${newState ? 'ON' : 'OFF'}`);
        toast({
          title: "Inverter power updated",
          description: `Power has been turned ${newState ? 'ON' : 'OFF'}`,
        });
        
        // Log diagnostic information
        await supabase.functions.invoke("scheduled-inverter-control", {
          method: "POST",
          body: {
            system_id: systemId,
            state: newState,
            user_email: "manual-test@load-panel.debug",
            manual_execution: true,
            test_mode: true
          }
        });
      } else {
        toast({
          title: "Failed to update power",
          description: "Could not update inverter power state",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error toggling inverter power:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to toggle inverter power",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Master Power Control */}
      <div className="p-3 border border-orange-500/20 rounded-md bg-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className={`h-5 w-5 ${inverterState ? 'text-green-500' : 'text-gray-500'}`} />
            <Label htmlFor="master-power" className="text-sm font-medium">
              Master Power Control
            </Label>
          </div>
          <Switch
            id="master-power"
            checked={inverterState}
            onCheckedChange={toggleInverterPower}
            className="data-[state=checked]:bg-green-500"
          />
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Use this to directly control the inverter power state. Current state: {inverterState ? 'ON' : 'OFF'}
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={newSwitchName}
          onChange={(e) => setNewSwitchName(e.target.value)}
          placeholder="Enter load name"
          className="bg-black/20 border-orange-500/20 text-white placeholder:text-gray-400"
        />
        <Button
          onClick={handleAddSwitch}
          variant="outline"
          disabled={!systemId || loads.length >= MAX_LOADS}
          className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {loads.length >= MAX_LOADS && (
        <div className="flex items-center text-xs text-amber-500 gap-1 bg-amber-500/10 p-2 rounded">
          <AlertTriangle className="h-3 w-3" />
          <span>Maximum of 6 loads reached</span>
        </div>
      )}

      {!systemId && (
        <div className="flex items-center text-xs text-amber-500 gap-1 bg-amber-500/10 p-2 rounded">
          <AlertTriangle className="h-3 w-3" />
          <span>System ID not available, can't add or manage loads</span>
        </div>
      )}

      <div className="grid gap-2">
        {loads.map((switchItem) => (
          <div key={switchItem.id} className="flex items-center justify-between w-full gap-2">
            <LoadControlSwitch
              name={switchItem.name}
              inverterId={inverterId}
              loadNumber={switchItem.load_number}
              initialState={switchItem.state}
              onChange={(loadNumber, newState) => {
                console.log(`Load ${loadNumber} changed to ${newState}`);
              }}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-red-500/20 text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-black/90 border-orange-500/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Load</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    Are you sure you want to delete {switchItem.name}? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(switchItem.id, switchItem.name)}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>

      {lastActivity && (
        <div className="mt-2 text-xs text-gray-400">
          Last activity: {lastActivity}
        </div>
      )}
    </div>
  );
};
