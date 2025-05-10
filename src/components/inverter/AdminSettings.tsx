
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FirebaseConfigForm } from "@/components/inverter/FirebaseConfigForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AdminSettingsProps {
  className?: string;
}

interface AdminSettingsData {
  firebase_url: string;
  firebase_api_key: string;
  is_valid: boolean;
}

export function AdminSettings({ className }: AdminSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AdminSettingsData | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        
        // Use the RPC function to get admin settings (RLS compliant)
        const { data: adminSettings, error: settingsError } = await supabase
          .rpc('get_admin_settings');
        
        if (settingsError) {
          console.error("Error fetching admin settings:", settingsError);
          toast({
            title: "Error",
            description: "Could not load admin settings",
            variant: "destructive",
          });
          setSettings(null);
        } else if (adminSettings && adminSettings.length > 0) {
          setSettings({
            firebase_url: adminSettings[0].firebase_url,
            firebase_api_key: adminSettings[0].firebase_api_key,
            is_valid: true
          });
        }
      } catch (error) {
        console.error("Exception fetching settings:", error);
        setSettings(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return (
    <Card className={`bg-black/40 border border-orange-500/20 rounded-lg ${className}`}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-white">
          Admin Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            <div className="mb-6 text-sm text-gray-300">
              {settings && settings.is_valid ? (
                <div className="p-3 bg-green-500/20 border border-green-500/40 rounded">
                  <p>Current Firebase URL: {settings.firebase_url}</p>
                  <p>Current Firebase API Key: {settings.firebase_api_key}</p>
                </div>
              ) : (
                <div className="p-3 bg-orange-500/20 border border-orange-500/40 rounded">
                  <p>No Firebase configuration found. Please set up your Firebase configuration.</p>
                </div>
              )}
            </div>
            <FirebaseConfigForm />
          </>
        )}
      </CardContent>
    </Card>
  );
}
