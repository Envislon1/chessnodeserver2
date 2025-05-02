
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceStatusMonitor } from "./DeviceStatusMonitor";
import { Battery, Zap, Power, Settings, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInverterAndLoadsSwitches } from "./useInverterAndLoadsSwitches";

interface InverterDataDisplayProps {
  inverterId: string;
  deviceData?: string | null; // The comma-separated data string from the device
  firebaseData?: any; // Firebase realtime data
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

export const InverterDataDisplay = ({ inverterId, deviceData, firebaseData }: InverterDataDisplayProps) => {
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const isMobile = useIsMobile();
  const { loads, inverterState } = useInverterAndLoadsSwitches(inverterId);

  // Parse device data or use Firebase data
  useEffect(() => {
    // Priority to Firebase data if available
    if (firebaseData) {
      // Map Firebase data to our data format
      const data: ParsedData = {
        voltage: firebaseData.voltage || 220,
        current: firebaseData.current || 0,
        power: firebaseData.power === 1 
          ? (firebaseData.output_power || firebaseData.real_power || firebaseData.power_output || 0) 
          : 0,
        energy: firebaseData.energy || 0,
        frequency: firebaseData.frequency || 50,
        powerFactor: firebaseData.power_factor || 0.9,
        mainsPresent: firebaseData.mains_present === true || firebaseData.mains_present === 1 || false,
        solarPresent: firebaseData.solar_present === true || firebaseData.solar_present === 1 || false,
        nominalVoltage: firebaseData.nominal_voltage || 24,
        deviceCapacity: firebaseData.device_capacity || 5,
        batteryVoltage: firebaseData.battery_voltage || 24,
        apparentPower: firebaseData.apparent_power || 0,
        reactivePower: firebaseData.reactive_power || 0,
        voltagePeakPeak: firebaseData.voltage_peak_peak || 310,
        currentPeakPeak: firebaseData.current_peak_peak || 0,
        // Use calculated battery percentage based on voltage and nominal voltage
        batteryPercentage: 0, // Will be calculated below
        loadPercentage: 0, // Will be calculated below
        analogReading: firebaseData.analog_reading || 0,
        surgeResult: firebaseData.surge_result || "",
        powerControl: firebaseData.power_control || 0,
        randomValue: firebaseData.random_value || 0,
        // Use the inverterState from the hook which gets data from "_" prefixed path
        inverterState: inverterState,
        lastUserPower: firebaseData.lastUserPower,
        lastUserEnergy: firebaseData.lastUserEnergy
      };
      
      // Calculate battery percentage based on voltage and nominal voltage
      if (data.batteryVoltage && data.nominalVoltage && data.nominalVoltage > 0) {
        data.batteryPercentage = Math.min(Math.max((data.batteryVoltage / data.nominalVoltage) * 100, 0), 100);
      }
      
      // Calculate load percentage based on system capacity (75% of device capacity in KVA)
      const systemCapacityWatts = data.deviceCapacity ? (data.deviceCapacity * 0.75 * 1000) : 3000;
      if (data.power && systemCapacityWatts > 0) {
        data.loadPercentage = (data.power / systemCapacityWatts) * 100;
      }
      
      console.log("Updated parsed data from Firebase:", data);
      setParsedData(data);
      return;
    }
    
    // Fallback to string-based device data if Firebase data isn't available
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
        nominalVoltage: parseFloat(values[8]) || 24,
        deviceCapacity: parseFloat(values[9]) || 5,
        batteryVoltage: parseFloat(values[10]) || 0,
        apparentPower: parseFloat(values[11]) || 0,
        reactivePower: parseFloat(values[12]) || 0,
        voltagePeakPeak: parseFloat(values[13]) || 0,
        currentPeakPeak: parseFloat(values[14]) || 0,
        batteryPercentage: 0, // Will be calculated below
        loadPercentage: 0, // Will be calculated below
        analogReading: parseFloat(values[17]) || 0,
        surgeResult: values[18] || "",
        powerControl: parseInt(values[19]) || 0,
        randomValue: parseInt(values[20]) || 0,
        // Use the inverterState from the hook which gets data from "_" prefixed path
        inverterState: inverterState,
        lastUserPower: "",
        lastUserEnergy: ""
      };
      
      // Recalculate battery percentage based on voltage and nominal voltage
      if (data.batteryVoltage && data.nominalVoltage && data.nominalVoltage > 0) {
        data.batteryPercentage = Math.min(Math.max((data.batteryVoltage / data.nominalVoltage) * 100, 0), 100);
      }
      
      // Recalculate load percentage based on system capacity (75% of device capacity in KVA)
      const systemCapacityWatts = data.deviceCapacity ? (data.deviceCapacity * 0.75 * 1000) : 3000;
      if (data.power && systemCapacityWatts > 0) {
        data.loadPercentage = (data.power / systemCapacityWatts) * 100;
      }
      
      setParsedData(data);
    } catch (error) {
      console.error("Error parsing device data:", error);
    }
  }, [deviceData, firebaseData, inverterState]);

  if (!parsedData) {
    return (
      <div className="p-4 bg-black/40 border border-orange-500/20 rounded-lg">
        <p className="text-gray-400">No data available</p>
      </div>
    );
  }
  
  // Calculate system capacity (KW) as 75% of device capacity (KVA)
  const systemCapacity = parsedData.deviceCapacity ? Math.round((parsedData.deviceCapacity * 0.75) * 100) / 100 : 0;

  // Convert system capacity from KW to W for the progress bar
  const systemCapacityWatts = systemCapacity * 1000;
  
  // Use system capacity (W) for load percentage calculation and surge detection
  const isSurgeCondition = parsedData.power > (systemCapacityWatts * 0.8);
  
  // Calculate percentage based on system capacity in watts (not device capacity)
  const loadPercentage = systemCapacityWatts > 0 
    ? Math.min((parsedData.power / systemCapacityWatts) * 100, 100) 
    : 0;
  
  // Calculate battery percentage based on battery voltage and nominal voltage
  const calculatedBatteryPercentage = (parsedData.batteryVoltage && parsedData.nominalVoltage && parsedData.nominalVoltage > 0) 
    ? Math.min(Math.max((parsedData.batteryVoltage / parsedData.nominalVoltage) * 100, 0), 100)
    : parsedData.batteryPercentage;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-white">
          Real-time Parameters
        </h3>
        <DeviceStatusMonitor inverterId={inverterId} deviceData={deviceData} />
      </div>
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Battery Card - Using same format as in InverterParameters.tsx */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Battery Status</CardTitle>
            <Battery className={`h-4 w-4 ${calculatedBatteryPercentage < 20 ? 'text-red-500' : 'text-orange-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">{calculatedBatteryPercentage.toFixed(1)}%</p>
              <p className="text-xs text-gray-300">
                Voltage: {parsedData.batteryVoltage.toFixed(1)}V
                {parsedData.nominalVoltage && <span> / {parsedData.nominalVoltage.toFixed(1)}V</span>}
              </p>
              {calculatedBatteryPercentage < 20 && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Low Battery
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Power Output Card - UPDATED to match Output Parameters card from InverterParameters.tsx */}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-white">{parsedData.power.toFixed(0)}W</p>
                {isSurgeCondition && (
                  <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Surge</span>
                )}
              </div>
              <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full rounded-full ${
                    loadPercentage > 80 ? 'bg-red-500' : 
                    loadPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} 
                  style={{ width: `${loadPercentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-300">
                Capacity: {parsedData.deviceCapacity} KVA ({systemCapacity} KW) | Load: {loadPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-300">
                Voltage: {parsedData.voltage.toFixed(1)}V
              </p>
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
                
                {/* Load states from hook which gets data from "_" prefixed path */}
                {loads.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">Load States:</p>
                    <div className="grid grid-cols-3 gap-1">
                      {loads.map((load) => (
                        <div key={load.id} className="flex items-center text-xs">
                          <div className={`w-2 h-2 rounded-full mr-1 ${load.state ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                          <span className={load.state ? 'text-green-400' : 'text-gray-400'}>
                            {load.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Log */}
      {(parsedData.lastUserPower || parsedData.lastUserEnergy || firebaseData?.lastUpdate) && (
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
            {firebaseData?.lastUpdate && (
              <p className="text-gray-300">Last Update: {new Date(firebaseData.lastUpdate).toLocaleString()}</p>
            )}
            {firebaseData?.lastUserPower && (
              <p className="text-gray-300">Last User: {firebaseData.lastUserPower}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
