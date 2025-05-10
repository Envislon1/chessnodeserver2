
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WifiHigh, Upload, Lock, Unlock, Eye, EyeOff, Cloud, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  sendFirmwareUpdateToDevice, 
  subscribeToFirmwareUpdateStatus, 
  clearFirmwareUpdatePath 
} from "@/integrations/firebase/client";
import { Progress } from "@/components/ui/progress";

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

// Define a type for firmware update status
interface FirmwareUpdateStatus {
  progress?: number;
  status?: string;
  message?: string;
  error?: string;
  completed?: boolean;
}

export const FirmwareUpdateCard = ({ selectedSystemId, deviceIp }: FirmwareUpdateCardProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [firmwareUpdateStatus, setFirmwareUpdateStatus] = useState<FirmwareUpdateStatus | null>(null);
  const [deploymentInProgress, setDeploymentInProgress] = useState(false);
  const [shortUrl, setShortUrl] = useState<string>("");
  const [firmwareCode, setFirmwareCode] = useState<string>("");
  
  // Use the hardcoded device IP if none is provided from props
  const deviceAddress = deviceIp || "192.168.4.1";

  // Check if the current user is the owner of this system
  const [isOwner, setIsOwner] = useState(false);
  
  // Store system ID for Firebase communications
  const [systemDeviceId, setSystemDeviceId] = useState<string | null>(null);

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
        .select('user_id, system_id')
        .eq('id', selectedSystemId)
        .single();
        
      if (error) {
        console.error("Error checking system ownership:", error);
      } else if (data) {
        setIsOwner(data.user_id === session.user.id);
        setSystemDeviceId(data.system_id);
      }
    };
    
    checkOwnership();
  }, [selectedSystemId]);
  
  // Subscribe to firmware update status when device ID changes
  useEffect(() => {
    if (!systemDeviceId) return;
    
    const unsubscribe = subscribeToFirmwareUpdateStatus(systemDeviceId, (status) => {
      console.log("Received firmware update status:", status);
      
      if (!status) return;
      
      setFirmwareUpdateStatus(status);
      
      // If we received status with completed flag, device has finished the update
      if (status.completed === true) {
        if (status.status === 'success') {
          toast({
            title: "Firmware Update Successful",
            description: "Device has been updated successfully!",
          });
        } else if (status.error) {
          toast({
            title: "Firmware Update Failed",
            description: status.error || "Unknown error occurred",
            variant: "destructive"
          });
        }
        
        // Clear the update path after 2 successful status messages
        clearFirmwareUpdatePath(systemDeviceId);
        setDeploymentInProgress(false);
      }
    });
    
    return () => unsubscribe();
  }, [systemDeviceId]);

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
      const fileName = `fw_${selectedSystemId}_latest_${new Date().getTime()}.bin`;
      
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
      
      // Generate a shorter URL for display and hardware compatibility
      const shortenedUrl = urlData.signedUrl.split("?")[0];
      setShortUrl(shortenedUrl);
      
      // Generate a simple code for the firmware (last 6 characters of the filename)
      const code = fileName.substring(fileName.length - 10, fileName.length - 4);
      setFirmwareCode(code);
      
      // Store firmware metadata in the database
      const { error: dbError } = await supabase
        .from("inverter_firmware")
        .insert({
          inverter_id: selectedSystemId,
          firmware_version: "latest",
          firmware_url: urlData.signedUrl,
          status: "ready",
          file_name: fileName
        });
        
      if (dbError) throw dbError;
        
      toast({
        title: "Firmware uploaded",
        description: "The firmware is now ready for deployment",
      });
      
      setFile(null);
      
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
    if (isLocked) {
      toast({
        title: "Access locked",
        description: "Unlock firmware access first",
        variant: "destructive",
      });
      return;
    }
    
    if (!systemDeviceId) {
      toast({
        title: "System ID Missing",
        description: "Cannot find device identifier",
        variant: "destructive",
      });
      return;
    }
    
    if (deploymentInProgress) {
      toast({
        title: "Deployment in progress",
        description: "Please wait for the current deployment to complete",
        variant: "destructive"
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
      
      // Send firmware URL to device via Firebase
      const result = await sendFirmwareUpdateToDevice(systemDeviceId, firmwareData.firmware_url);
      
      if (result && result.shortUrl) {
        setShortUrl(result.shortUrl);
      }
      
      setDeploymentInProgress(true);
      setFirmwareUpdateStatus({
        status: 'initiated',
        progress: 0,
        message: 'Firmware update initiated. Waiting for device...'
      });
      
      toast({
        title: "OTA Update Initiated",
        description: "Firmware update command sent to device. Please wait for the device to complete the update.",
      });
      
    } catch (error: any) {
      toast({
        title: "Deployment failed",
        description: error.message || "Failed to deploy firmware",
        variant: "destructive",
      });
      setDeploymentInProgress(false);
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
              <label className="text-sm text-gray-300">
                Firmware File (.bin)
              </label>
              <Input
                id="firmware-file"
                type="file"
                accept=".bin"
                onChange={handleFileChange}
                className="bg-black/20 border-orange-500/20 text-white file:text-white file:bg-orange-500 file:border-none"
                disabled={deploymentInProgress}
              />
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                onClick={uploadFirmware}
                disabled={!file || uploading || deploymentInProgress}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Upload className="h-4 w-4 mr-1" />
                {uploading ? "Uploading..." : "Upload Firmware"}
              </Button>
              
              <Button
                onClick={deployToDevice}
                variant="outline"
                disabled={deploymentInProgress}
                className="text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <Cloud className="h-4 w-4 mr-1" />
                Deploy to Device
              </Button>
            </div>
            
            {/* Update Status information */}
            {deploymentInProgress && firmwareUpdateStatus && (
              <div className="bg-black/30 p-4 rounded-md mt-4">
                <h4 className="text-sm font-medium text-orange-400 mb-2">Update Status</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">
                      {firmwareUpdateStatus.status || 'Waiting for device...'}
                    </span>
                    {firmwareUpdateStatus.completed ? (
                      firmwareUpdateStatus.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )
                    ) : null}
                  </div>
                  
                  {firmwareUpdateStatus.progress !== undefined && (
                    <Progress 
                      value={firmwareUpdateStatus.progress} 
                      className="h-2 bg-gray-700"
                      indicatorClassName="bg-orange-500" 
                    />
                  )}
                  
                  {firmwareUpdateStatus.message && (
                    <p className="text-xs text-gray-400 mt-1">{firmwareUpdateStatus.message}</p>
                  )}
                  
                  {firmwareUpdateStatus.error && (
                    <p className="text-xs text-red-400 mt-1">{firmwareUpdateStatus.error}</p>
                  )}
                </div>
              </div>
            )}
            
            <p className="text-xs text-amber-500">
              Note: OTA requires your device to have internet connection and be configured to check for updates.
            </p>
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
                  <li>Connect to the device's WiFi network (named "PVT DEVICE")</li>
                  <li>Once connected, the update will automatically begin if the device has internet access</li>
                  <li>If manual update is needed, use the shortened URL below</li>
                  <li>The device will restart automatically after updating</li>
                </ol>
              </div>
              
              <div className="bg-black/40 p-4 rounded-md">
                <h4 className="font-medium text-orange-400 mb-2">Hardware-Compatible URL</h4>
                {shortUrl ? (
                  <div className="overflow-x-auto">
                    <p className="font-mono text-xs break-all bg-black/60 p-2 rounded text-orange-300">{shortUrl}</p>
                    {firmwareCode && (
                      <p className="font-mono mt-2 text-sm text-green-400">Firmware Code: {firmwareCode}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Upload firmware to generate a hardware-compatible URL</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  This URL is optimized for ESP32/ESP8266 devices with limited memory
                </p>
              </div>
              
              <div className="bg-black/40 p-4 rounded-md">
                <h4 className="font-medium text-orange-400 mb-2">ESP32/ESP8266 Code Example</h4>
                <pre className="text-xs bg-black p-2 rounded overflow-auto">
{`
// Add these to your existing code
#include <WiFiClientSecure.h>
#include <HTTPUpdate.h>

// Add this function to check for OTA updates
void checkForOTAUpdates() {
  if (Firebase.ready()) {
    // Check if update data exists
    FirebaseJson updateJson;
    if (Firebase.RTDB.getJSON(&fbdo, devicePath + "/update", &updateJson)) {
      String updateData = updateJson.raw();
      if (updateData != "null" && updateData.length() > 10) {
        Serial.println("Found OTA update data: " + updateData);
        
        // Parse the update JSON
        DynamicJsonDocument updateDoc(1024);
        deserializeJson(updateDoc, updateData);
        
        // Get the firmware URL
        String firmwareUrl = "";
        if (updateDoc.containsKey("short_url")) {
          firmwareUrl = updateDoc["short_url"].as<String>();
        } else if (updateDoc.containsKey("url")) {
          firmwareUrl = updateDoc["url"].as<String>();
        }
        
        if (firmwareUrl.length() > 5) {
          Serial.println("Starting OTA update from: " + firmwareUrl);
          
          // Send update status
          FirebaseJson statusJson;
          statusJson.set("status", "downloading");
          statusJson.set("progress", 10);
          statusJson.set("message", "Started firmware download");
          Firebase.RTDB.setJSON(&fbdo, devicePath + "/update_status", &statusJson);
          
          // Create WiFi client
          WiFiClientSecure client;
          client.setInsecure(); // Skip certificate verification
          
          // Configure HTTP update
          httpUpdate.setLedPin(LED_BUILTIN, LOW);
          
          // Try to update
          t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);
          
          // Check result
          switch (ret) {
            case HTTP_UPDATE_FAILED:
              Serial.printf("HTTP_UPDATE_FAILED Error (%d): %s\\n", 
                httpUpdate.getLastError(),
                httpUpdate.getLastErrorString().c_str());
                
              // Report error
              statusJson.set("status", "failed");
              statusJson.set("error", httpUpdate.getLastErrorString().c_str());
              statusJson.set("completed", true);
              Firebase.RTDB.setJSON(&fbdo, devicePath + "/update_status", &statusJson);
              break;
              
            case HTTP_UPDATE_NO_UPDATES:
              Serial.println("HTTP_UPDATE_NO_UPDATES");
              
              // Report no updates
              statusJson.set("status", "no_update");
              statusJson.set("message", "No updates available");
              statusJson.set("completed", true);
              Firebase.RTDB.setJSON(&fbdo, devicePath + "/update_status", &statusJson);
              break;
              
            case HTTP_UPDATE_OK:
              Serial.println("HTTP_UPDATE_OK");
              
              // Report success (device will restart after this)
              statusJson.set("status", "success");
              statusJson.set("message", "Update successful, restarting...");
              statusJson.set("completed", true);
              Firebase.RTDB.setJSON(&fbdo, devicePath + "/update_status", &statusJson);
              break;
          }
        }
      }
    }
  }
}

// Call this in setup() after Firebase.begin():
// checkForOTAUpdates();

// Call this in loop() every few minutes:
// static unsigned long lastOTACheck = 0;
// if (millis() - lastOTACheck > 60000) { // Check every minute
//   lastOTACheck = millis();
//   checkForOTAUpdates();
// }
`}
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
