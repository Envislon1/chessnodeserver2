
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InverterStateCard } from "./InverterStateCard";

interface ParameterProps {
  data: {
    battery_percentage?: number;
    battery_voltage?: number;
    output_capacity?: number;
    output_voltage?: number;
    output_power?: number;
    frequency?: number;
    power_factor?: number;
    mains_present?: boolean | number;
    solar_present?: boolean | number;
    energy_kwh?: number;
    apparent_power?: number;
    reactive_power?: number;
    real_power?: number;
    acv_rms?: number;
    acv_peak_peak?: number;
    acc_rms?: number;
    acc_peak_peak?: number;
    nominal_voltage?: number;
  };
  showAdvanced: boolean;
  deviceCapacity: number; // Renamed from output_capacity to match SystemTabs prop
}
export const InverterParameters = ({
  data,
  showAdvanced,
  deviceCapacity
}: ParameterProps) => {
  // Calculate system capacity as 75% of device capacity (KVA to KW) only if deviceCapacity is valid
  const isValidCapacity = deviceCapacity > 0;
  const systemCapacity = isValidCapacity ? Math.round(deviceCapacity * 0.75 * 100) / 100 : 0;

  // Convert system capacity to Watts for comparison with output_power only if valid
  const systemCapacityWatts = systemCapacity * 1000;

  // Use load (real power) value from data
  const currentPower = parseFloat(data.real_power?.toString() || data.output_power?.toString() || '0');

  console.log("InverterParameters power data:", {
    realPower: data.real_power,
    outputPower: data.output_power,
    currentPower: currentPower,
    systemCapacityWatts: systemCapacityWatts,
    isValidCapacity: isValidCapacity,
    deviceCapacity: deviceCapacity
  });

  // Set the surge threshold at 80% of system capacity (only if we have a valid capacity)
  const isPowerSurge = isValidCapacity ? currentPower / systemCapacityWatts > 0.8 : false;

  // Calculate load percentage based on actual power consumption and system capacity
  // Show 0% if we don't have valid capacity data
  const loadPercentage = isValidCapacity && systemCapacityWatts > 0
    ? Math.min(Math.round((currentPower / systemCapacityWatts) * 100), 100) 
    : 0;

  // Calculate battery percentage using interpolation for lead acid batteries
  // For lead acid, minimum voltage is nominal/1.15 and maximum is nominal*1.15
  const calculateBatteryPercentage = () => {
    // If battery_percentage is directly available, use it
    // if (data.battery_percentage !== undefined) {
    //   return data.battery_percentage;
    // }
    
    // Otherwise calculate from voltage
    if (data.battery_voltage && data.nominal_voltage && data.nominal_voltage > 0) {
      const nominalVoltage = data.nominal_voltage;
      const currentVoltage = data.battery_voltage;
      const minVoltage = nominalVoltage / 1.15; // Lower limit for lead acid
      const maxVoltage = nominalVoltage * 1.15; // Upper limit for lead acid
      
      // Interpolate between min and max voltage
      if (currentVoltage <= minVoltage) return 0;
      if (currentVoltage >= maxVoltage) return 100;
      
      // Linear interpolation between min and max
      const percentage = ((currentVoltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
      return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100
    }
    
    return 0; // Default if no data available
  };
      
  const calculatedBatteryPercentage = calculateBatteryPercentage();
      
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-black/40 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Battery Status</CardTitle>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="6" width="18" height="12" rx="2" />
            <line x1="23" y1="13" x2="23" y2="11" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-white">
              {calculatedBatteryPercentage?.toFixed(1) ?? 'N/A'}%
            </p>
            <p className="text-xs text-gray-300">
              Voltage: {data.battery_voltage?.toFixed(1) ?? 'N/A'}V
              {data.nominal_voltage && <span> / {data.nominal_voltage.toFixed(1)}V</span>}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className={`bg-black/40 border-${isPowerSurge ? 'red-500/50' : 'orange-500/20'}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Output Parameters</CardTitle>
          {isPowerSurge ? (
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
              <p className="text-2xl font-bold text-white">{currentPower?.toFixed(0) ?? 'N/A'}W</p>
              {isPowerSurge && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">Surge</span>}
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
              Capacity: {isValidCapacity ? `${deviceCapacity} KVA (${systemCapacity} KW)` : 'N/A'} | 
              Load: {isValidCapacity ? `${loadPercentage}%` : 'N/A'}
            </p>
            <p className="text-xs text-gray-300">
              Voltage: {data.output_voltage?.toFixed(1) ?? 'N/A'}V
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-black/40 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Power Quality</CardTitle>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-white">{data.power_factor?.toFixed(2) ?? 'N/A'}</p>
            <p className="text-xs text-gray-300">
              Frequency: {data.frequency?.toFixed(1) ?? 'N/A'}Hz
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Fix the TypeScript error by properly handling the boolean or number type */}
      <InverterStateCard 
        batteryPercentage={calculatedBatteryPercentage || 0} 
        mainsPresent={data.mains_present === true || data.mains_present === 1 ? true : false}
        inverterOn={data.output_power !== undefined && data.output_power > 0}
        solarPresent={data.solar_present === true || data.solar_present === 1 ? true : false}
      />

      {showAdvanced && <>
          <Card className="bg-black/40 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Power Analysis</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64A9 9 0 0 1 20.77 15" />
                <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68" />
                <path d="M12 2v4" />
                <path d="m2 2 20 20" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs text-gray-300">Apparent: {data.apparent_power?.toFixed(1) ?? 'N/A'}VA</p>
                <p className="text-xs text-gray-300">Real: {data.real_power?.toFixed(1) ?? 'N/A'}W</p>
                <p className="text-xs text-gray-300">Reactive: {data.reactive_power?.toFixed(1) ?? 'N/A'}VAR</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">AC Parameters</CardTitle>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs text-gray-300">Voltage (RMS): {data.acv_rms?.toFixed(1) ?? 'N/A'}V</p>
                <p className="text-xs text-gray-300">Voltage (P-P): {data.acv_peak_peak?.toFixed(1) ?? 'N/A'}V</p>
                <p className="text-xs text-gray-300">Current (RMS): {data.acc_rms?.toFixed(2) ?? 'N/A'}A</p>
                <p className="text-xs text-gray-300">Current (P-P): {data.acc_peak_peak?.toFixed(2) ?? 'N/A'}A</p>
              </div>
            </CardContent>
          </Card>
        </>}
    </div>;
};
