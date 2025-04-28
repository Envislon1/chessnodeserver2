
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types';
import { userService } from '@/services/userService';
import { lichessApi } from '@/services/lichessApi';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  getCurrentUser: () => Promise<User | null>;
  isLichessAuthenticated: boolean;
  connectToLichess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLichessAuthenticated, setIsLichessAuthenticated] = useState(false);
  const { toast } = useToast();

  const getCurrentUser = async () => {
    try {
      const currentUser = await userService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        
        // Check if there's already a Lichess token
        const hasLichessToken = lichessApi.getAuthToken();
        if (hasLichessToken) {
          console.log(`Detected existing Lichess token for ${currentUser.username}`);
          setIsLichessAuthenticated(true);
        }
      }
      return currentUser;
    } catch (error) {
      console.error('Failed to load user:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        await getCurrentUser();
      } catch (error) {
        console.error('Failed to load user:', error);
        setLoading(false);
      }
    };
    
    loadUser();
  }, []);

  const connectToLichess = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in before connecting to Lichess",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // In a real implementation, this would redirect to Lichess OAuth
      // For now, we're using mock authentication
      console.log(`Mock connecting to Lichess as ${user.username}`);
      await lichessApi.mockAuthenticate(user.username);
      setIsLichessAuthenticated(true);
      
      toast({
        title: "Demo mode activated",
        description: "Connected to Lichess in demo mode. In a production app, this would use real Lichess OAuth.",
      });
    } catch (err) {
      console.error("Failed to connect to Lichess:", err);
      toast({
        title: "Connection failed",
        description: "Could not connect to Lichess. Please try again.",
        variant: "destructive"
      });
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Ensure password is provided
      if (!password) {
        throw new Error("Password is required");
      }
      
      const user = await userService.login(email, password);
      setUser(user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide more specific error messages based on the error
      let errorMessage = "Invalid credentials";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === "invalid_credentials") {
        errorMessage = "Email or password is incorrect";
      } else if (error.code === "user-not-found" || error.code === "invalid-login-credentials") {
        errorMessage = "User not found or incorrect password";
      }
      
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await userService.logout();
      lichessApi.clearAuthToken();
      setUser(null);
      setIsLichessAuthenticated(false);
      toast({
        title: "Logged out",
        description: "You've been successfully logged out",
      });
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: "Logout failed",
        description: "An error occurred during logout",
        variant: "destructive",
      });
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      updateUser, 
      getCurrentUser, 
      isLichessAuthenticated, 
      connectToLichess
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
