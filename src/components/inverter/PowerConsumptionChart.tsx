import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { format } from "date-fns";

// Generate data for the chart with real current values
const generateHourlyData = (
  capacity: number, 
  currentPower: number = 0, 
  batteryPercentage: number = 0, 
  energyKWh: number = 0
) => {
  // Changed to display only 4 hours (current hour + 3 hours before)
  const hoursToShow = 4;
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();
  
  // Create base date object for today
  const today = new Date();
  
  // Get hours spanning 3 hours back from current hour
  const hours = [];
  for (let i = hoursToShow - 1; i >= 0; i--) {
    hours.push(currentHour - i);
  }
  
  return hours.map((hour) => {
    // Adjust for negative hours (previous day)
    const adjustedHour = hour < 0 ? hour + 24 : hour;
    
    // Create datetime for this hour
    const dateTime = new Date(today);
    dateTime.setHours(adjustedHour, 0, 0, 0);
    
    // Format time for display
    const formattedTime = format(dateTime, 'HH:mm');
    const formattedDateTime = format(dateTime, 'yyyy-MM-dd HH:mm');
    
    // Create a power curve based on time of day
    const isPeak = adjustedHour >= 18 && adjustedHour <= 21; 
    const isMorning = adjustedHour >= 6 && adjustedHour <= 9;
    const baseline = Math.random() * 0.3 * capacity; // 0-30% of capacity as baseline
    
    // Generate simulated battery curve that starts high in morning, drains during day, charges in evening
    let batteryValue;
    // If we have a real battery percentage for the current hour, use it
    if (adjustedHour === currentHour) {
      batteryValue = batteryPercentage;
    } else {
      // Otherwise simulate battery values based on time of day
      if (adjustedHour >= 6 && adjustedHour <= 17) {
        // Battery drains during the day (faster during peak hours)
        batteryValue = 80 - ((adjustedHour - 6) * 3) + (Math.random() * 10);
      } else if (adjustedHour >= 18 && adjustedHour <= 23) {
        // Charging in evening
        batteryValue = 40 + ((adjustedHour - 18) * 5) + (Math.random() * 10);
      } else {
        // Overnight steady or slight charging
        batteryValue = 70 + (Math.random() * 10);
      }
      // Ensure battery percentage stays between 10% and 100%
      batteryValue = Math.min(Math.max(batteryValue, 10), 100);
    }
    
    // Use the real power value for the current hour
    let powerValue; 
    if (adjustedHour === currentHour) {
      // Use actual current power if available
      powerValue = Math.round(currentPower);
    } else {
      // Otherwise simulate power values with typical usage patterns
      powerValue = isPeak 
        ? Math.round(baseline + (Math.random() * 0.5 * capacity)) // Higher during peak
        : isMorning
          ? Math.round(baseline + (Math.random() * 0.3 * capacity)) // Medium during morning
          : Math.round(baseline); // Baseline during other times
    }
    
    // Calculate load percentage
    const loadPercentage = capacity > 0 ? Math.min(Math.round((powerValue / capacity) * 100), 100) : 0;
    
    return {
      dateTime: dateTime,
      hour: formattedTime,
      formattedHour: formattedTime,
      formattedDateTime: formattedDateTime,
      power: powerValue,
      loadPercentage: loadPercentage,
      batteryPercentage: Math.round(batteryValue),
      surgeThreshold: Math.round(capacity)
    };
  });
};

interface PowerConsumptionChartProps {
  systemCapacity: number;
  currentPower?: number;
  firebaseData?: any;
}

