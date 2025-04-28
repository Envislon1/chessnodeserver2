
import { useState, useEffect, useCallback } from 'react';
import { socketChessService } from '@/services/socketChessService';
import { useAuth } from '@/context/AuthContext';
import { Match } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useSocketChess() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [gameState, setGameState] = useState<any | null>(null);

  const connect = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "You must be logged in to connect to the chess server",
        variant: "destructive",
      });
      return false;
    }
    
    setConnecting(true);
    setConnectionAttempts(prev => prev + 1);
    
    try {
      const success = await socketChessService.connect(user.id, user.username);
      setConnected(success);
      
      if (!success) {
        // Only show toast if we've exceeded retry attempts
        if (connectionAttempts >= 2) {
          toast({
            title: "Connection Failed",
            description: "Could not connect to the chess server. Please try again.",
            variant: "destructive",
          });
        }
      }
      
      return success;
    } catch (error) {
      console.error("WebSocket connection error:", error);
      // Only show toast if we've exceeded retry attempts
      if (connectionAttempts >= 2) {
        toast({
          title: "Connection Error",
          description: "An error occurred while connecting to the chess server",
          variant: "destructive",
        });
      }
      return false;
    } finally {
      setConnecting(false);
    }
  }, [user, toast, connectionAttempts]);

  const retry = useCallback(async () => {
    setConnectionAttempts(0);
    return connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    socketChessService.disconnect();
    setConnected(false);
    setCurrentMatch(null);
    setGameState(null);
    setConnectionAttempts(0);
  }, []);

  // Monitor connection status
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = socketChessService.isConnected();
      if (connected !== isConnected) {
        setConnected(isConnected);
      }
    };
    
    // Check immediately
    checkConnection();
    
    // Set up interval to check connection status
    const intervalId = setInterval(checkConnection, 5000);
    
    return () => clearInterval(intervalId);
  }, [connected]);

  useEffect(() => {
    // Auto-connect when a user is available, but limit connection attempts
    if (user && !connected && !connecting && connectionAttempts < 3) {
      // Add slight delay between connection attempts
      const timer = setTimeout(() => {
        connect();
      }, connectionAttempts * 1000); // Exponential backoff: 0s, 1s, 2s
      
      return () => clearTimeout(timer);
    }
    
    return () => {};
  }, [user, connected, connecting, connectionAttempts, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Match related functions
  const createMatch = useCallback(async (matchData: Partial<Match>) => {
    try {
      if (!connected) {
        const connectionSuccess = await connect();
        if (!connectionSuccess) return null;
      }
      
      const match = await socketChessService.createMatch(matchData);
      setCurrentMatch(match);
      return match;
    } catch (error) {
      console.error("Error creating match:", error);
      toast({
        title: "Match Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create match",
        variant: "destructive",
      });
      return null;
    }
  }, [connected, connect, toast]);

  const joinMatch = useCallback(async (matchId: string) => {
    try {
      if (!connected) {
        const connectionSuccess = await connect();
        if (!connectionSuccess) return null;
      }
      
      const match = await socketChessService.joinMatch(matchId);
      setCurrentMatch(match);
      
      // Set up listeners for this match
      socketChessService.onMatchUpdate(matchId, (updatedMatch) => {
        setCurrentMatch(updatedMatch);
      });
      
      socketChessService.onGameStateUpdate(matchId, (updatedGameState) => {
        setGameState(updatedGameState);
      });
      
      return match;
    } catch (error) {
      console.error("Error joining match:", error);
      toast({
        title: "Failed to Join Match",
        description: error instanceof Error ? error.message : "Could not join match",
        variant: "destructive",
      });
      return null;
    }
  }, [connected, connect, toast]);

  const startMatch = useCallback(async (matchId: string) => {
    try {
      if (!connected) {
        const connectionSuccess = await connect();
        if (!connectionSuccess) return false;
      }
      
      return await socketChessService.startMatch(matchId);
    } catch (error) {
      console.error("Error starting match:", error);
      toast({
        title: "Failed to Start Match",
        description: error instanceof Error ? error.message : "Could not start match",
        variant: "destructive",
      });
      return false;
    }
  }, [connected, connect, toast]);

  const makeMove = useCallback(async (matchId: string, move: { from: string, to: string }) => {
    try {
      if (!connected) {
        toast({
          title: "Not Connected",
          description: "You must be connected to the chess server to make moves",
          variant: "destructive",
        });
        return false;
      }
      
      return await socketChessService.makeMove(matchId, move);
    } catch (error) {
      console.error("Error making move:", error);
      toast({
        title: "Failed to Make Move",
        description: error instanceof Error ? error.message : "Could not make move",
        variant: "destructive",
      });
      return false;
    }
  }, [connected, toast]);

  return {
    connected,
    connecting,
    connect,
    retry,
    disconnect,
    createMatch,
    joinMatch,
    startMatch,
    makeMove,
    currentMatch,
    gameState,
    socket: socketChessService.getSocket(),
  };
}
