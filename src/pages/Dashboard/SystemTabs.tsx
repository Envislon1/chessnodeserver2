
import { InverterParameters } from "@/components/inverter/InverterParameters";
import { LoadControlPanel } from "@/components/inverter/LoadControlPanel";
import { PowerConsumptionChart } from "@/components/inverter/PowerConsumptionChart";
import { InverterDataDisplay } from "@/components/inverter/InverterDataDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

interface InverterSystemParameters {
  battery_percentage: number;
  battery_voltage: number;
  output_capacity: number;
  output_voltage: number;
  output_power: number;
  frequency: number;
  power_factor: number;
  mains_present: boolean;
  solar_present: boolean;
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

  // Extract correct power data from Firebase
  // Important: Use the power value directly from Firebase data
  const power = firebaseData?.power === 1 ? 
    (firebaseData?.power * parseFloat(firebaseData?.real_power || firebaseData?.power || 0)) : 0;

  console.log("Power in SystemTabs:", {
    firebasePower: firebaseData?.power,
    firebaseRealPower: firebaseData?.real_power,
    calculatedPower: power
  });

  // Add nominal voltage and power values to parameters if available from firebase
  const extendedParameters = parameters ? {
    ...parameters,
    nominal_voltage: firebaseData?.nominal_voltage || parameters.nominal_voltage,
    // Ensure we use the correct real power values from Firebase
    real_power: firebaseData?.real_power || 0,
    output_power: firebaseData?.real_power || 0,
    // Ensure battery percentage is from Firebase
    battery_percentage: firebaseData?.battery_percentage || parameters.battery_percentage
  } : null;

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
        <PowerConsumptionChart 
          systemCapacity={systemCapacity} 
          currentPower={firebaseData?.real_power || 0}
          firebaseData={firebaseData}
        />
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
