
import { InverterParameters } from "@/components/inverter/InverterParameters";
import { LoadControlPanel } from "@/components/inverter/LoadControlPanel";
import { PowerConsumptionChart } from "@/components/inverter/PowerConsumptionChart";
import { InverterDataDisplay } from "@/components/inverter/InverterDataDisplay";
import { DeviceStatusMonitor } from "@/components/inverter/DeviceStatusMonitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InverterSystemParameters } from "./types";

interface SystemTabsProps {
  parameters: InverterSystemParameters | null;
  showAdvanced: boolean;
  deviceData: string | null;
  inverterId: string;
}

export const SystemTabs = ({ parameters, showAdvanced, deviceData, inverterId }: SystemTabsProps) => {
  // Calculate system capacity for PowerConsumptionChart
  const systemCapacity = parameters?.output_capacity || 3000;
  const isMobile = useIsMobile();

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-3'} bg-black/40 border-orange-500/20`}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="controls">Controls</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="space-y-4">
        {parameters && (
          <InverterParameters data={parameters} showAdvanced={showAdvanced} />
        )}
        <PowerConsumptionChart systemCapacity={systemCapacity} />
      </TabsContent>
      
      <TabsContent value="controls" className="space-y-4">
        <LoadControlPanel inverterId={inverterId} />
      </TabsContent>
      
      <TabsContent value="data" className="space-y-4">
        <DeviceStatusMonitor inverterId={inverterId} />
        {deviceData && <InverterDataDisplay deviceData={deviceData} inverterId={inverterId} />}
      </TabsContent>
    </Tabs>
  );
};
