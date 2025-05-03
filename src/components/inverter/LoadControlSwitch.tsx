
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInverterAndLoadsSwitches } from "./useInverterAndLoadsSwitches";

interface LoadControlSwitchProps {
  name: string;
  inverterId: string;
  loadNumber: number;
  onChange?: (loadNumber: number, state: boolean) => void;
  initialState?: boolean;
}

export const LoadControlSwitch = ({ 
  name, 
  inverterId, 
  loadNumber,
  onChange,
  initialState = false 
}: LoadControlSwitchProps) => {
  const isMobile = useIsMobile();

  // Use hook to get latest value and correct inverterId
  const {
    loads,
    setSingleLoadAndAll,
    systemId
  } = useInverterAndLoadsSwitches(inverterId);

  const thisLoad = loads.find(l => l.load_number === loadNumber);
  const isOn = thisLoad?.state ?? initialState;

  const handleToggle = async (checked: boolean) => {
    try {
      // We need to use the systemId for Firebase, but inverterId for Supabase
      await setSingleLoadAndAll(loadNumber, checked);
      onChange?.(loadNumber, checked);
      toast({
        title: checked ? `${name} turned ON` : `${name} turned OFF`,
        description: `Load ${loadNumber} state changed successfully`,
      });
    } catch (error: any) {
      console.error("Error sending control command:", error.message);
      toast({
        title: "Control Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-between w-full p-2 sm:p-3 bg-black/20 rounded-lg space-x-4">
      <Label 
        htmlFor={`load-switch-${inverterId}-${loadNumber}`} 
        className="text-white text-xs sm:text-sm flex-grow"
      >
        {name}
      </Label>
      <Switch
        id={`load-switch-${inverterId}-${loadNumber}`}
        checked={isOn}
        onCheckedChange={handleToggle}
        className="data-[state=checked]:bg-orange-500"
      />
    </div>
  );
};
