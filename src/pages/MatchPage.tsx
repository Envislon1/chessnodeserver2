
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChessBoard } from "@/components/ChessBoard";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { matchService, socketChessService } from "@/services/matchServiceImport";
import { Match } from "@/types";
import { SocketChessEmbed } from "@/components/chess/SocketChessEmbed";
import { useSocketChess } from "@/hooks/useSocketChess";
import { 
  Loader2, ArrowLeft, Flag, Share2, RefreshCw
} from "lucide-react";

const MatchPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingGame, setRefreshingGame] = useState(false);
  const [gameStatus, setGameStatus] = useState<'preparing' | 'playing' | 'completed'>('preparing');
  const [startingGame, setStartingGame] = useState(false);
  const [creatingOpenChallenge, setCreatingOpenChallenge] = useState(false);
  const [joinedMatch, setJoinedMatch] = useState(false);
  const { connected, connect, createMatch, joinMatch } = useSocketChess();
  
  const fetchMatch = useCallback(async () => {
    if (!id) return;
    
    try {
      console.log(`Fetching match data for ID: ${id}`);
      setRefreshingGame(true);
      const fetchedMatch = await matchService.getMatch(id);
      
      if (fetchedMatch) {
        console.log(`Match data received:`, fetchedMatch);
        setMatch(fetchedMatch);
        
        if (fetchedMatch.status === 'active') {
          setGameStatus('playing');
        } else if (fetchedMatch.status === 'completed') {
          setGameStatus('completed');
        } else {
          setGameStatus('preparing');
        }
        
        const bothPlayersPresent = fetchedMatch.whitePlayerId && fetchedMatch.blackPlayerId;
        if (bothPlayersPresent && fetchedMatch.status === 'pending') {
          console.log('Both players present but match still pending, updating to active');
          await matchService.updateMatchStatus(fetchedMatch.id, 'active');
          const updatedMatch = await matchService.refreshMatch(id);
          if (updatedMatch) setMatch(updatedMatch);
        }
      } else {
        console.error(`Match with ID ${id} not found`);
      }
    } catch (error) {
      console.error("Error fetching match:", error);
      toast({
        title: "Error",
        description: "Could not load match details",
        variant: "destructive"
      });
    } finally {
      setRefreshingGame(false);
      setLoading(false);
    }
  }, [id, toast]);

  const joinMatchIfNeeded = useCallback(async () => {
    if (!id || !user || !match || joinedMatch) return;
    
    const isPlayerInMatch = match.whitePlayerId === user.id || match.blackPlayerId === user.id;
    if (isPlayerInMatch) return;
    
    const canJoin = !match.whitePlayerId || !match.blackPlayerId;
    if (!canJoin) return;
    
    try {
      console.log(`Attempting to join match ${id} as user ${user.id} (${user.username})`);
      const joined = await matchService.joinMatch(id, user.id, user.username);
      if (joined) {
        console.log('Successfully joined match');
        setJoinedMatch(true);
        toast({
          title: "Joined Match",
          description: "You've successfully joined this match",
        });
        fetchMatch();
        
        // Also join the socket chess room
        if (connected) {
          try {
            await joinMatch(id);
          } catch (error) {
            console.error("Error joining socket match:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error joining match:", error);
    }
  }, [id, user, match, joinedMatch, connected, toast, fetchMatch, joinMatch]);
  
  useEffect(() => {
    fetchMatch();
    
    const channel = supabase
      .channel('match-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'matches', 
          filter: `id=eq.${id}` 
        }, 
        (payload) => {
          console.log("Match updated via realtime:", payload);
          fetchMatch();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchMatch]);
  
  useEffect(() => {
    if (match && match.status === 'pending' && user && !joinedMatch) {
      joinMatchIfNeeded();
    }
  }, [match, user, joinMatchIfNeeded, joinedMatch]);
  
  const handleStartGame = async () => {
    if (!match || !user) return;
    
    try {
      setStartingGame(true);
      setRefreshingGame(true);
      
      if (!connected) {
        toast({
          title: "Connection Required",
          description: "You need to connect to the chess server before starting a game",
          variant: "default"
        });
        
        try {
          await connect();
        } catch (error) {
          console.error("Error connecting to chess server:", error);
          setRefreshingGame(false);
          setStartingGame(false);
          return;
        }
      }
      
      const updatedMatch = await matchService.refreshMatch(match.id);
      if (!updatedMatch) {
        throw new Error("Could not refresh match data");
      }
      
      // If the match is already active, just set the status
      if (updatedMatch.status === 'active') {
        setGameStatus('playing');
        setMatch(updatedMatch);
        setRefreshingGame(false);
        setStartingGame(false);
        return;
      }
      
      // Start the game via socket chess
      await socketChessService.startMatch(match.id);
      
      // Update the match status in the database
      await matchService.updateMatchStatus(match.id, 'active');
      
      // Refresh the match data
      const finalUpdatedMatch = await matchService.refreshMatch(match.id);
      if (finalUpdatedMatch) {
        setMatch(finalUpdatedMatch);
        setGameStatus('playing');
      }
      
      toast({
        title: "Game Started",
        description: "Your chess match has begun!",
      });
    } catch (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Error",
        description: "Could not start the game. Please try again.",
        variant: "destructive"
      });
      setGameStatus('preparing');
    } finally {
      setRefreshingGame(false);
      setStartingGame(false);
    }
  };

  const handleCreateOpenChallenge = async () => {
    if (!match || !connected) return;
    
    try {
      setCreatingOpenChallenge(true);
      
      // Create an open challenge via socket chess
      await createMatch({
        timeControl: match.timeControl,
        gameMode: match.gameMode,
        stake: match.stake,
        id: match.id
      });
      
      // Update the match status in the database
      await matchService.updateMatchStatus(match.id, 'active');
      
      // Refresh the match data
      const updatedMatch = await matchService.refreshMatch(match.id);
      if (updatedMatch) {
        setMatch(updatedMatch);
        setGameStatus('playing');
      }
      
      toast({
        title: "Challenge Created",
        description: "Open challenge created. Waiting for opponents to join.",
      });
    } catch (error) {
      console.error("Error creating open challenge:", error);
      toast({
        title: "Error",
        description: "Could not create challenge. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCreatingOpenChallenge(false);
    }
  };
  
  const handleGameLoad = () => {
    console.log("Game loaded successfully");
  };
  
  const refreshGame = async () => {
    if (!id) return;
    
    setRefreshingGame(true);
    try {
      const refreshedMatch = await matchService.refreshMatch(id);
      if (refreshedMatch) {
        setMatch(refreshedMatch);
        
        if (refreshedMatch.status === 'active') {
          setGameStatus('playing');
        } else if (refreshedMatch.status === 'completed') {
          setGameStatus('completed');
        }
      }
    } catch (error) {
      console.error("Error refreshing match:", error);
      toast({
        title: "Error",
        description: "Could not refresh the match. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRefreshingGame(false);
    }
  };
  
  const isUserInMatch = user && match && 
    (user.id === match.whitePlayerId || user.id === match.blackPlayerId);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-chess-accent" />
        <span className="ml-2 text-lg">Loading match...</span>
      </div>
    );
  }
  
  if (!match) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-500 mb-4">Match Not Found</h2>
        <p className="mb-8 text-gray-400">The match you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/matches")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Matches
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button 
        variant="outline" 
        onClick={() => navigate("/matches")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Matches
      </Button>
      
      <Card className="bg-chess-dark border-chess-brown/50">
        <CardHeader>
          <CardTitle className="text-2xl flex justify-between">
            <span>
              {match?.whiteUsername || 'Unknown'} vs {match?.blackUsername || 'Unknown'}
            </span>
            <span className="text-chess-accent">
              {match?.stake > 0 ? `${match.stake} coins` : 'Friendly Match'}
            </span>
          </CardTitle>
          
          {match && (
            <div className="flex space-x-2 text-sm text-gray-400">
              <span>{match.timeControl} min</span>
              <span>•</span>
              <span className="capitalize">{match.gameMode}</span>
              <span>•</span>
              <span className="capitalize">{match.status}</span>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <div className="flex flex-col items-center space-y-6">
            {match.status === 'active' ? (
              <SocketChessEmbed matchId={match.id} onLoad={handleGameLoad} onRetry={refreshGame} />
            ) : (
              <div className="w-full max-w-md">
                <ChessBoard />
              </div>
            )}
            
            {match.status === 'pending' && isUserInMatch && 
              match.blackPlayerId && match.whitePlayerId && (
              <div className="text-center space-y-4 w-full">
                <p className="text-gray-400">
                  Both players have joined. Start the game when you're ready.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button 
                    onClick={handleStartGame}
                    className="bg-chess-accent hover:bg-chess-accent/80 text-black"
                    disabled={startingGame || refreshingGame || creatingOpenChallenge || !connected}
                  >
                    {startingGame ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting game...
                      </>
                    ) : (
                      <>
                        <Flag className="mr-2 h-4 w-4" />
                        Start Direct Game
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    onClick={handleCreateOpenChallenge}
                    variant="outline"
                    disabled={startingGame || refreshingGame || creatingOpenChallenge || !connected}
                  >
                    {creatingOpenChallenge ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating challenge...
                      </>
                    ) : (
                      <>
                        <Share2 className="mr-2 h-4 w-4" />
                        Create Open Challenge
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {match.status === 'pending' && (!match.blackPlayerId || !match.whitePlayerId) && isUserInMatch && (
              <div className="text-center space-y-4 w-full">
                <p className="text-gray-400">
                  Waiting for an opponent to join the match.
                </p>
              </div>
            )}
            
            {match.status === 'active' && (
              <div className="text-center space-y-4 w-full">
                <div className="flex justify-center space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={refreshGame} 
                    disabled={refreshingGame}
                  >
                    {refreshingGame ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Game
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            {match.status === 'completed' && (
              <div className="text-center p-4 border border-chess-brown/50 rounded-md w-full">
                <h3 className="text-lg font-bold mb-2">Result</h3>
                {match.winner ? (
                  <p>
                    Winner: <span className="font-semibold text-chess-win">
                      {match.winner === match.whitePlayerId ? match.whiteUsername : match.blackUsername}
                    </span>
                  </p>
                ) : (
                  <p>The match ended in a draw.</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchPage;
