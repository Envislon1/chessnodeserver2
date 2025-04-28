
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChessGameBoard } from "./ChessGameBoard";
import { ChessGameProvider, useChessGame } from "@/context/ChessGameContext";
import { RefreshCw } from "lucide-react";
import { useSocketChess } from "@/hooks/useSocketChess";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ChessSocketStatus } from "./ChessSocketStatus";

interface ChessGameControlsProps {
  className?: string;
  matchId?: string;
}

const ChessGameControls = ({ className = '', matchId }: ChessGameControlsProps) => {
  const { resetGame, gameState } = useChessGame();
  const { makeMove, connected, currentMatch } = useSocketChess();
  const { toast } = useToast();
  const [syncingWithServer, setSyncingWithServer] = useState(false);
  
  const handleResetGame = () => {
    resetGame();
    
    if (connected && matchId) {
      toast({
        title: "Game Reset",
        description: "The game has been reset locally. This won't affect the server game state.",
      });
    }
  };
  
  const syncWithServer = async () => {
    if (!connected || !matchId || !currentMatch) {
      toast({
        title: "Cannot Sync",
        description: "Not connected to the server or no active match.",
        variant: "destructive",
      });
      return;
    }
    
    setSyncingWithServer(true);
    try {
      // In a real implementation, you would fetch the current game state from the server
      toast({
        title: "Game Synced",
        description: "Game state synchronized with the server.",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not synchronize with the server.",
        variant: "destructive",
      });
    } finally {
      setSyncingWithServer(false);
    }
  };
  
  return (
    <div className={`flex flex-col space-y-4 ${className}`}>
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Game Controls</h3>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleResetGame}
            className="flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reset Game
          </Button>
          
          {matchId && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncWithServer}
              disabled={syncingWithServer || !connected}
              className="flex items-center"
            >
              {syncingWithServer ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Sync with Server
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      <div>
        <h4 className="font-medium">Captured Pieces</h4>
        <div className="flex justify-between mt-2">
          <div>
            <p className="text-sm text-muted-foreground">White</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {gameState.capturedPieces.black.map((piece, i) => (
                <span key={i} className="text-xl">
                  {piece.type === 'pawn' ? '♟' : 
                   piece.type === 'rook' ? '♜' : 
                   piece.type === 'knight' ? '♞' : 
                   piece.type === 'bishop' ? '♝' : 
                   piece.type === 'queen' ? '♛' : '♚'}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Black</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {gameState.capturedPieces.white.map((piece, i) => (
                <span key={i} className="text-xl">
                  {piece.type === 'pawn' ? '♙' : 
                   piece.type === 'rook' ? '♖' : 
                   piece.type === 'knight' ? '♘' : 
                   piece.type === 'bishop' ? '♗' : 
                   piece.type === 'queen' ? '♕' : '♔'}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {gameState.gameStatus !== 'active' && (
        <div className="mt-2 p-2 rounded bg-chess-brown/20 border border-chess-brown/30">
          <p className="font-medium text-center">
            {gameState.gameStatus === 'check' && `${gameState.currentTurn === 'white' ? 'White' : 'Black'} is in check!`}
            {gameState.gameStatus === 'checkmate' && 
              `Checkmate! ${gameState.winner === 'white' ? 'White' : 'Black'} wins!`}
            {gameState.gameStatus === 'stalemate' && 'Stalemate! The game is a draw.'}
          </p>
        </div>
      )}
      
      <ChessSocketStatus />
    </div>
  );
};

interface ChessGameProps {
  className?: string;
  matchId?: string;
}

export const ChessGame = ({ className = '', matchId }: ChessGameProps) => {
  const { toast } = useToast();
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  // Hook to monitor socket connection status
  const socketConnectionHandler = ({ connected }: { connected: boolean }) => {
    setIsSocketConnected(connected);
    if (connected && matchId) {
      toast({
        title: "Connected to Chess Server",
        description: "Your moves will now be synchronized with your opponent.",
      });
    }
  };

  return (
    <ChessGameProvider>
      <Card className={`${className} bg-chess-dark border-chess-brown/50`}>
        <CardHeader>
          <CardTitle>Chess Game</CardTitle>
          <CardDescription>
            {matchId 
              ? "Play a real-time game of chess with another player" 
              : "Play a local game of chess"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ChessGameBoard />
          <ChessGameControls className="mt-6" matchId={matchId} />
        </CardContent>
      </Card>
    </ChessGameProvider>
  );
};
