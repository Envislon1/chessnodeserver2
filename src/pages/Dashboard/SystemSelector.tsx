
import { Button } from "@/components/ui/button";
import { DeleteInverterSystem } from "@/components/inverter/DeleteInverterSystem";
import { InverterSystem } from "./types";

interface SystemSelectorProps {
  systems: InverterSystem[];
  selectedSystem: string | null;
  setSelectedSystem: (id: string) => void;
  fetchInverterSystems: () => void;
  isMobile: boolean;
}

export function SystemSelector({
  systems,
  selectedSystem,
  setSelectedSystem,
  fetchInverterSystems,
  isMobile,
}: SystemSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
      {systems.map((system) => (
        <div key={system.id} className="flex items-center gap-1 sm:gap-2">
          <Button
            variant={selectedSystem === system.id ? "default" : "outline"}
            onClick={() => setSelectedSystem(system.id)}
            className={`${
              selectedSystem === system.id
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "border-orange-500/30 text-orange-500 hover:bg-orange-500/20"
            } text-xs sm:text-sm`}
            size={isMobile ? "sm" : "default"}
          >
            {system.name}
          </Button>
          <DeleteInverterSystem
            inverterId={system.id}
            inverterName={system.name}
            onDelete={fetchInverterSystems}
          />
        </div>
      ))}
    </div>
  );
}
