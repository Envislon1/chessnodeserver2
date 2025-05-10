import { useState, useEffect, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, SkipBack, SkipForward, Trash2, PauseCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchHistoricalInverterData, deleteAllInverterData, setupAutomaticDataLogging } from '@/utils/dataLogging';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from "@/integrations/supabase/client";

interface PowerConsumptionChartProps {
  systemCapacity: number;
  currentPower: number;
  inverterId?: string;
  firebaseData?: any;
}

export const PowerConsumptionChart = ({ systemCapacity, currentPower, inverterId, firebaseData }: PowerConsumptionChartProps) => {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [data, setData] = useState<Array<{ time: string; power: number; timestamp?: string }>>([]);
  const [surgeData, setSurgeData] = useState<Array<{ time: string; power: number; timestamp?: string }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | '48hours'>('48hours'); // Removed 'week' option
  const [isPaused, setIsPaused] = useState(false);
  const isMobile = useIsMobile();
  
  // Set up automatic data logging regardless of user session state
  useEffect(() => {
    if (inverterId && firebaseData) {
      // Call the setupAutomaticDataLogging function directly
      setupAutomaticDataLogging(inverterId, firebaseData);
      
      // Set up interval for periodic logging (every 2 minutes)
      const interval = setInterval(() => {
        setupAutomaticDataLogging(inverterId, firebaseData);
      }, 120000);
      
      return () => clearInterval(interval);
    }
  }, [firebaseData, inverterId]);
  
  // Called when loading historical data
  const loadHistoricalData = async () => {
    if (!inverterId) return;
    
    setRefreshing(true);
    
    try {
      // Fetch historical data from Supabase
      const historicalData = await fetchHistoricalInverterData(inverterId, timeRange);
      
      if (historicalData && historicalData.length > 0) {
        // Process the data for the chart
        const chartData = historicalData.map(record => ({
          time: new Date(record.timestamp).toLocaleTimeString(),
          power: record.output_power || 0,
          timestamp: record.timestamp
        }))
        .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()); // Ensure chronological order
        
        // Limit data points to max 30 (reduced from 200)
        const limitedData = chartData.length > 30 
          ? reduceDataPoints(chartData, 30) 
          : chartData;
          
        setData(limitedData);
        console.log(`Loaded ${limitedData.length} historical data points from Supabase (from ${historicalData.length} records)`);
        
        // Detect surge data based on threshold instead of is_surge flag
        // Define surge as power > 80% of system capacity
        const surgeThreshold = systemCapacity * 800; // Convert to W and use 80%
        const surges = historicalData
          .filter(record => record.output_power > surgeThreshold)
          .map(record => ({
            time: new Date(record.timestamp).toLocaleTimeString(),
            power: record.output_power || 0,
            timestamp: record.timestamp
          }));
        
        setSurgeData(surges);
        console.log(`Loaded ${surges.length} surge points`);
      } else {
        console.log('No historical data available');
      }
    } catch (error) {
      console.error("Error loading historical data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Function to detect power surges in the data
  const detectSurges = (fullData: any[], capacityThreshold: number) => {
    // Define surge as power > 80% of system capacity
    const surgeThreshold = capacityThreshold * 800; // Convert to W and use 80%
    
    return fullData.filter(point => {
      return point.power > surgeThreshold;
    });
  };

  // Helper function to reduce data points while preserving data shape
  const reduceDataPoints = (fullData: any[], targetCount: number) => {
    if (fullData.length <= targetCount) return fullData;
    
    // Calculate interval to sample evenly across the entire dataset
    const interval = Math.ceil(fullData.length / targetCount);
    
    // Create a new array with reduced points
    const reduced = [];
    for (let i = 0; i < fullData.length; i += interval) {
      reduced.push(fullData[i]);
    }
    
    // Always include the first and last point for accuracy
    if (reduced[0] !== fullData[0]) reduced.unshift(fullData[0]);
    if (reduced[reduced.length - 1] !== fullData[fullData.length - 1]) {
      reduced.push(fullData[fullData.length - 1]);
    }
    
    return reduced;
  };
  
  // Navigate to previous time range
  const handlePrev = () => {
    if (timeRange === 'hour') {
      setTimeRange('day');
      toast({ title: "Showing data from the last day", duration: 2000 });
    } else if (timeRange === 'day') {
      setTimeRange('48hours');
      toast({ title: "Showing data from the last 48 hours", duration: 2000 });
    }
  };

  // Navigate to next time range
  const handleNext = () => {
    if (timeRange === '48hours') {
      setTimeRange('day');
      toast({ title: "Showing data from the last day", duration: 2000 });
    } else if (timeRange === 'day') {
      setTimeRange('hour');
      toast({ title: "Showing data from the last hour", duration: 2000 });
    }
    // If already at hour, stay at hour
  };

  // Toggle pause state
  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    toast({ 
      title: isPaused ? "Resuming data updates" : "Paused data updates",
      duration: 2000
    });
  };
  
  // Add current data point (from Firebase or current state)
  const addCurrentDataPoint = () => {
    if (isPaused) return; // Don't add data points when paused
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    // Use the currentPower prop which comes from the parent component
    const powerValue = typeof currentPower === 'number' ? currentPower : 0;
    
    setData(prevData => {
      // Create new data point
      const newPoint = { 
        time: timeString, 
        power: powerValue, 
        timestamp: now.toISOString() 
      };
      
      // Add to existing data
      const newData = [...prevData, newPoint];
      
      // Limit to 30 data points maximum (reduced from 200)
      if (newData.length > 30) {
        return newData.slice(-30); // Keep the most recent 30 points
      }
      return newData;
    });
    
    setLastUpdate(now);
    
    // Check if this is a surge based on power threshold
    if (powerValue > systemCapacity * 800) { // 80% of capacity in Watts
      setSurgeData(prevSurges => {
        const newSurge = {
          time: timeString,
          power: powerValue,
          timestamp: now.toISOString()
        };
        return [...prevSurges, newSurge].slice(-30); // Keep last 30 surges max (reduced from 100)
      });
      
      // Log surge to database if we have an inverterId
      if (inverterId) {
        logPowerSurge(inverterId, powerValue, now.toISOString());
      }
    }
  };
  
  // Log power surge to the database
  const logPowerSurge = async (inverterId: string, power: number, timestamp: string) => {
    try {
      // Since we don't have is_surge column, we just log the high power reading
      await supabase
        .from('inverter_parameters')
        .insert({
          inverter_id: inverterId,
          output_power: power,
          timestamp: timestamp
        });
        
      console.log("Power surge logged to database");
    } catch (error) {
      console.error("Error logging surge data:", error);
    }
  };
  
  // Clear chart data locally without affecting database
  const clearChartData = () => {
    setData([]);
    setSurgeData([]);
    toast({
      title: "Chart data cleared",
      description: "The chart has been reset (local view only).",
      variant: "default",
    });
  };
  
  // Delete all chart data including data in Supabase
  const deleteChartData = async () => {
    // Clear local chart data
    setData([]);
    setSurgeData([]);
    
    // Delete inverter data from Supabase if inverterId is available
    if (inverterId) {
      try {
        // Use the deleteAllInverterData utility function
        const success = await deleteAllInverterData(inverterId);
        
        if (success) {
          toast({
            title: "Chart data deleted",
            description: "All power consumption history has been deleted from database.",
            variant: "default",
          });
          
          // Clear any remaining localStorage cache for this system
          localStorage.removeItem(`chartData_${inverterId}`);
          localStorage.removeItem(`surgeData_${inverterId}`);
          
        } else {
          toast({
            title: "Error deleting data",
            description: "Failed to delete data from database. Local chart was cleared.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error deleting inverter data:', error);
        toast({
          title: "Error deleting data",
          description: "Failed to delete data from database. Local chart was cleared.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Chart data cleared",
        description: "Chart has been reset but database records remain.",
        variant: "default",
      });
    }
  };
  
  // Store chart data in localStorage when it changes
  useEffect(() => {
    if (inverterId && data.length > 0) {
      localStorage.setItem(`chartData_${inverterId}`, JSON.stringify(data));
    }
    
    if (inverterId && surgeData.length > 0) {
      localStorage.setItem(`surgeData_${inverterId}`, JSON.stringify(surgeData));
    }
  }, [data, surgeData, inverterId]);
  
  // Load data from localStorage on initial load
  useEffect(() => {
    if (inverterId) {
      const savedChartData = localStorage.getItem(`chartData_${inverterId}`);
      const savedSurgeData = localStorage.getItem(`surgeData_${inverterId}`);
      
      if (savedChartData) {
        try {
          setData(JSON.parse(savedChartData));
        } catch (e) {
          console.error("Failed to parse saved chart data", e);
        }
      }
      
      if (savedSurgeData) {
        try {
          setSurgeData(JSON.parse(savedSurgeData));
        } catch (e) {
          console.error("Failed to parse saved surge data", e);
        }
      }
      
      // Still load historical data after loading from localStorage
      loadHistoricalData();
    }
  }, [inverterId, timeRange]);
  
  // Set up continuous data collection - more frequent updates (every 5 seconds)
  useEffect(() => {
    if (isPaused) return;
    
    // Add current data point immediately
    addCurrentDataPoint();
    
    // Set up interval for continuous updates (every 5 seconds)
    const interval = setInterval(() => {
      addCurrentDataPoint();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [inverterId, isPaused, currentPower, systemCapacity]);
  
  // Update data when currentPower changes significantly
  useEffect(() => {
    if (currentPower !== undefined && !isPaused) {
      const timeSinceLastUpdate = new Date().getTime() - lastUpdate.getTime();
      const previousPower = data.length > 0 ? data[data.length - 1]?.power : null;
      
      // Add new point when power changes by more than 3% or it's been more than 10 seconds
      if (previousPower === null || 
          Math.abs(previousPower - currentPower) > (systemCapacity * 0.03) || 
          timeSinceLastUpdate > 10000) {
        addCurrentDataPoint();
      }
    }
  }, [currentPower, systemCapacity, isPaused, data, lastUpdate]);

  // Format system capacity for display
  const capacityLabel = useMemo(() => {
    if (systemCapacity >= 1) {
      return `${systemCapacity} kW`;
    } else {
      return `${systemCapacity * 1000} W`;
    }
  }, [systemCapacity]);

  // Calculate maxPower based on the highest value in the data or system capacity
  const maxPower = useMemo(() => {
    const maxInData = Math.max(...data.map(d => d.power), 0);
    // Use 20% more than max or system capacity, whichever is higher
    return Math.max(maxInData * 1.2, systemCapacity * 1000);
  }, [data, systemCapacity]);

  const timeRangeLabel = useMemo(() => {
    switch (timeRange) {
      case '48hours': return 'Last 48 Hours';
      case 'day': return 'Last 24 Hours';
      case 'hour': 
      default: return 'Last Hour';
    }
  }, [timeRange]);
  
  return (
    <Card className="bg-black/40 border-orange-500/20">
      <CardHeader>
        <div className="flex flex-wrap justify-between items-center">
          <CardTitle>Power Consumption</CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs border-gray-500/30 text-gray-400 hover:bg-gray-500/20"
              onClick={clearChartData}
            >
              Clear
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs border-red-500/30 text-red-500 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border border-orange-500/20">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete Chart Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all power consumption history from the chart and database. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-orange-500/30 text-gray-300 hover:bg-gray-800">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={deleteChartData}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <CardDescription>
          Current system load over time (continuous updates every 5 seconds)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis 
                dataKey="time" 
                stroke="#666" 
                tick={{ fill: '#999', fontSize: 10 }} 
                tickCount={isMobile ? 3 : 6} 
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#999', fontSize: 10 }}
                domain={[0, maxPower]} 
                label={{ 
                  value: 'Watts', 
                  angle: -90, 
                  position: 'insideLeft', 
                  style: { fill: '#999', fontSize: 10, textAnchor: 'middle' } 
                }} 
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000', borderColor: '#333', borderRadius: '4px' }} 
                labelStyle={{ color: '#999' }}
                itemStyle={{ color: '#f97316' }}
                formatter={(value) => [`${value} W`, 'Power']}
              />
              <Area 
                type="monotone" 
                dataKey="power" 
                stroke="#f97316" 
                strokeWidth={2}
                fill="url(#colorPower)"
                dot={false} // Make dots invisible
                activeDot={{ r: 5, fill: '#f97316', stroke: '#fff' }}
                isAnimationActive={false} // Disable animation for better performance with continuous updates
              />
              <defs>
                <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500 flex flex-col items-center">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>No data available</p>
            </div>
          </div>
        )}
        
        {/* Surge information display */}
        {surgeData.length > 0 && (
          <div className="mt-4 px-2 py-3 bg-red-900/20 border border-red-500/30 rounded-md">
            <div className="flex justify-between mb-2">
              <h4 className="text-sm font-medium text-red-400">Power Surge Detected</h4>
              <span className="text-xs text-gray-400">{surgeData.length} events</span>
            </div>
            <div className="text-xs text-gray-300">
              Latest: {surgeData[surgeData.length-1]?.power} W at {surgeData[surgeData.length-1]?.time}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-xs text-gray-400 flex items-center gap-2">
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 text-gray-400 hover:text-orange-500 hover:bg-transparent"
              onClick={handlePrev}
              title="Previous"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-gray-400 hover:text-orange-500 hover:bg-transparent"
              onClick={handlePauseToggle}
              title={isPaused ? "Resume" : "Pause"}
            >
              <PauseCircle className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0 text-gray-400 hover:text-orange-500 hover:bg-transparent"
              onClick={handleNext}
              title="Next"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          <span>
            {timeRangeLabel} • {data.length} points
            {refreshing && " • Loading..."}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          System Capacity: {capacityLabel}
        </div>
      </CardFooter>
    </Card>
  );
};
