import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Power } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { subscribeToDeviceData, setDevicePowerState } from "@/integrations/firebase/client";
import { supabase } from "@/integrations/supabase/client";
import { useInverterAndLoadsSwitches } from "./useInverterAndLoadsSwitches";

interface PowerSwitchProps {
  inverterId: string;
  initialState?: boolean;
}

export const PowerSwitch = ({ inverterId, initialState = false }: PowerSwitchProps) => {
  const {
    inverterState,
    setInverterAndLoads,
  } = useInverterAndLoadsSwitches(inverterId);

  const handleToggle = async (checked: boolean) => {
    try {
      await setInverterAndLoads(checked);
      toast({
        title: checked ? "Inverter turned ON" : "Inverter turned OFF",
        description: `System ${inverterId} power state changed (all states sent)`,
      });
    } catch (error: any) {
      console.error('Error updating power state:', error);
      toast({
        title: "Error updating power state",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg">
      <div className="flex items-center space-x-2">
        <Power className={`h-5 w-5 ${inverterState ? "text-orange-500" : "text-gray-500"}`} />
        <Label htmlFor={`power-switch-${inverterId}`} className="text-white">
          {inverterState ? "System On" : "System Off"}
        </Label>
      </div>
      <Switch
        id={`power-switch-${inverterId}`}
        checked={inverterState}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-orange-500"
      />
    </div>
  );
};
