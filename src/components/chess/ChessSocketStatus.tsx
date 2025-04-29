
import { useState } from 'react';
import { useSocketChess } from '@/hooks/useSocketChess';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ChessSocketStatus() {
  const { connected, connecting, retry } = useSocketChess();
  const { toast } = useToast();
  const [reconnecting, setReconnecting] = useState(false);
  const serverUrl = import.meta.env.VITE_SOCKET_CHESS_SERVER_URL;

  const handleReconnect = async () => {
    setReconnecting(true);
    toast({
      title: "Reconnecting",
      description: "Attempting to connect to the chess server..."
    });
    
    try {
      console.log("Manual reconnection attempt initiated");
      const success = await retry();
      if (success) {
        toast({
          title: "Connected",
          description: "Successfully connected to the chess server"
        });
      } else {
        toast({
          title: "Connection Failed",
          description: "Could not connect to the chess server. Please try again or check console for details.",
          variant: "destructive"
        });
      }
    } finally {
      setReconnecting(false);
    }
  };

  return (
    <div className="flex items-center">
      <Button 
        variant={connected ? "ghost" : "outline"} 
        size="sm"
        className={connected ? "text-green-500" : "text-red-500"}
        onClick={handleReconnect}
        disabled={connecting || reconnecting}
      >
        {connecting || reconnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : connected ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span className="ml-2 text-xs">
          {connecting || reconnecting 
            ? "Connecting..." 
            : connected 
              ? "Connected" 
              : "Disconnected"}
        </span>
      </Button>
    </div>
  );
}
