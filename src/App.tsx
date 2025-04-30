
import React, { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Create a client
const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Simple check to log database access availability
    const checkDatabaseAccess = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/inverter_systems?limit=1`, {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_KEY || '',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}`
          }
        });
        
        if (response.ok) {
          console.log("Database access is available");
        } else {
          console.log("Database access is restricted - skipping migrations");
        }
      } catch (e) {
        console.log("Database access error:", e);
      }
    };
    
    checkDatabaseAccess();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
