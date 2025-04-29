
import { useState } from 'react';
import { useSocketChess } from '@/hooks/useSocketChess';
import { Button } from '@/components/ui/button';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ConnectionStatus() {
  const { connected, connecting, retry } = useSocketChess();
  const { toast } = useToast();
  const [reconnecting, setReconnecting] = useState(false);
  const serverUrl = import.meta.env.VITE_SOCKET_CHESS_SERVER_URL;
  const isLocalServer = serverUrl.includes('localhost');

  const handleConnect = async () => {
    setReconnecting(true);
    toast({
      title: "Connecting...",
      description: `Attempting to connect to the ${isLocalServer ? 'local' : ''} chess server`
    });
    
    try {
      const success = await retry();
      if (success) {
        toast({
          title: "Connected",
          description: `Successfully connected to the ${isLocalServer ? 'local' : ''} chess server`
        });
      } else {
        toast({
          title: "Connection Failed",
          description: `Could not connect to the ${isLocalServer ? 'local' : ''} chess server. Please try again.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Connection error:", error);
    } finally {
      setReconnecting(false);
    }
  };

  if (connected) return null;

  return (
    <div className="w-full p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {connecting || reconnecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin text-yellow-500" />
          ) : (
            <WifiOff className="h-4 w-4 mr-2 text-yellow-500" />
          )}
          <span className="text-sm text-yellow-500">
            {connecting || reconnecting ? 
              `Connecting to ${isLocalServer ? 'local' : ''} chess server...` : 
              `Not connected to the ${isLocalServer ? 'local' : ''} chess server`
            }
          </span>
        </div>
        {!connecting && !reconnecting && (
          <Button variant="outline" size="sm" onClick={handleConnect} className="text-xs">
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
