
import { Battery, BatteryCharging, BatteryFull, BatteryMedium } from "lucide-react";
import { cn } from "@/lib/utils";

interface BatteryGaugeProps {
  percentage: number;
  isCharging: boolean;
  dischargingActive: boolean;
  className?: string;
  showPercentage?: boolean;
}

export const BatteryGauge = ({
  percentage,
  isCharging,
  dischargingActive,
  className,
  showPercentage = true,
}: BatteryGaugeProps) => {
  // Determine the appropriate battery icon and color based on state
  const getBatteryIcon = () => {
    if (isCharging) {
      return <BatteryCharging className="h-6 w-6 text-green-500 animate-pulse" />;
    } else if (percentage >= 85) {
      return <BatteryFull className="h-6 w-6 text-green-500" />;
    } else if (percentage >= 40) {
      return <BatteryMedium className="h-6 w-6 text-yellow-500" />;
    } else {
      return <Battery className={`h-6 w-6 ${percentage < 20 ? "text-red-500" : "text-yellow-500"}`} />;
    }
  };

  const getBatteryStatus = () => {
    if (isCharging) {
      return "Charging";
    } else if (dischargingActive) {
      return "Discharging";
    } else if (percentage >= 95) {
      return "Charged";
    } else {
      return "Idle";
    }
  };

  const getStatusColor = () => {
    if (isCharging) {
      return "text-green-500";
    } else if (dischargingActive) {
      return "text-orange-500";
    } else if (percentage >= 95) {
      return "text-green-500";
    } else {
      return percentage < 20 ? "text-red-500" : "text-gray-300";
    }
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Battery visualization */}
      <div className="relative w-16 h-8 border-2 border-gray-400 rounded-md mb-2">
        <div className="absolute right-0 top-1/2 -mr-1 w-1 h-3 bg-gray-400 -translate-y-1/2"></div>
        <div
          className={`absolute left-0 top-0 bottom-0 ${
            isCharging ? "bg-green-500 animate-pulse" : percentage < 20 ? "bg-red-500" : "bg-green-500"
          } rounded-sm transition-all duration-700 ease-in-out`}
          style={{ width: `${Math.max(5, percentage)}%`, maxWidth: "100%" }}
        ></div>
      </div>

      {/* Battery icon and text */}
      <div className="flex items-center gap-2 mt-1">
        {getBatteryIcon()}
        <div className="flex flex-col">
          <span className={cn("text-sm font-medium", getStatusColor())}>{getBatteryStatus()}</span>
          {showPercentage && (
            <span className="text-xs text-gray-400">{percentage.toFixed(1)}%</span>
          )}
        </div>
      </div>
    </div>
  );
};
