
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, Gauge, Power, Zap, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

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
  };
  showAdvanced: boolean;
}

export const InverterParameters = ({ data, showAdvanced }: ParameterProps) => {
  const [surgeThreshold, setSurgeThreshold] = useState(85); // Default 85%
  const isPowerSurge = data.output_power && data.output_capacity 
    ? (data.output_power / data.output_capacity) > (surgeThreshold / 100)
    : false;

  // Check for power surge (above 85% of capacity)
  

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-black/40 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Battery Status</CardTitle>
          <Battery className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-white">{data.battery_percentage}%</p>
            <p className="text-xs text-gray-300">Voltage: {data.battery_voltage}V</p>
          </div>
        </CardContent>
      </Card>

      <Card className={`bg-black/40 border-${isPowerSurge ? 'red-500/50' : 'orange-500/20'}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white">Output Parameters</CardTitle>
          {isPowerSurge ? 
            <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" /> : 
            <Power className="h-4 w-4 text-orange-500" />
          }
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-white">{data.output_power}W</p>
              {isPowerSurge && 
                <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                  Power Surge
                </span>
              }
            </div>
            <p className="text-xs text-gray-300">
              Capacity: {data.output_capacity}VA | Voltage: {data.output_voltage}V
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
            <p className="text-2xl font-bold text-white">{data.power_factor}</p>
            <p className="text-xs text-gray-300">
              Frequency: {data.frequency}Hz
            </p>
          </div>
        </CardContent>
      </Card>

      {showAdvanced && (
        <>
          <Card className="bg-black/40 border-orange-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Power Analysis</CardTitle>
              <Power className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs text-gray-300">Apparent: {data.apparent_power}VA</p>
                <p className="text-xs text-gray-300">Real: {data.real_power}W</p>
                <p className="text-xs text-gray-300">Reactive: {data.reactive_power}VAR</p>
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
                <p className="text-xs text-gray-300">Voltage (RMS): {data.acv_rms}V</p>
                <p className="text-xs text-gray-300">Voltage (P-P): {data.acv_peak_peak}V</p>
                <p className="text-xs text-gray-300">Current (RMS): {data.acc_rms}A</p>
                <p className="text-xs text-gray-300">Current (P-P): {data.acc_peak_peak}A</p>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 lg:col-span-4 p-4 bg-black/40 border border-orange-500/20 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Surge Threshold Configuration</h3>
            <div className="flex items-center gap-4">
              <Slider
                value={[surgeThreshold]}
                onValueChange={(values) => setSurgeThreshold(values[0])}
                max={100}
                min={50}
                step={1}
                className="flex-1"
              />
              <span className="text-white min-w-[4rem]">{surgeThreshold}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
