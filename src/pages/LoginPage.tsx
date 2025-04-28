
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email",
        variant: "destructive",
      });
      return;
    }
    
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await login(email, password);
      navigate("/");
    } catch (error) {
      console.error("Login failed:", error);
      // Error toasts are now handled in the AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use window.location.origin to get the current base URL instead of hardcoding localhost:3000
      const redirectTo = `${window.location.origin}/auth/callback#type=recovery`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo,
      });
      
      if (error) {
        throw error;
      }
      
      setResetEmailSent(true);
      toast({
        title: "Password Reset Email Sent",
        description: "If an account exists with that email, you will receive instructions to reset your password.",
      });
    } catch (error: any) {
      console.error("Password reset failed:", error);
      toast({
        title: "Password Reset Failed",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md border-chess-brown/50 bg-chess-dark/90">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            {isForgotPassword ? "Reset Your Password" : "Login to Chess"}
            <span className="text-chess-accent">Stake</span>
          </CardTitle>
          <CardDescription className="text-center">
            {isForgotPassword 
              ? "Enter your email and we'll send you a link to reset your password"
              : "Enter your email and password to sign in to your account"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                {resetEmailSent ? (
                  <div className="p-4 border border-green-500/30 bg-green-500/10 rounded-md text-center">
                    <p className="text-sm">Password reset email sent! Check your inbox for instructions.</p>
                  </div>
                ) : (
                  <Button 
                    type="submit" 
                    className="w-full bg-chess-accent hover:bg-chess-accent/80 text-black"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                )}
                
                <Button 
                  type="button"
                  variant="link"
                  className="w-full text-chess-accent"
                  onClick={() => setIsForgotPassword(false)}
                  disabled={isLoading}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john.doe@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button 
                      type="button"
                      variant="link"
                      className="text-xs text-chess-accent p-0 h-auto"
                      onClick={() => setIsForgotPassword(true)}
                    >
                      Forgot your password?
                    </Button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-chess-accent hover:bg-chess-accent/80 text-black"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm">
            <span className="text-gray-400">Don't have an account? </span>
            <Link 
              to="/register"
              className="text-chess-accent hover:underline"
            >
              Sign up
            </Link>
          </div>
          <div className="text-center text-xs text-gray-400">
            <p>By logging in, you agree to our</p>
            <p>
              <a href="#" className="text-chess-accent hover:underline">Terms of Service</a>
              {" "}&{" "}
              <a href="#" className="text-chess-accent hover:underline">Privacy Policy</a>
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
