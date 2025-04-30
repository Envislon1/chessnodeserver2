
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceStatusMonitor } from "./DeviceStatusMonitor";
import { Battery, Zap, Power, Settings, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface InverterDataDisplayProps {
  inverterId: string;
  deviceData?: string; // The comma-separated data string from the device
}

interface ParsedData {
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  powerFactor: number;
  mainsPresent: boolean;
  solarPresent: boolean;
  nominalVoltage: number;
  deviceCapacity: number;
  batteryVoltage: number;
  apparentPower: number;
  reactivePower: number;
  voltagePeakPeak: number;
  currentPeakPeak: number;
  batteryPercentage: number;
  loadPercentage: number;
  analogReading: number;
  surgeResult: string;
  powerControl: number;
  randomValue: number;
  inverterState: boolean;
  lastUserPower?: string;
  lastUserEnergy?: string;
}

export const InverterDataDisplay = ({ inverterId, deviceData }: InverterDataDisplayProps) => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!deviceData) return;
    
    try {
      const values = deviceData.split(',');
      if (values.length < 21) return; // Ensure we have all expected values
      
      // Parse based on the Arduino code string format
      const data: ParsedData = {
        voltage: parseFloat(values[0]) || 0,
        current: parseFloat(values[1]) || 0,
        power: parseFloat(values[2]) || 0,
        energy: parseFloat(values[3]) || 0,
        frequency: parseFloat(values[4]) || 0,
        powerFactor: parseFloat(values[5]) || 0,
        mainsPresent: values[6] === "1",
        solarPresent: values[7] === "1",
        nominalVoltage: parseFloat(values[8]) || 0,
        deviceCapacity: parseFloat(values[9]) || 0,
        batteryVoltage: parseFloat(values[10]) || 0,
        apparentPower: parseFloat(values[11]) || 0,
        reactivePower: parseFloat(values[12]) || 0,
        voltagePeakPeak: parseFloat(values[13]) || 0,
        currentPeakPeak: parseFloat(values[14]) || 0,
        batteryPercentage: parseFloat(values[15]) || 0,
        loadPercentage: parseFloat(values[16]) || 0,
        analogReading: parseFloat(values[17]) || 0,
        surgeResult: values[18] || "",
        powerControl: parseInt(values[19]) || 0,
        randomValue: parseInt(values[20]) || 0,
        inverterState: values[21] === "1" || values[21] === "true",
        lastUserPower: values.length > 22 ? values[22] : undefined,
        lastUserEnergy: values.length > 23 ? values[23] : undefined
      };
      
      setParsedData(data);
    } catch (error) {
      console.error("Error parsing device data:", error);
    }
  }, [deviceData]);

  if (!parsedData) {
    return (
      <div className="p-4 bg-black/40 border border-orange-500/20 rounded-lg">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }

  const isSurgeCondition = parsedData.loadPercentage > 80;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          Real-time Parameters
        </h3>
        <DeviceStatusMonitor inverterId={inverterId} deviceData={deviceData} />
      </div>
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Battery Card */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Battery Status</CardTitle>
            <Battery className={`h-4 w-4 ${parsedData.batteryPercentage < 20 ? 'text-red-500' : 'text-orange-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full ${
                    parsedData.batteryPercentage < 20 ? 'bg-red-500' : 
                    parsedData.batteryPercentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} 
                  style={{ width: `${parsedData.batteryPercentage}%` }}
                />
              </div>
              <div className="flex justify-between">
                <p className="text-2xl font-bold text-white">{parsedData.batteryPercentage.toFixed(1)}%</p>
                <p className="text-sm text-gray-300">{parsedData.batteryVoltage.toFixed(1)}V</p>
              </div>
              {parsedData.batteryPercentage < 20 && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Low Battery
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Power Output Card */}
        <Card className={`bg-black/40 ${isSurgeCondition ? 'border-red-500/50' : 'border-orange-500/20'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Power Output</CardTitle>
            {isSurgeCondition ? (
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
            ) : (
              <Power className="h-4 w-4 text-orange-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-white">{parsedData.power.toFixed(1)}W</p>
                {isSurgeCondition && (
                  <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                    Surge Alert
                  </span>
                )}
              </div>
              <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full ${
                    parsedData.loadPercentage > 80 ? 'bg-red-500' : 
                    parsedData.loadPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} 
                  style={{ width: `${parsedData.loadPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-300">
                <span>0W</span>
                <span>{parsedData.deviceCapacity * 1000}W</span>
              </div>
              <p className="text-xs text-gray-300">Load: {parsedData.loadPercentage.toFixed(1)}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Electrical Parameters Card */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Electrical Params</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <p className="text-xs text-gray-300">Voltage:</p>
                <p className="text-xs text-white text-right">{parsedData.voltage.toFixed(1)}V</p>
                
                <p className="text-xs text-gray-300">Current:</p>
                <p className="text-xs text-white text-right">{parsedData.current.toFixed(2)}A</p>
                
                <p className="text-xs text-gray-300">Frequency:</p>
                <p className="text-xs text-white text-right">{parsedData.frequency.toFixed(1)}Hz</p>
                
                <p className="text-xs text-gray-300">Power Factor:</p>
                <p className="text-xs text-white text-right">{parsedData.powerFactor.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy & Source Card */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Energy & Source</CardTitle>
            <Settings className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">{parsedData.energy.toFixed(2)} kWh</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center text-xs">
                  <div className={`w-3 h-3 rounded-full mr-2 ${parsedData.mainsPresent ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  <span className={parsedData.mainsPresent ? 'text-green-400' : 'text-gray-400'}>
                    Mains {parsedData.mainsPresent ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-3 h-3 rounded-full mr-2 ${parsedData.solarPresent ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  <span className={parsedData.solarPresent ? 'text-green-400' : 'text-gray-400'}>
                    Solar {parsedData.solarPresent ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center text-xs">
                  <div className={`w-3 h-3 rounded-full mr-2 ${parsedData.inverterState ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  <span className={parsedData.inverterState ? 'text-green-400' : 'text-gray-400'}>
                    Inverter {parsedData.inverterState ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      {(parsedData.lastUserPower || parsedData.lastUserEnergy) && (
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            {parsedData.lastUserPower && (
              <p className="text-gray-300">Power Control: {parsedData.lastUserPower}</p>
            )}
            {parsedData.lastUserEnergy && (
              <p className="text-gray-300">Energy Reset: {parsedData.lastUserEnergy}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
