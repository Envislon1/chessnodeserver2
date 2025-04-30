
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { findOrCreateSharedInverter } from "@/utils/inverterSharing";
import { Share2 } from "lucide-react";

interface AddSharedInverterProps {
  onSuccess: () => void;
}

export const AddSharedInverter = ({ onSuccess }: AddSharedInverterProps) => {
  const [systemId, setSystemId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!systemId.trim()) {
      toast({
        title: "System ID Required",
        description: "Please enter a valid system ID",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await findOrCreateSharedInverter(systemId.trim());
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message,
        });
        setSystemId("");
        onSuccess();
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to shared inverter",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-black/40 border border-orange-500/20 h-fit">
      <CardHeader>
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Share2 className="h-5 w-5 text-orange-500" />
          Connect to Shared Inverter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-300">
              Enter the System ID shared with you to connect to an existing inverter system.
            </p>
            <Input
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              placeholder="Enter System ID"
              className="bg-black/20 border-orange-500/20 text-white placeholder:text-gray-400"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isLoading ? "Connecting..." : "Connect to Shared Inverter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
