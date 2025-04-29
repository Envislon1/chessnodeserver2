
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/userService";
import { useSocketChess } from "@/hooks/useSocketChess";
import { calculateFee, calculateTotalWithFee } from "@/utils/feeCalculations";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const timeControls = [
  { value: "1", label: "1 min (Bullet)" },
  { value: "3", label: "3 min (Blitz)" },
  { value: "5", label: "5 min (Blitz)" },
  { value: "10", label: "10 min (Rapid)" },
  { value: "15", label: "15 min (Rapid)" },
  { value: "30", label: "30 min (Classical)" },
];

const stakeAmounts = [10, 20, 30, 40, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

const CreateMatchPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stake, setStake] = useState<number>(10);
  const [timeControl, setTimeControl] = useState<string>("5");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const { createMatch, connected, connecting, retry } = useSocketChess();
  const [connectionError, setConnectionError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    // Reset connection error when connection status changes
    if (connected) {
      setConnectionError(false);
    }
  }, [connected]);

  // Attempt to connect when page loads
  useEffect(() => {
    if (!connected && !connecting && retryCount === 0) {
      console.log("Auto-connecting to chess server on CreateMatchPage load");
      handleRetryConnection();
    }
  }, [connected, connecting]); // eslint-disable-line

  const handleRetryConnection = async () => {
    setRetryCount(prev => prev + 1);
    toast({
      title: "Connecting",
      description: "Attempting to connect to the chess server..."
    });
    
    console.log("CreateMatchPage: Manual connection attempt initiated");
    const success = await retry();
    
    if (success) {
      setConnectionError(false);
      toast({
        title: "Connected",
        description: "Successfully connected to the chess server"
      });
    } else {
      setConnectionError(true);
      toast({
        title: "Connection Failed",
        description: "Could not connect to the chess server. Please try again or check your network connection.",
        variant: "destructive"
      });
    }
  };

  const handleCreateMatch = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a match",
        variant: "destructive",
      });
      return;
    }

    const totalStake = calculateTotalWithFee(stake);
    if (totalStake > user.balance) {
      toast({
        title: "Insufficient balance",
        description: `You need ${totalStake} coins (${stake} stake + ${calculateFee(stake)} fee) to create this match`,
        variant: "destructive",
      });
      return;
    }

    if (!connected) {
      setConnectionError(true);
      toast({
        title: "Connection Required",
        description: "You must be connected to the chess server to create a match",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // First, create the match in our Supabase database
      const dbMatch = await userService.createMatch({
        whitePlayerId: user.id,
        blackPlayerId: "", // Will be filled when someone joins
        whiteUsername: user.username,
        blackUsername: "", // Will be filled when someone joins
        stake,
        fee_amount: calculateFee(stake),
        status: "pending",
        timeControl,
        gameMode: "standard", // Default to standard chess
      });

      // Now, create the same match in our socket server
      if (dbMatch) {
        const socketMatch = await createMatch({
          id: dbMatch.id,
          whitePlayerId: user.id,
          blackPlayerId: "",
          whiteUsername: user.username,
          blackUsername: "",
          stake,
          timeControl,
          gameMode: "standard",
          status: "pending",
        });

        if (socketMatch) {
          toast({
            title: "Match created",
            description: "Your match has been created successfully",
          });

          navigate(`/matches`);
        } else {
          // If socket match creation fails, we should delete the DB match
          await userService.cancelMatch(dbMatch.id);
          throw new Error("Failed to create match on the chess server");
        }
      }
    } catch (error) {
      console.error("Failed to create match:", error);
      toast({
        title: "Error",
        description: "Failed to create match. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card className="border-chess-brown/50 bg-chess-dark/90">
        <CardHeader>
          <CardTitle className="text-2xl">Create a Match</CardTitle>
          <CardDescription>
            Set up a new chess match with stakes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="stake">Stake Amount</Label>
              <div className="text-right">
                <span className="text-chess-accent font-mono">{stake} coins</span>
                <div className="text-xs text-gray-400">
                  (+{calculateFee(stake)} coins fee)
                </div>
              </div>
            </div>
            <Select value={stake.toString()} onValueChange={(value) => setStake(Number(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Select stake amount" />
              </SelectTrigger>
              <SelectContent>
                {stakeAmounts.map((amount) => (
                  <SelectItem key={amount} value={amount.toString()}>
                    {amount} coins
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              Your balance: <span className="text-chess-accent">{user?.balance} coins</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time-control">Time Control</Label>
            <Select value={timeControl} onValueChange={setTimeControl}>
              <SelectTrigger id="time-control">
                <SelectValue placeholder="Select time control" />
              </SelectTrigger>
              <SelectContent>
                {timeControls.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {!connected && (
            <Alert className="bg-yellow-500/10 border border-yellow-500/30 rounded-md">
              {connectionError ? (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle>Connection Failed</AlertTitle>
                  <AlertDescription className="text-sm text-yellow-500 flex flex-col space-y-2">
                    <p>Could not connect to the chess server. This might be due to:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Edge Function may not be deployed</li>
                      <li>Network connectivity problems</li>
                      <li>Server may be temporarily unavailable</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetryConnection}
                      className="mt-2 w-full sm:w-auto"
                    >
                      {connecting ? (
                        <span className="flex items-center">
                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          Connecting...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Connection
                        </span>
                      )}
                    </Button>
                  </AlertDescription>
                </>
              ) : (
                <p className="text-sm text-yellow-500 flex items-center">
                  {connecting ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Connecting to chess server...
                    </span>
                  ) : (
                    "Not connected to the chess server. You may need to refresh the page."
                  )}
                </p>
              )}
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate("/matches")}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateMatch} 
            disabled={isCreating || stake > user.balance || !connected}
            className="bg-chess-accent hover:bg-chess-accent/80 text-black"
          >
            {isCreating ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Creating...
              </span>
            ) : (
              "Create Match"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default CreateMatchPage;
