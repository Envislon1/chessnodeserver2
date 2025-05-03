
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WifiHigh, Upload, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FirmwareUpdateCardProps {
  selectedSystemId: string;
  deviceIp?: string;
}

// Define a type for the firmware record to match our database schema
interface FirmwareRecord {
  id: string;
  inverter_id: string;
  firmware_version: string;
  firmware_url: string;
  file_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const FirmwareUpdateCard = ({ selectedSystemId, deviceIp }: FirmwareUpdateCardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Check if the current user is the owner of this system
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    // Get current user email for password verification
    const fetchUserEmail = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setEmail(session.user.email);
      }
    };
    
    fetchUserEmail();
    
    // Check if the current user is the owner of this system
    const checkOwnership = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !selectedSystemId) return;
      
      const { data, error } = await supabase
        .from('inverter_systems')
        .select('user_id')
        .eq('id', selectedSystemId)
        .single();
        
      if (error) {
        console.error("Error checking system ownership:", error);
      } else if (data) {
        setIsOwner(data.user_id === session.user.id);
      }
    };
    
    checkOwnership();
  }, [selectedSystemId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith(".bin")) {
      setFile(selectedFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a valid firmware file (.bin)",
        variant: "destructive",
      });
      setFile(null);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const unlockFirmwareUpdate = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Could not retrieve user email. Please try signing in again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Try to sign in with the current email and provided password to verify
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (error) {
        toast({
          title: "Invalid password",
          description: "The password you entered is incorrect",
          variant: "destructive",
        });
        return;
      }
      
      // Password is correct if no error
      setIsLocked(false);
      toast({
        title: "Firmware updates unlocked",
        description: "You now have access to update system firmware",
      });
      
    } catch (err) {
      toast({
        title: "Authentication error",
        description: "Failed to verify password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const uploadFirmware = async () => {
    if (!file || !selectedSystemId || isLocked) return;
    
    setUploading(true);
    
    try {
      // Upload to Supabase Storage
      const fileName = `firmware_${selectedSystemId}_v${firmwareVersion || "latest"}_${new Date().getTime()}.bin`;
      
      // Check if firmware bucket exists, if not create it
      const { data: buckets } = await supabase.storage.listBuckets();
      const firmwareBucket = buckets?.find(bucket => bucket.name === "firmware");
      
      if (!firmwareBucket) {
        await supabase.storage.createBucket("firmware", {
          public: false,
          fileSizeLimit: 5242880, // 5MB
        });
      }
      
      // Upload the firmware file
      const { error: uploadError } = await supabase.storage
        .from("firmware")
        .upload(fileName, file);
        
      if (uploadError) throw uploadError;
      
      // Get the URL for the firmware
      const { data: urlData } = await supabase.storage
        .from("firmware")
        .createSignedUrl(fileName, 3600 * 24); // 24 hours expiry
        
      if (!urlData) throw new Error("Failed to create signed URL");
      
      // Store firmware metadata in the database
      const { error: dbError } = await supabase
        .from("inverter_firmware")
        .insert({
          inverter_id: selectedSystemId,
          firmware_version: firmwareVersion || "latest",
          firmware_url: urlData.signedUrl,
          status: "ready",
          file_name: fileName
        });
        
      if (dbError) throw dbError;
        
      toast({
        title: "Firmware uploaded",
        description: "The firmware is now ready for installation",
      });
      
      setFile(null);
      setFirmwareVersion("");
      
      // Reset file input
      const fileInput = document.getElementById('firmware-file') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
    } catch (error: any) {
      console.error("Error uploading firmware:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload firmware",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };
  
  const deployToDevice = async () => {
    if (!deviceIp || isLocked) {
      toast({
        title: "Device IP not available or access locked",
        description: isLocked ? "Unlock firmware access first" : "Cannot deploy firmware without device IP address",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Get the latest firmware
      const { data: firmwareData, error: firmwareError } = await supabase
        .from("inverter_firmware")
        .select("*")
        .eq("inverter_id", selectedSystemId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
      if (firmwareError || !firmwareData) {
        throw new Error("No firmware available for this device");
      }
      
      // Now we trigger the OTA update by sending the firmware URL to the device
      const deviceUrl = `http://${deviceIp}/update`;
      
      toast({
        title: "Deploying firmware",
        description: `Sending update to device at ${deviceIp}...`,
      });
      
      // In a production app, you would send this request from a server-side function
      // For now, we'll show the user how it would work
      setShowInstructions(true);
    } catch (error: any) {
      toast({
        title: "Deployment failed",
        description: error.message || "Failed to deploy firmware",
        variant: "destructive",
      });
    }
  };

  // If not the system owner, don't show the firmware card at all
  if (!isOwner) {
    return null;
  }

  return (
    <Card className="bg-black/40 border border-orange-500/20">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <WifiHigh className="h-5 w-5 text-orange-500" />
          Firmware Updates
          {isLocked && <Lock className="h-4 w-4 text-orange-500 ml-2" />}
          {!isLocked && <Unlock className="h-4 w-4 text-green-500 ml-2" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLocked ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Firmware updates are protected. Enter your account password to continue.
            </p>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                  className="bg-black/20 border-orange-500/20 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <Button 
                onClick={unlockFirmwareUpdate}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Unlock className="h-4 w-4 mr-1" />
                Unlock
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Firmware Version</label>
              <Input
                placeholder="e.g. 1.0.0"
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                className="bg-black/20 border-orange-500/20 text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-gray-300">
                Firmware File (.bin)
              </label>
              <Input
                id="firmware-file"
                type="file"
                accept=".bin"
                onChange={handleFileChange}
                className="bg-black/20 border-orange-500/20 text-white file:text-white file:bg-orange-500 file:border-none"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={uploadFirmware}
                disabled={!file || uploading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? "Uploading..." : "Upload Firmware"}
              </Button>
              
              <Button
                onClick={deployToDevice}
                disabled={!deviceIp}
                variant="outline"
                className="text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <WifiHigh className="h-4 w-4 mr-1" />
                Deploy to Device
              </Button>
            </div>
            
            {!deviceIp && (
              <p className="text-xs text-amber-500">
                Note: Device IP address is required for direct deployment.
                Make sure your device is connected to the local network.
              </p>
            )}
          </div>
        )}
        
        <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
          <DialogContent className="bg-gray-900 text-white border border-orange-500/20">
            <DialogHeader>
              <DialogTitle>OTA Update Instructions</DialogTitle>
              <DialogDescription className="text-gray-300">
                Follow these steps to update your device firmware
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="bg-black/40 p-4 rounded-md">
                <h4 className="font-medium text-orange-400 mb-2">On Your Hardware Device</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Ensure your device is in AP mode (or connected to your WiFi)</li>
                  <li>Navigate to the device's IP address ({deviceIp || "your-device-ip"}) in a web browser</li>
                  <li>Go to the "/update" endpoint (http://{deviceIp || "your-device-ip"}/update)</li>
                  <li>The device will present an update form</li>
                  <li>Click "Choose File" and select the .bin firmware file</li>
                  <li>Click "Update" to begin the OTA process</li>
                  <li>Wait for the update to complete (do not power off the device)</li>
                  <li>The device will restart automatically after updating</li>
                </ol>
              </div>
              
              <div className="bg-black/40 p-4 rounded-md">
                <h4 className="font-medium text-orange-400 mb-2">ESP8266/ESP32 Code Requirements</h4>
                <pre className="text-xs bg-black p-2 rounded overflow-auto">
{`
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPUpdateServer.h>
#include <WiFiManager.h>

ESP8266WebServer server(80);
ESP8266HTTPUpdateServer httpUpdater;

void setup() {
  Serial.begin(115200);
  
  // WiFiManager setup
  WiFiManager wifiManager;
  wifiManager.autoConnect("YourDeviceAP");
  
  // OTA Update server setup
  httpUpdater.setup(&server);
  server.begin();
  
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  server.handleClient();
}`}
                </pre>
              </div>
              
              <Button 
                onClick={() => setShowInstructions(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                Close Instructions
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

