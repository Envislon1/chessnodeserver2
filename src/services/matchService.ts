
import { Match, DatabaseMatch } from '@/types';
import { supabase } from "@/integrations/supabase/client";
import { checkGameStatus, pollChallengeUntilGame, extractGameIdFromUrl } from '@/utils/lichessUtils';

export const matchService = {
  getAllMatches: async (): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((match): Match => ({
      id: match.id,
      whitePlayerId: match.white_player_id,
      blackPlayerId: match.black_player_id,
      whiteUsername: match.white_username || 'Unknown',
      blackUsername: match.black_username || 'Unknown',
      stake: match.stake_amount,
      status: match.status as 'pending' | 'active' | 'completed' | 'cancelled',
      timeControl: match.time_control.toString(),
      gameMode: match.time_control <= 5 ? 'blitz' : 'rapid',
      lichessGameId: match.pgn,
      createdAt: match.created_at,
      updatedAt: match.updated_at,
      winner: match.winner_id,
      fee_accepted: match.fee_accepted,
      fee_amount: match.fee_amount
    }));
  },

  getUserMatches: async (userId: string): Promise<Match[]> => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`white_player_id.eq.${userId},black_player_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((match): Match => ({
      id: match.id,
      whitePlayerId: match.white_player_id,
      blackPlayerId: match.black_player_id,
      whiteUsername: match.white_username || 'Unknown',
      blackUsername: match.black_username || 'Unknown',
      stake: match.stake_amount,
      status: match.status as 'pending' | 'active' | 'completed' | 'cancelled',
      timeControl: match.time_control.toString(),
      gameMode: match.time_control <= 5 ? 'blitz' : 'rapid',
      lichessGameId: match.pgn,
      createdAt: match.created_at,
      updatedAt: match.updated_at,
      winner: match.winner_id,
      fee_accepted: match.fee_accepted,
      fee_amount: match.fee_amount
    }));
  },
  
  getMatch: async (matchId: string): Promise<Match | null> => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();
      
    if (error) return null;
    
    if (!data) return null;
    
    if ((data.status === 'pending' || data.status === 'active') && data.pgn) {
      try {
        console.log(`Auto-checking game status for match ${data.id} with pgn: ${data.pgn}`);
        const gameStatus = await checkGameStatus(data.pgn);
        
        if (gameStatus.exists) {
          if (gameStatus.type === 'game' && gameStatus.gameId && 
              data.pgn.includes('/challenge/') && !data.pgn.includes(gameStatus.gameId)) {
            console.log(`Challenge converted to game: ${gameStatus.gameId}, updating match`);
            await matchService.updateLichessGameId(data.id, gameStatus.gameId);
            data.pgn = gameStatus.gameId;
          }
          
          if (data.status === 'pending') {
            console.log(`Game exists and is active, updating match ${data.id} to active`);
            await matchService.updateMatchStatus(data.id, 'active');
            data.status = 'active';
          }
        }
      } catch (err) {
        console.error("Error checking game status:", err);
      }
    }
    
    return {
      id: data.id,
      whitePlayerId: data.white_player_id,
      blackPlayerId: data.black_player_id,
      whiteUsername: data.white_username || 'Unknown',
      blackUsername: data.black_username || 'Unknown',
      stake: data.stake_amount,
      status: data.status as 'pending' | 'active' | 'completed' | 'cancelled',
      timeControl: data.time_control.toString(),
      gameMode: data.time_control <= 5 ? 'blitz' : 'rapid',
      lichessGameId: data.pgn,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      winner: data.winner_id,
      fee_accepted: data.fee_accepted
    };
  },
  
  joinMatch: async (matchId: string, userId: string, username: string): Promise<boolean> => {
    try {
      console.log(`User ${userId} (${username}) is joining match ${matchId}`);
      
      const { data: match, error: fetchError } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();
        
      if (fetchError || !match) {
        console.error("Match not found for joining:", fetchError);
        return false;
      }
      
      if (match.status !== 'pending' || (match.white_player_id && match.black_player_id)) {
        console.error(`Cannot join match: status=${match.status}, white=${match.white_player_id}, black=${match.black_player_id}`);
        return false;
      }
      
      const updateData = match.white_player_id 
        ? { black_player_id: userId, black_username: username, status: 'active' }
        : { white_player_id: userId, white_username: username };
      
      console.log(`Updating match with data:`, updateData);
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);
        
      if (error) {
        console.error("Error updating match during join:", error);
        return false;
      }
      
      console.log(`Join successful for match ${matchId}`);
      
      if (!match.white_player_id || !match.black_player_id) {
        const { data: updatedMatch } = await supabase
          .from('matches')
          .select('white_player_id, black_player_id')
          .eq('id', matchId)
          .single();
        
        if (updatedMatch && updatedMatch.white_player_id && updatedMatch.black_player_id) {
          await matchService.updateMatchStatus(matchId, 'active');
          console.log(`Match ${matchId} now has both players, set to active`);
        }
      }
        
      return true;
    } catch (error) {
      console.error("Error joining match:", error);
      return false;
    }
  },
  
  cancelMatch: async (matchId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId)
        .eq('status', 'pending');
        
      return !error;
    } catch (error) {
      console.error("Error cancelling match:", error);
      return false;
    }
  },
  
  updateMatchStatus: async (matchId: string, status: string, winnerId?: string): Promise<boolean> => {
    try {
      console.log(`Updating match ${matchId} status to ${status}${winnerId ? ` with winner ${winnerId}` : ''}`);
      
      const updateData: { status: 'pending' | 'active' | 'completed' | 'cancelled'; winner_id?: string; completed_at?: string; updated_at: string } = { 
        status: status as 'pending' | 'active' | 'completed' | 'cancelled',
        updated_at: new Date().toISOString()
      };
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        if (winnerId) {
          updateData.winner_id = winnerId;
        }
      }
      
      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);
        
      if (error) {
        console.error("Error updating match status:", error);
        return false;
      }
      
      console.log(`Successfully updated match ${matchId} status to ${status}`);
      return true;
    } catch (error) {
      console.error("Error updating match status:", error);
      return false;
    }
  },
  
  refreshMatch: async (matchId: string): Promise<Match | null> => {
    return await matchService.getMatch(matchId);
  },
  
  updateLichessGameId: async (matchId: string, lichessGameId: string): Promise<boolean> => {
    try {
      const { data: match, error: fetchError } = await supabase
        .from('matches')
        .select('status, pgn')
        .eq('id', matchId)
        .single();
        
      if (fetchError || !match) {
        console.error("Match not found for update:", matchId);
        return false;
      }
      
      if (match.status !== 'pending' && match.status !== 'active') {
        console.error("Cannot update game ID for match with status:", match.status);
        return false;
      }
      
      let cleanGameId = lichessGameId;
      if (lichessGameId.includes('lichess.org')) {
        const extracted = extractGameIdFromUrl(lichessGameId);
        if (extracted) {
          cleanGameId = extracted;
        }
      }
      
      const isChallenge = lichessGameId.includes('/challenge/');
      let newStatus = match.status;
      
      if (match.pgn && match.pgn.includes('/challenge/') && !lichessGameId.includes('/challenge/')) {
        console.log(`Challenge converted to game: ${match.pgn} -> ${lichessGameId}`);
        newStatus = 'active';
      }
      
      if (!match.pgn && !isChallenge) {
        console.log(`New game ID set: ${lichessGameId}`);
        newStatus = 'active';
      }
      
      if (isChallenge && match.status === 'pending') {
        const { data: matchData } = await supabase
          .from('matches')
          .select('white_player_id, black_player_id')
          .eq('id', matchId)
          .single();
          
        if (matchData && matchData.white_player_id && matchData.black_player_id) {
          console.log(`Challenge set for match with both players: ${lichessGameId}`);
          newStatus = 'active';
        }
      }
      
      const finalGameId = isChallenge ? lichessGameId : cleanGameId;
      
      console.log(`Updating match ${matchId} with game ID: ${finalGameId}, status: ${newStatus}`);
      
      const { error } = await supabase
        .from('matches')
        .update({ 
          pgn: finalGameId,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);
        
      if (error) {
        console.error("Error updating Lichess game ID:", error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Exception updating Lichess game ID:", error);
      return false;
    }
  },
  
  isMatchAvailable: async (matchId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('status, white_player_id, black_player_id')
        .eq('id', matchId)
        .single();
        
      if (error || !data) return false;
      
      return data.status === 'pending' && (!data.white_player_id || !data.black_player_id);
    } catch (error) {
      console.error("Error checking match availability:", error);
      return false;
    }
  },
  
  activateChallenge: async (matchId: string, challengeUrl: string): Promise<boolean> => {
    try {
      if (!challengeUrl || !challengeUrl.includes('/challenge/')) {
        console.error("Invalid challenge URL:", challengeUrl);
        return false;
      }
      
      const challengeId = extractGameIdFromUrl(challengeUrl);
      if (!challengeId) {
        console.error("Could not extract challenge ID from URL:", challengeUrl);
        return false;
      }
      
      console.log(`Attempting to activate challenge ${challengeId} for match ${matchId}`);
      
      const gameId = await pollChallengeUntilGame(challengeId);
      if (gameId) {
        console.log(`Challenge ${challengeId} converted to game ${gameId}`);
        
        const updateSuccess = await matchService.updateLichessGameId(matchId, gameId);
        if (updateSuccess) {
          await matchService.updateMatchStatus(matchId, 'active');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error activating challenge:", error);
      return false;
    }
  }
};
