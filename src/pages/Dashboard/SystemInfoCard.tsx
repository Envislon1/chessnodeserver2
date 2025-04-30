
import { DeviceStatusMonitor } from "@/components/inverter/DeviceStatusMonitor";
import { Button } from "@/components/ui/button";
import { InverterSystem } from "./types";

interface SystemInfoCardProps {
  selectedSystemData: InverterSystem | undefined;
  deviceData: string | null;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  handleSignOut: () => void;
  isMobile: boolean;
}

export function SystemInfoCard({
  selectedSystemData,
  deviceData,
  showAdvanced,
  setShowAdvanced,
  handleSignOut,
  isMobile,
}: SystemInfoCardProps) {
  if (!selectedSystemData) return null;
  return (
    <div className="p-4 bg-black/40 border border-orange-500/20 rounded-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm text-gray-400">System Information</h3>
          <p className="text-base font-medium text-white">
            {selectedSystemData.name}
          </p>
          <p className="text-xs text-gray-300">
            Location: {selectedSystemData.location}
          </p>
          <p className="text-xs text-gray-300">
            Model: {selectedSystemData.model}
          </p>
          {deviceData && (
            <>
              <p className="text-xs text-gray-300">
                System Voltage: {deviceData.split(",")[8] || "N/A"}V
              </p>
              <p className="text-xs text-gray-300">
                System Capacity: {deviceData.split(",")[9] || "N/A"} kVA
              </p>
            </>
          )}
        </div>
        {selectedSystemData.system_id && (
          <div>
            <h3 className="text-sm text-gray-400">Device ID</h3>
            <p className="text-xs font-mono bg-black/60 p-1 rounded inline-block">
              {selectedSystemData.system_id}
            </p>
            {deviceData && (
              <div className="mt-2">
                <DeviceStatusMonitor
                  inverterId={selectedSystemData.id}
                  deviceData={deviceData}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-4 mt-4">
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white text-xs sm:text-sm"
          size={isMobile ? "sm" : "default"}
        >
          {showAdvanced ? "Basic View" : "Advanced View"}
        </Button>
        <Button
          variant="outline"
          onClick={handleSignOut}
          className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white text-xs sm:text-sm"
          size={isMobile ? "sm" : "default"}
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
