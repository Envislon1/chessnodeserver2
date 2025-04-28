
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSocketChess } from "@/hooks/useSocketChess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChessBoard } from "@/components/ChessBoard";

interface SocketChessEmbedProps {
  matchId: string;
  onLoad?: () => void;
  onRetry?: () => void;
}

export const SocketChessEmbed = ({ matchId, onLoad, onRetry }: SocketChessEmbedProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  const { connected, connecting, retry, socket, joinMatch } = useSocketChess();
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("SocketChessEmbed: Match ID changed to", matchId);
    
    // Reset loading state whenever matchId changes
    setLoading(true);
    setError(null);
    
    // If matchId is invalid or missing, don't attempt to load
    if (!matchId || matchId.trim() === '') {
      setError("Invalid match ID provided");
      setLoading(false);
      return;
    }

    if (!connected || !socket) {
      setError("Not connected to chess server. Please try reconnecting.");
      setLoading(false);
      return;
    }
    
    // Join the match via socket
    const handleJoin = async () => {
      try {
        const match = await joinMatch(matchId);
        if (match) {
          setLoading(false);
          setError(null);
          
          if (onLoad) onLoad();
          
          toast({
            title: "Game loaded",
            description: "Your chess match is ready to play",
          });
        } else {
          throw new Error("Could not join match");
        }
      } catch (error) {
        console.error("Failed to join match:", error);
        setLoading(false);
        setError("Could not join the match. Please try again.");
      }
    };
    
    handleJoin();
    
    // Set a timeout to detect when socket doesn't respond properly
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("Socket loading timed out");
        setError("Game loading timed out. Please check your connection and try again.");
        setLoading(false);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [matchId, retryCount, loading, connected, socket, joinMatch, toast, onLoad]);
  
  const handleRetry = async () => {
    console.log("Retrying to join match:", matchId);
    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    
    // First try to reconnect if not connected
    if (!connected) {
      const success = await retry();
      if (!success) {
        setError("Could not connect to the chess server. Please try again later.");
        setLoading(false);
        return;
      }
    }
    
    if (onRetry) onRetry();
    
    toast({
      title: "Retrying",
      description: "Attempting to rejoin the match...",
    });
  };

  return (
    <div className="w-full aspect-square max-w-3xl mx-auto relative border border-chess-brown rounded-md overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-chess-dark/90 z-10 rounded-md">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-chess-accent" />
            <span className="text-center">
              Loading chess game...
              <br />This may take a few moments
            </span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-chess-dark/90 z-10 p-4 text-center rounded-md">
          <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
          <p className="text-red-400 mb-4">{error}</p>
          <div className="flex flex-col space-y-2">
            {!connected && (
              <Alert className="bg-chess-brown/20 border-chess-brown">
                <WifiOff className="h-4 w-4 text-chess-accent" />
                <AlertTitle>Connection Error</AlertTitle>
                <AlertDescription>
                  Not connected to the chess server. Please check your internet connection.
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleRetry}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry Connection
            </Button>
          </div>
        </div>
      )}
      
      <div ref={boardRef} className="w-full h-full">
        {!loading && !error && (
          <ChessBoard matchId={matchId} />
        )}
      </div>
    </div>
  );
};
