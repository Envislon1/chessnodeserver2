
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, RefreshCw, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface LichessEmbedProps {
  gameId: string;
  onLoad?: () => void;
  onRetry?: () => void;
}

export const LichessEmbed = ({ gameId, onLoad, onRetry }: LichessEmbedProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const { isLichessAuthenticated, connectToLichess } = useAuth();
  const [showDemoNotice, setShowDemoNotice] = useState(true);

  // Extract game ID from full URL if necessary
  const extractGameId = (input: string): string => {
    if (!input) return '';
    
    console.log("Extracting game ID from:", input);
    
    // Check if the input is a full URL
    if (input.includes('lichess.org')) {
      try {
        // Try to extract the game ID from URL
        const url = new URL(input);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          console.log("Extracted game ID from URL:", pathSegments[0]);
          return pathSegments[0];
        }
      } catch (e) {
        console.error("Failed to parse URL:", e);
      }
    }
    
    // If it's already a game ID or extraction failed, return the original input
    return input;
  };

  const cleanedGameId = extractGameId(gameId);

  useEffect(() => {
    console.log("LichessEmbed: Game ID changed to", gameId);
    console.log("Cleaned game ID:", cleanedGameId);
    
    // Reset loading state whenever gameId changes
    setLoading(true);
    setError(null);
    
    // If gameId is invalid or missing, don't attempt to load
    if (!gameId || gameId.trim() === '') {
      setError("Invalid Lichess game ID provided");
      setLoading(false);
      return;
    }
    
    // Create iframe URL with a unique timestamp to force refresh
    const timestamp = new Date().getTime();
    
    // Determine if this is a challenge or a game
    const isChallenge = gameId.includes('/challenge/');
    let url;
    
    if (isChallenge) {
      console.log("Loading challenge URL directly:", gameId);
      url = gameId;
    } else {
      url = `https://lichess.org/embed/${cleanedGameId}?theme=brown&bg=dark&t=${timestamp}`;
      console.log("Loading game embed URL:", url);
    }
    
    setIframeUrl(url);
    
    // Set a timeout to detect when iframe doesn't load properly
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log("Iframe loading timed out");
        setError("Game loading timed out. The game may not be ready yet or the ID may be incorrect.");
        setLoading(false);
      }
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [gameId, cleanedGameId, retryCount, loading]);

  const handleIframeLoad = () => {
    console.log("Lichess iframe loaded successfully for game:", gameId);
    setLoading(false);
    setError(null);
    
    if (onLoad) onLoad();
    
    toast({
      title: "Game loaded",
      description: "Your chess match is ready to play",
    });
  };

  const handleIframeError = () => {
    console.error("Failed to load Lichess iframe for game:", gameId);
    setLoading(false);
    setError("Could not load the game. Please verify the game ID or try opening it directly on Lichess.");
  };
  
  const handleRetry = () => {
    console.log("Retrying to load game:", gameId);
    setLoading(true);
    setError(null);
    setRetryCount(prev => prev + 1);
    
    if (onRetry) onRetry();
    
    toast({
      title: "Retrying",
      description: "Attempting to reload the game...",
    });
  };
  
  const openInNewTab = () => {
    let url;
    
    // Handle challenge URLs directly
    if (gameId.includes('lichess.org')) {
      url = gameId;
    } else {
      url = `https://lichess.org/${cleanedGameId}`;
    }
    
    console.log("Opening game in new tab:", url);
    window.open(url, '_blank', 'noopener,noreferrer');
    
    toast({
      title: "Opening game",
      description: "Lichess game opened in a new tab",
    });
  };

  // Handler for Lichess connection
  const handleConnectToLichess = async () => {
    await connectToLichess();
    handleRetry(); // Retry loading the game after connecting
  };

  // Determine if we should show a challenge message instead of embedding
  const isChallenge = gameId.includes('/challenge/');

  return (
    <div className="w-full aspect-square max-w-3xl mx-auto relative border border-chess-brown rounded-md overflow-hidden">
      {showDemoNotice && (
        <Alert className="absolute top-0 left-0 right-0 z-20 bg-chess-dark/95 border-chess-brown">
          <Info className="h-4 w-4 text-chess-accent" />
          <AlertTitle>Demo Mode Active</AlertTitle>
          <AlertDescription>
            <p className="mb-2">This app is running in demo mode using mock Lichess authentication.</p>
            <p className="mb-2">To build a production Lichess app, you would need to register with Lichess.org and implement OAuth 2.0.</p>
            <Button variant="outline" size="sm" onClick={() => setShowDemoNotice(false)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-chess-dark/90 z-10 rounded-md">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-chess-accent" />
            <span className="text-center">
              {isChallenge ? "Loading Lichess challenge..." : "Loading Lichess game..."}
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
            {!isLichessAuthenticated && (
              <Button 
                onClick={handleConnectToLichess}
                className="bg-chess-accent hover:bg-chess-accent/80 text-black"
              >
                Connect to Lichess (Demo Mode)
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleRetry}
              className="flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" /> Retry Loading
            </Button>
            
            <Button
              onClick={openInNewTab}
              variant="outline"
              className="mt-2"
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Open in Lichess
            </Button>
          </div>
        </div>
      )}
      
      {iframeUrl && !error && (
        isChallenge ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8">
            <h3 className="text-xl font-bold mb-4">Challenge Ready!</h3>
            <p className="text-center mb-6">
              Your challenge has been created on Lichess. Click below to open it in a new tab.
            </p>
            <Button
              onClick={openInNewTab}
              className="bg-chess-accent hover:bg-chess-accent/80 text-black"
            >
              <ExternalLink className="h-4 w-4 mr-2" /> Open Challenge
            </Button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`lichess-game-${cleanedGameId}-attempt-${retryCount}`}
            src={iframeUrl}
            width="100%" 
            height="100%"
            className="border-0 rounded-md"
            title="Lichess Game"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            allow="fullscreen"
            allowFullScreen
          />
        )
      )}
    </div>
  );
};
