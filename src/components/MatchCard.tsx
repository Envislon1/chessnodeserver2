import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Match } from "@/types";
import { ChessBoard } from "@/components/ChessBoard";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { lichessApi } from "@/services/lichessApi";
import { calculateFee, calculateTotalWithFee } from "@/utils/feeCalculations";

interface MatchCardProps {
  match: Match;
  onViewDetails?: (match: Match) => void;
  onJoinMatch?: (match: Match) => void;
  onCancelMatch?: (match: Match) => void;
}

export const MatchCard = ({ match, onViewDetails, onJoinMatch, onCancelMatch }: MatchCardProps) => {
  if (match.status === 'cancelled') {
    return null;
  }

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showFeeWarning, setShowFeeWarning] = useState(false);
  const [showLichessDialog, setShowLichessDialog] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const isUserInMatch = user && (match.whitePlayerId === user.id || match.blackPlayerId === user.id);
  const userIsWinner = user && match.winner === user.id;
  const userIsLoser = user && match.status === 'completed' && match.winner && match.winner !== user.id && isUserInMatch;
  
  const getStatusColor = () => {
    switch (match.status) {
      case 'active': return 'bg-blue-600';
      case 'completed': return 'bg-gray-600';
      case 'pending': return 'bg-amber-600';
      case 'cancelled': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const handleJoinWithFee = async () => {
    const totalCost = calculateTotalWithFee(match.stake);
    
    if (!user?.balance || totalCost > user.balance) {
      toast({
        title: "Insufficient Balance",
        description: `You need ${totalCost} coins (${match.stake} stake + ${calculateFee(match.stake)} fee) to join this match`,
        variant: "destructive"
      });
      return;
    }
    
    setIsJoining(true);
    try {
      if (onJoinMatch) {
        onJoinMatch(match);
      } else {
        navigate(`/match/${match.id}`);
      }
      toast({
        title: "Joining Match",
        description: "You're being connected to the match...",
      });
    } catch (error) {
      console.error("Error joining match:", error);
      toast({
        title: "Error",
        description: "Failed to join match. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handlePlayNow = () => {
    if (!lichessApi.isAuthenticated()) {
      setShowLichessDialog(true);
      return;
    }
    
    toast({
      title: "Opening Match",
      description: "Connecting to your game...",
    });
    navigate(`/match/${match.id}`);
  };

  const handleLichessConnect = async () => {
    try {
      if (user) {
        await lichessApi.mockAuthenticate(user.username);
        setShowLichessDialog(false);
        toast({
          title: "Connected to Lichess",
          description: "You've been connected to Lichess successfully",
        });
        
        navigate(`/match/${match.id}`);
      }
    } catch (error) {
      console.error('Error connecting to Lichess:', error);
      toast({
        title: "Connection Failed",
        description: "Could not connect to Lichess. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="overflow-hidden border-chess-brown/50 bg-chess-dark/90">
      <div className="relative">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <Badge variant="outline" className={`${getStatusColor()} text-white`}>
              {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
            </Badge>
            <div className="font-mono text-chess-accent font-bold">
              {match.stake} coins
            </div>
          </div>
          <CardTitle className="text-lg mt-2">
            {match.whiteUsername} vs {match.blackUsername || 'Waiting for opponent'}
          </CardTitle>
          <CardDescription>
            {match.timeControl} • {match.gameMode} • 
            {match.createdAt && ` ${formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })}`}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="aspect-square w-full max-w-[200px] mx-auto my-2">
            <ChessBoard simplified />
          </div>
          
          {match.status === 'completed' && match.winner && (
            <div className="mt-3 text-center">
              <span className="text-gray-400">Winner: </span>
              <span className={`font-semibold ${userIsWinner ? 'text-chess-win' : ''}`}>
                {match.winner === match.whitePlayerId ? match.whiteUsername : match.blackUsername}
              </span>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          {match.status === 'pending' && !isUserInMatch && (
            <>
              <Button 
                onClick={handleJoinWithFee} 
                className="w-full"
                disabled={isJoining}
              >
                {isJoining ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Joining...
                  </span>
                ) : (
                  `Join Match (${match.stake} coins + ${calculateFee(match.stake)} fee)`
                )}
              </Button>
              
              <Dialog open={showFeeWarning} onOpenChange={setShowFeeWarning}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transaction Fee</DialogTitle>
                    <DialogDescription>
                      This match has a 1% transaction fee of {calculateFee(match.stake)} coins.
                      Total amount: {match.stake + calculateFee(match.stake)} coins.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => setShowFeeWarning(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => {
                      setShowFeeWarning(false);
                      match.fee_accepted = true;
                      handleJoinWithFee();
                    }}>
                      Accept & Join
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          
          {match.status === 'pending' && isUserInMatch && (
            <div className="space-y-2 w-full">
              <Button disabled variant="outline" className="w-full">
                <span className="flex items-center">
                  <svg className="animate-pulse -ml-1 mr-2 h-4 w-4 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Waiting for opponent
                </span>
              </Button>
            </div>
          )}
          
          {match.status === 'active' && isUserInMatch && (
            <Button 
              className="w-full bg-chess-accent hover:bg-chess-accent/80 text-black"
              onClick={handlePlayNow}
            >
              Play Now
            </Button>
          )}
          
          {match.status !== 'pending' && onViewDetails && (
            <Button variant="outline" onClick={() => onViewDetails(match)} className="w-full">
              View Details
            </Button>
          )}
          
          {match.status !== 'pending' && !onViewDetails && (
            <Button 
              variant="outline" 
              onClick={() => navigate(`/match/${match.id}`)} 
              className="w-full"
            >
              View Match
            </Button>
          )}
          
          {userIsWinner && (
            <div className="absolute top-0 right-0 m-2 px-2 py-1 bg-chess-win text-white text-xs rounded-md">
              +{match.stake} coins
            </div>
          )}
          
          {userIsLoser && (
            <div className="absolute top-0 right-0 m-2 px-2 py-1 bg-chess-loss text-white text-xs rounded-md">
              -{match.stake} coins
            </div>
          )}
          
          {match.status === 'pending' && isUserInMatch && onCancelMatch && (
            <Button 
              variant="destructive" 
              onClick={() => onCancelMatch(match)} 
              className="w-full"
            >
              Cancel Match
            </Button>
          )}
        </CardFooter>
      </div>

      <Dialog open={showLichessDialog} onOpenChange={setShowLichessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect to Lichess</DialogTitle>
            <DialogDescription>
              To play this match, you need to connect to your Lichess account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col space-y-4">
            <Button onClick={handleLichessConnect}>
              Connect to Lichess
            </Button>
            <a 
              href="https://lichess.org/signup" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="w-full"
            >
              <Button variant="outline" className="w-full">
                Create a Lichess Account
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
