
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceStatusMonitor } from "./DeviceStatusMonitor";
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
  load: number;
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
        voltage: firebaseData.voltage || 0,
        current: firebaseData.current || 0,
        // Use load from Firebase data instead of power
        load: firebaseData.load || 0,
        energy: firebaseData.energy || 0,
        frequency: firebaseData.frequency || 0,
        powerFactor: firebaseData.power_factor || 0.0,
        mainsPresent: firebaseData.mains_present === true || firebaseData.mains_present === 1 || false,
        solarPresent: firebaseData.solar_present === true || firebaseData.solar_present === 1 || false,
        nominalVoltage: firebaseData.nominal_voltage || 0,
        deviceCapacity: firebaseData.device_capacity || 0,
        batteryVoltage: firebaseData.battery_voltage || 0,
        apparentPower: firebaseData.apparent_power || 0,
        reactivePower: firebaseData.reactive_power || 0,
        voltagePeakPeak: firebaseData.voltage_peak_peak || 0,
        currentPeakPeak: firebaseData.current_peak_peak || 0,
        // Use calculated battery percentage based on voltage and nominal voltage
        batteryPercentage: 0, // Will be calculated below
        loadPercentage: firebaseData.load_percentage || 0, // Will be calculated below
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
      if (data.batteryVoltage && data.nominalVoltage > 0) {
        data.batteryPercentage = Math.min(Math.max((data.batteryVoltage / data.nominalVoltage) * 100, 0), 100);
      } else if (firebaseData.battery_percentage) {
        data.batteryPercentage = firebaseData.battery_percentage;
      }
      
      // Calculate load percentage based on system capacity (75% of device capacity in KVA)
      const systemCapacityWatts = data.deviceCapacity ? (data.deviceCapacity * 0.75 * 1000) : 0;
      if (data.load && systemCapacityWatts > 0) {
        data.loadPercentage = Math.min((data.load / systemCapacityWatts) * 100, 100);
      } else if (firebaseData.load_percentage) {
        data.loadPercentage = firebaseData.load_percentage;
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
        load: parseFloat(values[2]) || 0,
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
        // Use the inverterState from the hook which gets data from "_" prefixed path
        inverterState: inverterState,
        lastUserPower: "",
        lastUserEnergy: ""
      };
   
      
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
  const isSurgeCondition = systemCapacityWatts > 0 ? 
    parsedData.load > (systemCapacityWatts * 0.8) : false;
  
  // Calculate percentage based on system capacity in watts (not device capacity)
  const loadPercentage = systemCapacityWatts > 0 ? 
    Math.min((parsedData.load / systemCapacityWatts) * 100, 100) : 
    parsedData.loadPercentage || 0;
  
  // Calculate battery percentage based on battery voltage and nominal voltage with 1.15 scaling factor
  const calculatedBatteryPercentage = (parsedData.batteryVoltage && parsedData.nominalVoltage && parsedData.nominalVoltage > 0) 
    ? Math.min(Math.max((parsedData.batteryVoltage / (parsedData.nominalVoltage * 1.15)) * 100, 0), 100)
    : parsedData.batteryPercentage || 0;
  
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
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${calculatedBatteryPercentage < 20 ? 'text-red-500' : 'text-orange-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="6" width="18" height="12" rx="2" />
              <line x1="23" y1="13" x2="23" y2="11" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">
                {typeof calculatedBatteryPercentage === 'number' ? calculatedBatteryPercentage.toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-gray-300">
                Voltage: {typeof parsedData.batteryVoltage === 'number' ? parsedData.batteryVoltage.toFixed(1) : '0.0'}V
                {parsedData.nominalVoltage && <span> / {parsedData.nominalVoltage.toFixed(1)}V</span>}
              </p>
              {calculatedBatteryPercentage < 20 && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                  Low Battery
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Power Output Card - UPDATED icon */}
        <Card className={`bg-black/40 ${isSurgeCondition ? 'border-red-500/50' : 'border-orange-500/20'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Power Output</CardTitle>
            {isSurgeCondition ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-white">
                  {typeof parsedData.load === 'number' ? parsedData.load.toFixed(0) : '0'}W
                </p>
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
                Capacity: {parsedData.deviceCapacity || 0} KVA ({systemCapacity} KW) | Load: {typeof loadPercentage === 'number' ? loadPercentage.toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-gray-300">
                Voltage: {typeof parsedData.voltage === 'number' ? parsedData.voltage.toFixed(1) : '0.0'}V
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Electrical Parameters Card */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Electrical Params</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <p className="text-xs text-gray-300">Voltage:</p>
                <p className="text-xs text-white text-right">
                  {typeof parsedData.voltage === 'number' ? parsedData.voltage.toFixed(1) : '0.0'}V
                </p>
                
                <p className="text-xs text-gray-300">Current:</p>
                <p className="text-xs text-white text-right">
                  {typeof parsedData.current === 'number' ? parsedData.current.toFixed(2) : '0.00'}A
                </p>
                
                <p className="text-xs text-gray-300">Frequency:</p>
                <p className="text-xs text-white text-right">
                  {typeof parsedData.frequency === 'number' ? parsedData.frequency.toFixed(1) : '0.0'}Hz
                </p>
                
                <p className="text-xs text-gray-300">Power Factor:</p>
                <p className="text-xs text-white text-right">
                  {typeof parsedData.powerFactor === 'number' ? parsedData.powerFactor.toFixed(2) : '0.00'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Energy & Source Card - MODIFIED: removed Load States section */}
        <Card className="bg-black/40 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Energy & Source</CardTitle>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-white">
                {typeof parsedData.energy === 'number' ? parsedData.energy.toFixed(2) : '0.00'} kWh
              </p>
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

      {/* Second row grid for Load States and Activity Log */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Load States Card - NEW CARD */}
        {loads.length > 0 && (
          <Card className="bg-black/40 border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white">Load States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {loads.map((load) => (
                  <div key={load.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-3 h-3 rounded-full ${load.state ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                    <span className={load.state ? 'text-green-400' : 'text-gray-400'}>
                      {load.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
    </div>
  );
};
