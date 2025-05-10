
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BatteryGauge } from "./BatteryGauge";

interface InverterStateCardProps {
  batteryPercentage: number;
  mainsPresent: boolean;
  inverterOn: boolean;
  solarPresent?: boolean;
}

export const InverterStateCard = ({
  batteryPercentage,
  mainsPresent,
  inverterOn,
  solarPresent = false
}: InverterStateCardProps) => {
  // Determine inverter state logic
  const isCharging = mainsPresent && batteryPercentage < 95;
  const isDischarging = inverterOn && !mainsPresent;
  const isCharged = mainsPresent && batteryPercentage >= 95;
  
  // Get additional solar information if available
  const getSolarText = () => {
    if (solarPresent) {
      return "Solar Power Available";
    }
    return null;
  };

  const solarText = getSolarText();

  return (
    <Card className="bg-black/40 border-orange-500/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-white">Inverter State</CardTitle>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-orange-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <BatteryGauge 
            percentage={batteryPercentage} 
            isCharging={isCharging}
            dischargingActive={isDischarging}
            className="mx-auto"
          />
          
          <div className="text-center">
            {solarText && (
              <p className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-3 w-3" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                {solarText}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
