
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, Gauge, Power, Zap, AlertTriangle } from "lucide-react";
interface ParameterProps {
  data: {
    battery_percentage?: number;
    battery_voltage?: number;
    output_capacity?: number;
    output_voltage?: number;
    output_power?: number;
    frequency?: number;
    power_factor?: number;
    mains_present?: boolean;
    solar_present?: boolean;
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
  deviceCapacity: number; // Device capacity from Firebase in KVA
}
export const InverterParameters = ({
  data,
  showAdvanced,
  deviceCapacity
}: ParameterProps) => {
  // Calculate system capacity as 75% of device capacity (KVA to KW)
  const systemCapacity = deviceCapacity ? Math.round(deviceCapacity * 0.75 * 100) / 100 : 0;

  // Convert system capacity to Watts for comparison with output_power
  const systemCapacityWatts = systemCapacity * 1000;

  // FIXED: Get the actual power from data
  // Only use non-zero power values to correctly calculate load
  const currentPower = parseFloat(data.real_power?.toString() || data.output_power?.toString() || '0');

  console.log("InverterParameters power data (FIXED):", {
    realPower: data.real_power,
    outputPower: data.output_power,
    currentPower: currentPower,
    systemCapacityWatts: systemCapacityWatts
  });

  // Set the surge threshold at 80% of system capacity
  const isPowerSurge = systemCapacityWatts ? currentPower / systemCapacityWatts > 0.8 : false;

  // Calculate load percentage based on actual power consumption and system capacity
  const loadPercentage = systemCapacityWatts 
    ? Math.min(Math.round((currentPower / systemCapacityWatts) * 100), 100) 
    : 0;

  // Calculate battery percentage based on battery voltage and nominal voltage if not directly available
  const calculatedBatteryPercentage = data.battery_percentage || 
    (data.battery_voltage && data.nominal_voltage && data.nominal_voltage > 0 
      ? Math.min(Math.max((data.battery_voltage / data.nominal_voltage) * 100, 0), 100)
      : 0);
      
  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-black/40 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Battery Status</CardTitle>
          <Battery className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-white">{calculatedBatteryPercentage?.toFixed(1) ?? 'N/A'}%</p>
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
          {isPowerSurge ? <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" /> : <Power className="h-4 w-4 text-orange-500" />}
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
              Capacity: {deviceCapacity ?? 'N/A'} KVA ({systemCapacity} KW) | Load: {loadPercentage}%
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
          <Zap className="h-4 w-4 text-orange-500" />
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

      {showAdvanced && <>
          <Card className="bg-black/40 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Power Analysis</CardTitle>
              <Power className="h-4 w-4 text-orange-500" />
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
              <Zap className="h-4 w-4 text-orange-500" />
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