export const PowerConsumptionChart = ({ 
  systemCapacity, 
  currentPower = 0,
  firebaseData
}: PowerConsumptionChartProps) => {
  const [data, setData] = useState<any[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const isMobile = useIsMobile();

  // Update chart data at intervals or when dependencies change
  useEffect(() => {
    // Extract power and battery data from firebaseData if available
    let realPower = currentPower;
    let energyKWh = 0;
    let batteryPercentage = 0;
    
    if (firebaseData) {
      // Get power from firebase data
      realPower = firebaseData.power === 1 
        ? (firebaseData.output_power || firebaseData.real_power || firebaseData.power_output || currentPower) 
        : 0;
      
      // Get energy from firebase data in kWh
      energyKWh = firebaseData.energy || 0;
      
      // Get battery percentage from firebase data
      batteryPercentage = firebaseData.battery_percentage || 0;
      
      // If no battery percentage but we have battery voltage and nominal voltage
      if (!batteryPercentage && firebaseData.battery_voltage && firebaseData.nominal_voltage) {
        batteryPercentage = Math.min(
          Math.max(
            (firebaseData.battery_voltage / firebaseData.nominal_voltage) * 100, 
            0
          ), 
          100
        );
      }
    }
    
    // Calculate system capacity in watts (from KW)
    const systemCapacityWatts = systemCapacity * 1000 || 1000;
    
    // Always update data when dependencies change
    const now = Date.now();
    const timeElapsedSinceLastUpdate = now - lastUpdateTime;
    
    // Update if dependencies changed OR if it's been 2+ minutes (changed from 10 minutes)
    if (timeElapsedSinceLastUpdate >= 120000 || data.length === 0) { // 2 minutes (120000ms) or initial load
      console.log("Refreshing power consumption chart data");
      setData(generateHourlyData(systemCapacityWatts, realPower, batteryPercentage, energyKWh));
      setLastUpdateTime(now);
    }
    
    // Set up an interval to refresh data every 2 minutes (120000 ms) (changed from 10 minutes)
    const intervalId = setInterval(() => {
      console.log("Refreshing power consumption chart data (2 min interval)");
      setData(generateHourlyData(systemCapacityWatts, realPower, batteryPercentage, energyKWh));
      setLastUpdateTime(Date.now());
    }, 120000); // 2 minutes (changed from 10 minutes)
    
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [currentPower, systemCapacity, firebaseData]);

  // Set maxValue to 110% of system capacity for chart upper bound
  // systemCapacity is in KW, so multiply by 1000 to get watts
  const maxValue = systemCapacity * 1000 * 1.1; 
  
  // The surge threshold is the system capacity itself (in watts)
  const surgeThreshold = systemCapacity * 1000;

  const chartConfig = {
    power: {
      label: "Power",
      theme: {
        light: "#F97316", // Orange
        dark: "#F97316",
      },
    },
    batteryPercentage: {
      label: "Battery %",
      theme: {
        light: "#10B981", // Green
        dark: "#10B981",
      },
    },
    surgeThreshold: {
      label: "Surge Threshold",
      theme: {
        light: "#EF4444", // Red
        dark: "#EF4444",
      },
    },
  };

  return (
    <div className="w-full h-64 sm:h-80 p-3 sm:p-4 bg-black/40 rounded-lg border border-orange-500/20">
      <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-4">Power Consumption (4h)</h3>
      <ChartContainer 
        config={chartConfig} 
        className="h-48 sm:h-64"
      >
        <AreaChart
          data={data}
          margin={{ 
            top: 10, 
            right: isMobile ? 10 : 30, 
            left: isMobile ? -20 : 0, 
            bottom: 0 
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis 
            dataKey="formattedHour" 
            stroke="#999" 
            tick={{ fontSize: isMobile ? 10 : 12, fill: "#999" }}
            interval={isMobile ? 2 : 1}
          />
          <YAxis 
            stroke="#999" 
            domain={[0, maxValue]} 
            tickFormatter={(value) => `${value}W`} 
            tick={{ fontSize: isMobile ? 10 : 12, fill: "#999" }}
            width={isMobile ? 40 : 45}
            yAxisId="power"
          />
          <YAxis 
            stroke="#999" 
            domain={[0, 100]} 
            tickFormatter={(value) => `${value}%`} 
            tick={{ fontSize: isMobile ? 10 : 12, fill: "#999" }}
            width={isMobile ? 40 : 45}
            yAxisId="percentage"
            orientation="right"
          />
          <ChartTooltip 
            content={(props) => {
              const dataPoint = props.payload && props.payload.length > 0 ? props.payload[0].payload : null;
              
              if (!dataPoint) {
                return <div className="bg-black/90 border border-orange-500/30 min-w-[8rem] rounded-lg shadow-xl px-2.5 py-1.5 text-xs">
                  <div className="font-medium text-gray-200">No data</div>
                </div>;
              }
              
              return (
                <div className="bg-black/90 border border-orange-500/30 min-w-[8rem] rounded-lg shadow-xl px-2.5 py-1.5 text-xs">
                  <div className="font-medium text-gray-200">
                    {dataPoint.formattedDateTime}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px] bg-[#F97316]" />
                    <div className="flex flex-1 justify-between leading-none items-center">
                      <span className="text-muted-foreground">Power</span>
                      <span className="font-mono font-medium tabular-nums text-white">
                        {dataPoint.power}W
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-2.5 w-2.5 rounded-[2px] bg-[#10B981]" />
                    <div className="flex flex-1 justify-between leading-none items-center">
                      <span className="text-muted-foreground">Battery</span>
                      <span className="font-mono font-medium tabular-nums text-white">
                        {dataPoint.batteryPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
          <defs>
            <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#F97316" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <ReferenceLine 
            y={surgeThreshold} 
            stroke="#EF4444" 
            strokeDasharray="3 3" 
            label={isMobile ? null : { 
              value: `Surge (${surgeThreshold}W)`, 
              position: "insideBottomRight", 
              fill: "#EF4444", 
              fontSize: 12,
              style: {
                fontWeight: "bold",
                filter: "drop-shadow(0px 0px 3px rgba(0,0,0,0.9))"
              }
            }} 
            yAxisId="power"
          />
          <Area 
            type="monotone" 
            dataKey="power" 
            stroke="#F97316" 
            fillOpacity={1}
            fill="url(#powerGradient)" 
            yAxisId="power"
          />
          <Area 
            type="monotone" 
            dataKey="batteryPercentage" 
            stroke="#10B981" 
            fillOpacity={0.7}
            fill="url(#batteryGradient)" 
            yAxisId="percentage"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
};
