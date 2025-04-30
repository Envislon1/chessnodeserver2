
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const AddInverterSystem = ({ onSuccess }: { onSuccess: () => void }) => {
  const [systemId, setSystemId] = useState("");
  const [systemName, setSystemName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    getUserId();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to add a system",
        variant: "destructive",
      });
      return;
    }

    if (!systemId.trim() || !systemName.trim()) {
      toast({
        title: "Error",
        description: "System ID and System Name are required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Clean the system ID (remove any existing underscores at the start)
      const cleanSystemId = systemId.trim().replace(/^_+/, '');
      
      // Check for duplicates for the current user only, not globally
      const { data: existing, error: checkError } = await supabase
        .from('inverter_systems')
        .select('id')
        .eq('user_id', userId)
        .eq('system_id', cleanSystemId);

      if (checkError) throw checkError;
      if (existing && existing.length > 0) {
        toast({
          title: "Error",
          description: "You already added this Device ID.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Insert for this user, even if Device ID exists in other users
      const { error } = await supabase
        .from('inverter_systems')
        .insert({
          name: systemName.trim(),
          location: "Default Location",
          model: "Standard Model",
          user_id: userId,
          system_id: cleanSystemId, // Store without underscore in database
          firebase_id: "_" + cleanSystemId // This is the ID to use with Firebase (with underscore)
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Inverter system added successfully",
      });
      setSystemId("");
      setSystemName("");
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-black/40 border-orange-500/20">
      <CardHeader>
        <CardTitle className="text-white">Add New Inverter System</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="systemName" className="text-sm text-gray-300">System Name</label>
            <Input
              id="systemName"
              placeholder="Enter the system name"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              required
              className="bg-black/60 border-orange-500/30 text-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="systemId" className="text-sm text-gray-300">System ID</label>
            <Input
              id="systemId"
              placeholder="Enter the system ID"
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              required
              className="bg-black/60 border-orange-500/30 text-white"
            />
            <p className="text-xs text-gray-400">
              The system ID will be automatically prefixed with "_" when writing to the device database
            </p>
          </div>
          <Button 
            type="submit" 
            disabled={isSubmitting || !userId} 
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            Add System
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
