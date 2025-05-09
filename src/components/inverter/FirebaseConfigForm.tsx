
import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { useFirebaseConfig } from "@/context/FirebaseConfigContext";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  password: z.string().min(1, "Password is required"),
  apiKey: z.string().min(1, "API Key is required"),
  databaseURL: z.string().min(1, "Database URL is required"),
});

export const FirebaseConfigForm = () => {
  const { config, updateConfig, verifyPassword } = useFirebaseConfig();
  const [isUnlocked, setIsUnlocked] = useState(false);

  const passwordForm = useForm({
    resolver: zodResolver(z.object({ password: z.string() })),
    defaultValues: {
      password: "",
    },
  });

  const configForm = useForm({
    resolver: zodResolver(z.object({
      apiKey: z.string(),
      databaseURL: z.string(),
    })),
    defaultValues: {
      apiKey: config.apiKey,
      databaseURL: config.databaseURL,
    },
  });

  const onUnlock = (data: { password: string }) => {
    if (verifyPassword(data.password)) {
      setIsUnlocked(true);
      toast({
        title: "Success",
        description: "Admin access granted",
      });
    } else {
      toast({
        title: "Access Denied",
        description: "Incorrect password",
        variant: "destructive",
      });
    }
  };

  const onSubmitConfig = (data: { apiKey: string, databaseURL: string }) => {
    updateConfig({
      apiKey: data.apiKey,
      databaseURL: data.databaseURL,
    });
  };

  return (
    <Card className="p-4 bg-black/40 border border-orange-500/20 rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-white flex items-center">
          <Lock className="h-4 w-4 mr-2" />
          Firebase Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isUnlocked ? (
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUnlock)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Admin Password</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="password" 
                        placeholder="Enter admin password" 
                        className="bg-black/60 text-white border-orange-500/30"
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Unlock Settings
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...configForm}>
            <form onSubmit={configForm.handleSubmit(onSubmitConfig)} className="space-y-4">
              <FormField
                control={configForm.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Firebase API Key</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter Firebase API Key" 
                        className="bg-black/60 text-white border-orange-500/30"
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={configForm.control}
                name="databaseURL"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Firebase Database URL</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter Firebase Database URL" 
                        className="bg-black/60 text-white border-orange-500/30"
                      />
                    </FormControl>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between">
                <Button 
                  type="submit" 
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Save Configuration
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline"
                  className="border-orange-500/30 text-orange-500 hover:bg-orange-500/20"
                  onClick={() => setIsUnlocked(false)}
                >
                  Lock Settings
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
      <CardFooter className="pt-2 px-0 text-xs text-gray-400">
        Changes will require a page reload to take effect
      </CardFooter>
    </Card>
  );
};
