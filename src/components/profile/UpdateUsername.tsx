
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const UpdateUsername = () => {
  const [newUsername, setNewUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, getCurrentUser } = useAuth();

  const handleUpdateUsername = async () => {
    if (!user || !newUsername.trim()) return;
    
    setIsLoading(true);
    try {
      // First check if username already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', newUsername.trim())
        .neq('id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (existingUser) {
        toast({
          title: "Username Update Failed",
          description: "Name already exists. Please try again",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Update username
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      await getCurrentUser();
      toast({
        title: "Username updated",
        description: "Your username has been successfully updated"
      });
      setNewUsername("");
    } catch (error) {
      console.error("Error updating username:", error);
      toast({
        title: "Username Update Failed",
        description: "Name already exists. Please try again",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-4 items-center">
      <Input
        placeholder="New username"
        value={newUsername}
        onChange={(e) => setNewUsername(e.target.value)}
        className="max-w-[200px]"
      />
      <Button 
        onClick={handleUpdateUsername} 
        disabled={isLoading || !newUsername.trim()}
      >
        Update Username
      </Button>
    </div>
  );
};
