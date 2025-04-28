
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const EmailConfirmationPage = () => {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "password_reset">("loading");
  const [message, setMessage] = useState<string>("Processing your request...");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const processEmailConfirmation = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash;
        const query = new URLSearchParams(hashFragment.substring(1));
        const type = query.get("type");
        
        if (type === "recovery") {
          // This is a password reset confirmation
          setStatus("password_reset");
          setMessage("Please enter your new password below.");
          const token = query.get("access_token");
          if (token) {
            setAccessToken(token);
          } else {
            setStatus("error");
            setMessage("No access token found. Cannot reset password.");
          }
        } else if (type === "signup") {
          // This is an email confirmation for signup
          setStatus("success");
          setMessage("Your email has been confirmed. You can now log in to your account.");
        } else {
          // Check if we have an access_token which means email verification succeeded
          const accessToken = query.get("access_token");
          if (accessToken) {
            setStatus("success");
            setMessage("Authentication successful. You'll be redirected to the home page.");
            
            // Give the user time to read the message before redirect
            setTimeout(() => {
              navigate("/");
            }, 2000);
          } else {
            setStatus("error");
            setMessage("No valid authentication information found in the URL.");
          }
        }
      } catch (error) {
        console.error("Error processing email confirmation:", error);
        setStatus("error");
        setMessage("An error occurred while processing your request. Please try again.");
      }
    };

    processEmailConfirmation();
  }, [navigate, location]);

  const handlePasswordReset = async (data: z.infer<typeof passwordSchema>) => {
    if (!accessToken) {
      toast({
        title: "Error",
        description: "No access token available. Please try the password reset process again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) {
        throw error;
      }

      // Password updated successfully
      setStatus("success");
      setMessage("Your password has been updated successfully. You can now log in with your new password.");
      
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully.",
      });
      
      // After a delay, redirect to login
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (error: any) {
      console.error("Error updating password:", error);
      toast({
        title: "Password Update Failed",
        description: error.message || "An error occurred while updating your password. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md border-chess-brown/50 bg-chess-dark/90">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            {status === "password_reset" ? "Reset Your Password" : "Email Confirmation"}
          </CardTitle>
          <CardDescription className="text-center">
            {status === "loading" ? "Processing your request..." : message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 text-chess-accent animate-spin" />
              <p>Please wait while we process your request</p>
            </div>
          )}

          {status === "password_reset" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePasswordReset)} className="w-full space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter your new password" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Confirm your new password" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full bg-chess-accent hover:bg-chess-accent/80 text-black"
                >
                  Reset Password
                </Button>
              </form>
            </Form>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center">{message}</p>
              <Button 
                onClick={() => navigate("/login")} 
                className="bg-chess-accent hover:bg-chess-accent/80 text-black"
              >
                Go to Login
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-12 w-12 text-red-500" />
              <p className="text-center">{message}</p>
              <Button 
                onClick={() => navigate("/login")} 
                className="bg-chess-accent hover:bg-chess-accent/80 text-black"
              >
                Go to Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailConfirmationPage;
