import { InverterParameters } from "@/components/inverter/InverterParameters";
import { LoadControlPanel } from "@/components/inverter/LoadControlPanel";
import { PowerConsumptionChart } from "@/components/inverter/PowerConsumptionChart";
import { InverterDataDisplay } from "@/components/inverter/InverterDataDisplay";
import { FirmwareUpdateCard } from "@/components/inverter/FirmwareUpdateCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import { setupAutomaticDataLogging } from "@/utils/dataLogging";

interface InverterSystemParameters {
  battery_percentage: number;
  battery_voltage: number;
  output_capacity: number;
  output_voltage: number;
  output_power: number;
  frequency: number;
  power_factor: number;
  mains_present: boolean | number;
  solar_present: boolean | number;
  energy_kwh: number;
  apparent_power: number;
  reactive_power: number;
  real_power: number;
  acv_rms: number;
  acv_peak_peak: number;
  acc_rms: number;
  acc_peak_peak: number;
  nominal_voltage?: number;
}

interface SystemTabsProps {
  parameters: InverterSystemParameters | null;
  showAdvanced: boolean;
  deviceData: string | null;
  inverterId: string;
  firebaseData: any;
}

export const SystemTabs = ({ 
  parameters, 
  showAdvanced, 
  deviceData, 
  inverterId,
  firebaseData 
}: SystemTabsProps) => {
  // Get device capacity from Firebase data in KVA
  const deviceCapacity = firebaseData?.device_capacity || parameters?.output_capacity || 0;
  
  // Calculate system capacity as 75% of device capacity (KVA to KW)
  const systemCapacity = deviceCapacity ? Math.round((parseFloat(deviceCapacity) * 0.75) * 100) / 100 : 0;
  
  const isMobile = useIsMobile();

  // Ensure we're using the correct load value from Firebase
  // Use load directly if available, otherwise try real_power
  const loadValue = firebaseData?.power === 1 ? 
    parseFloat(firebaseData?.load || '0') || parseFloat(firebaseData?.real_power || '0') : 0;

  // Calculate battery percentage with interpolation for lead acid batteries
  // For lead acid, minimum voltage is nominal/1.15 and maximum is nominal*1.15
  const calculateBatteryPercentage = () => {
    // If battery_percentage is directly available from Firebase, use it
    if (firebaseData?.battery_percentage !== undefined) {
      return firebaseData.battery_percentage;
    }
    
    // Otherwise calculate from voltage
    if (firebaseData?.battery_voltage && firebaseData?.nominal_voltage) {
      const nominalVoltage = firebaseData.nominal_voltage;
      const currentVoltage = firebaseData.battery_voltage;
      const minVoltage = nominalVoltage / 1.15; // Lower limit for lead acid
      const maxVoltage = nominalVoltage * 1.15; // Upper limit for lead acid
      
      // Interpolate between min and max voltage
      if (currentVoltage <= minVoltage) return 0;
      if (currentVoltage >= maxVoltage) return 100;
      
      // Linear interpolation between min and max
      const percentage = ((currentVoltage - minVoltage) / (maxVoltage - minVoltage)) * 100;
      return Math.min(Math.max(percentage, 0), 100); // Clamp between 0-100
    }
    
    // Fall back to parameters data if available
    return parameters?.battery_percentage || 0;
  };

  const batteryPercentage = calculateBatteryPercentage();

  // Add nominal voltage and power values to parameters if available from firebase
  const extendedParameters = parameters ? {
    ...parameters,
    nominal_voltage: firebaseData?.nominal_voltage || parameters.nominal_voltage,
    // Use the correct load values
    real_power: loadValue,
    output_power: loadValue,
    // Use properly calculated battery percentage
    battery_percentage: batteryPercentage
  } : null;

  // Log inverter data to Supabase on a regular interval regardless of user being logged in
  useEffect(() => {
    if (!inverterId || !firebaseData) return;
    
    // Set up automatic data logging with the proper parameters
    const logCurrentData = async () => {
      await setupAutomaticDataLogging(inverterId, firebaseData);
    };
    
    // Initial log
    logCurrentData();
    
    // Set up interval for periodic logging (every 2 minutes)
    const interval = setInterval(logCurrentData, 120000);
    
    return () => clearInterval(interval);
  }, [inverterId, firebaseData, loadValue]);

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid grid-cols-3 bg-black/40 border-orange-500/20">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="control">Control</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="space-y-4">
        {extendedParameters && (
          <InverterParameters 
            data={extendedParameters} 
            showAdvanced={showAdvanced} 
            deviceCapacity={deviceCapacity} 
          />
        )}
        
        {/* Power consumption chart as a full-width element */}
        <PowerConsumptionChart 
          systemCapacity={systemCapacity} 
          currentPower={loadValue}
          firebaseData={firebaseData}
          inverterId={inverterId}
        />
        
        {/* Show Firmware Update Card only in Advanced View */}
        {showAdvanced && firebaseData && (
          <FirmwareUpdateCard 
            selectedSystemId={inverterId} 
            deviceIp={firebaseData?.ip_address}
          />
        )}
      </TabsContent>
      
      <TabsContent value="control" className="space-y-4">
        <LoadControlPanel inverterId={inverterId} />
      </TabsContent>
      
      <TabsContent value="data" className="space-y-4">
        <InverterDataDisplay 
          deviceData={deviceData} 
          inverterId={inverterId} 
          firebaseData={firebaseData} 
        />
      </TabsContent>
    </Tabs>
  );
};
