
import { 
  ChartContainer, 
  ChartTooltip 
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
import { format, subMinutes } from "date-fns";

// Generate data for the chart with 24 dots at 10-minute intervals
const generate10MinuteData = (
  capacity: number, 
  currentPower: number = 0, 
  batteryPercentage: number = 0, 
  energyKWh: number = 0
) => {
  // Display 24 dots (4 hours with 10-minute intervals)
  const dataPoints = 24;
  const intervalMinutes = 10;
  const currentDate = new Date();
  
  // Create data points spanning 4 hours back from current time
  const dataArray = [];
  for (let i = dataPoints - 1; i >= 0; i--) {
    // Calculate the date for this data point (going backward from current time)
    const pointDate = subMinutes(currentDate, i * intervalMinutes);
    
    // Format time for display
    const formattedTime = format(pointDate, 'HH:mm');
    const formattedDateTime = format(pointDate, 'yyyy-MM-dd HH:mm');
    
    // Get hour and minute for determining power patterns
    const hour = pointDate.getHours();
    const minute = pointDate.getMinutes();
    
    // Create a power curve based on time of day
    const isPeak = hour >= 18 && hour <= 21; 
    const isMorning = hour >= 6 && hour <= 9;
    const baseline = Math.random() * 0.3 * capacity; // 0-30% of capacity as baseline
    
    // Generate simulated battery curve that starts high in morning, drains during day, charges in evening
    let batteryValue;
    // If we're at the current time point, use real battery percentage if available
    if (i === 0 && batteryPercentage > 0) {
      batteryValue = batteryPercentage;
    } else {
      // Otherwise simulate battery values based on time of day
      if (hour >= 6 && hour <= 17) {
        // Battery drains during the day (faster during peak hours)
        batteryValue = 80 - ((hour - 6) * 3) - ((minute / 60) * 3) + (Math.random() * 5);
      } else if (hour >= 18 && hour <= 23) {
        // Charging in evening
        batteryValue = 40 + ((hour - 18) * 5) + ((minute / 60) * 5) + (Math.random() * 5);
      } else {
        // Overnight steady or slight charging
        batteryValue = 70 + (Math.random() * 5);
      }
      // Ensure battery percentage stays between 10% and 100%
      batteryValue = Math.min(Math.max(batteryValue, 10), 100);
    }
    
    // Use the real power value for the current time point
    let powerValue; 
    if (i === 0) {
      // Use actual current power if available
      powerValue = Math.round(currentPower);
    } else {
      // Otherwise simulate power values with typical usage patterns
      powerValue = isPeak 
        ? Math.round(baseline + (Math.random() * 0.5 * capacity)) // Higher during peak
        : isMorning
          ? Math.round(baseline + (Math.random() * 0.3 * capacity)) // Medium during morning
          : Math.round(baseline + (Math.random() * 0.2 * capacity)); // Baseline during other times
    }
    
    // Calculate load percentage
    const loadPercentage = capacity > 0 ? Math.min(Math.round((powerValue / capacity) * 100), 100) : 0;
    
    dataArray.push({
      dateTime: pointDate,
      timestamp: pointDate.getTime(),
      hour: formattedTime,
      formattedHour: formattedTime,
      formattedDateTime: formattedDateTime,
      power: powerValue,
      loadPercentage: loadPercentage,
      batteryPercentage: Math.round(batteryValue),
      surgeThreshold: Math.round(capacity)
    });
  }
  
  return dataArray;
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
    let realPower = 0;
    let energyKWh = 0;
    let batteryPercentage = 0;
    
    if (firebaseData) {
      // FIXED: Get the actual power value from Firebase
      // The device is ON (power = 1) and we have real_power data
      if (firebaseData.power === 1) {
        // Parse real_power as a number to ensure it's treated as a number
        realPower = parseFloat(firebaseData.real_power) || 
                   parseFloat(firebaseData.power) || 
                   currentPower || 0;
      } else {
        // Device is OFF, no power consumption
        realPower = 0;
      }
      
      // Get energy from firebase data in kWh
      energyKWh = parseFloat(firebaseData.energy || '0');
      
      // FIXED: Get battery percentage directly from Firebase using parseFloat to ensure numeric value
      batteryPercentage = parseFloat(firebaseData.battery_percentage || '0');
      
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

      console.log("Firebase data for chart (FIXED):", {
        powerState: firebaseData.power,
        rawRealPower: firebaseData.real_power,
        parsedRealPower: parseFloat(firebaseData.real_power || '0'),
        calculatedRealPower: realPower,
        batteryPercentage: batteryPercentage,
        energy: energyKWh,
        rawFirebaseData: firebaseData
      });
    }
    
    // Calculate system capacity in watts (from KW)
    const systemCapacityWatts = systemCapacity * 1000 || 1000;
    
    // Always update data when dependencies change
    const now = Date.now();
    const timeElapsedSinceLastUpdate = now - lastUpdateTime;
    
    // Update if dependencies changed OR if it's been 1+ minutes
    if (timeElapsedSinceLastUpdate >= 60000 || data.length === 0) { // 1 minute (60000ms) or initial load
      console.log("Refreshing power consumption chart data with 24 data points", {
        realPower, batteryPercentage, systemCapacityWatts
      });
      setData(generate10MinuteData(systemCapacityWatts, realPower, batteryPercentage, energyKWh));
      setLastUpdateTime(now);
    }
    
    // Set up an interval to refresh data every 1 minute (60000 ms)
    const intervalId = setInterval(() => {
      console.log("Refreshing power consumption chart data (1 min interval)");
      setData(generate10MinuteData(systemCapacityWatts, realPower, batteryPercentage, energyKWh));
      setLastUpdateTime(Date.now());
    }, 60000); // 1 minute to ensure frequent updates
    
    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [currentPower, systemCapacity, firebaseData, data.length]);

  // Set maxValue to 110% of system capacity for chart upper bound
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
            dot={false}
          />
          <Area 
            type="monotone" 
            dataKey="batteryPercentage" 
            stroke="#10B981" 
            fillOpacity={0.7}
            fill="url(#batteryGradient)" 
            yAxisId="percentage"
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
};
