import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

interface User {
  id: string;
  username: string;
  socketId: string;
}

interface GameState {
  board: any;
  currentTurn: 'white' | 'black';
  moveHistory: Array<{from: string, to: string}>;
  gameStatus: 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw';
  winner: string | null;
}

interface Match {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whiteUsername: string;
  blackUsername: string;
  stake: number;
  timeControl: string;
  gameMode: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  winner: string | null;
  gameState: GameState | null;
  createdAt: Date;
  updatedAt: Date;
}

class ChessMatchManager {
  private users: Map<string, User> = new Map();
  private matches: Map<string, Match> = new Map();
  private connections: Map<string, WebSocket> = new Map();

  constructor() {}

  // User management
  addUser(id: string, username: string, socketId: string, socket: WebSocket): void {
    this.users.set(id, { id, username, socketId });
    this.connections.set(socketId, socket);
    console.log(`Added user: ${username} (${id})`);
  }

  removeUser(socketId: string): void {
    let userId = "";
    for (const [id, user] of this.users.entries()) {
      if (user.socketId === socketId) {
        userId = id;
        break;
      }
    }
    
    if (userId) {
      const user = this.users.get(userId)!;
      console.log(`Removed user: ${user.username} (${userId})`);
      this.users.delete(userId);
    }
    
    this.connections.delete(socketId);
  }

  getUserBySocketId(socketId: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.socketId === socketId) {
        return user;
      }
    }
    return undefined;
  }
  
  getSocketByUserId(userId: string): WebSocket | undefined {
    const user = this.users.get(userId);
    if (user) {
      return this.connections.get(user.socketId);
    }
    return undefined;
  }

  // Match management
  createMatch(matchData: Partial<Match>): Match {
    const id = matchData.id || crypto.randomUUID();
    const now = new Date();
    
    const match: Match = {
      id,
      whitePlayerId: matchData.whitePlayerId || "",
      blackPlayerId: matchData.blackPlayerId || "",
      whiteUsername: matchData.whiteUsername || "",
      blackUsername: matchData.blackUsername || "",
      stake: matchData.stake || 0,
      timeControl: matchData.timeControl || "5",
      gameMode: matchData.gameMode || "standard",
      status: matchData.status || "pending",
      winner: null,
      gameState: null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.matches.set(id, match);
    console.log(`Created match: ${id}`);
    
    return match;
  }

  getMatch(id: string): Match | undefined {
    return this.matches.get(id);
  }

  updateMatch(id: string, updates: Partial<Match>): Match | undefined {
    const match = this.matches.get(id);
    if (!match) return undefined;
    
    const updatedMatch = { ...match, ...updates, updatedAt: new Date() };
    this.matches.set(id, updatedMatch);
    console.log(`Updated match: ${id}`);
    
    return updatedMatch;
  }

  joinMatch(matchId: string, userId: string, username: string): Match | undefined {
    const match = this.matches.get(matchId);
    if (!match) return undefined;
    
    // If white player spot is empty, assign to white
    if (!match.whitePlayerId) {
      match.whitePlayerId = userId;
      match.whiteUsername = username;
    } 
    // If black player spot is empty and user is not already white, assign to black
    else if (!match.blackPlayerId && match.whitePlayerId !== userId) {
      match.blackPlayerId = userId;
      match.blackUsername = username;
    } 
    // If user is already in the match, just return the match
    else if (match.whitePlayerId === userId || match.blackPlayerId === userId) {
      return match;
    }
    // Otherwise, can't join
    else {
      return undefined;
    }
    
    match.updatedAt = new Date();
    this.matches.set(matchId, match);
    console.log(`User ${username} joined match: ${matchId}`);
    
    return match;
  }

  startMatch(matchId: string): Match | undefined {
    const match = this.matches.get(matchId);
    if (!match) return undefined;
    
    // Check if both players are present
    if (!match.whitePlayerId || !match.blackPlayerId) {
      return undefined;
    }
    
    // Initialize the game state
    match.status = "active";
    match.gameState = this.createInitialGameState();
    match.updatedAt = new Date();
    
    this.matches.set(matchId, match);
    console.log(`Started match: ${matchId}`);
    
    return match;
  }

  makeMove(matchId: string, userId: string, move: { from: string, to: string }): Match | undefined {
    const match = this.matches.get(matchId);
    if (!match || !match.gameState) return undefined;
    
    // Check if it's the user's turn
    const isWhite = match.whitePlayerId === userId;
    const isBlack = match.blackPlayerId === userId;
    
    if (!isWhite && !isBlack) return undefined;
    
    const currentTurn = match.gameState.currentTurn;
    if ((currentTurn === 'white' && !isWhite) || (currentTurn === 'black' && !isBlack)) {
      return undefined;
    }
    
    // In a real implementation, we would validate and apply the chess move here
    // For now, we'll just update the basic state
    match.gameState.moveHistory.push(move);
    match.gameState.currentTurn = currentTurn === 'white' ? 'black' : 'white';
    
    // Simple game end simulation for testing
    if (match.gameState.moveHistory.length >= 10) {
      match.gameState.gameStatus = 'checkmate';
      match.gameState.winner = Math.random() > 0.5 ? 'white' : 'black';
      match.status = 'completed';
      match.winner = match.gameState.winner === 'white' ? match.whitePlayerId : match.blackPlayerId;
    }
    
    match.updatedAt = new Date();
    this.matches.set(matchId, match);
    console.log(`Move made in match ${matchId}: ${move.from} to ${move.to}`);
    
    return match;
  }

  getAllMatches(): Match[] {
    return Array.from(this.matches.values());
  }

  getUserMatches(userId: string): Match[] {
    return this.getAllMatches().filter(
      match => match.whitePlayerId === userId || match.blackPlayerId === userId
    );
  }

  getAvailableMatches(): Match[] {
    return this.getAllMatches().filter(
      match => match.status === 'pending' && (!match.whitePlayerId || !match.blackPlayerId)
    );
  }

  // Game state initialization
  private createInitialGameState(): GameState {
    // In a real implementation, this would create a proper chess board
    return {
      board: "initial chess board state",
      currentTurn: 'white',
      moveHistory: [],
      gameStatus: 'active',
      winner: null
    };
  }
  
  notifyMatchUpdate(match: Match): void {
    if (match.whitePlayerId) {
      const whiteSocket = this.getSocketByUserId(match.whitePlayerId);
      if (whiteSocket && whiteSocket.readyState === WebSocket.OPEN) {
        whiteSocket.send(JSON.stringify({
          type: 'matchUpdate',
          match
        }));
      }
    }
    
    if (match.blackPlayerId) {
      const blackSocket = this.getSocketByUserId(match.blackPlayerId);
      if (blackSocket && blackSocket.readyState === WebSocket.OPEN) {
        blackSocket.send(JSON.stringify({
          type: 'matchUpdate',
          match
        }));
      }
    }
  }
  
  notifyGameStateUpdate(matchId: string, gameState: any): void {
    const match = this.matches.get(matchId);
    if (!match) return;
    
    if (match.whitePlayerId) {
      const whiteSocket = this.getSocketByUserId(match.whitePlayerId);
      if (whiteSocket && whiteSocket.readyState === WebSocket.OPEN) {
        whiteSocket.send(JSON.stringify({
          type: 'gameStateUpdate',
          matchId,
          gameState
        }));
      }
    }
    
    if (match.blackPlayerId) {
      const blackSocket = this.getSocketByUserId(match.blackPlayerId);
      if (blackSocket && blackSocket.readyState === WebSocket.OPEN) {
        blackSocket.send(JSON.stringify({
          type: 'gameStateUpdate',
          matchId,
          gameState
        }));
      }
    }
  }
}

// Create match manager
const matchManager = new ChessMatchManager();

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("Socket Chess Server received request:", req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Check if it's a WebSocket request
  const upgradeHeader = req.headers.get('upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket request', { 
      status: 426,
      headers: { ...corsHeaders, 'Upgrade': 'WebSocket' }
    });
  }

  // Handle WebSocket connection
  try {
    console.log("Upgrading connection to WebSocket");
    const { socket, response } = Deno.upgradeWebSocket(req);
    const socketId = crypto.randomUUID();
    
    socket.onopen = () => {
      console.log(`WebSocket connection opened: ${socketId}`);
    };
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, requestId } = message;
        
        console.log(`Received message type: ${type}`);
        
        // Handle authentication
        if (type === 'auth') {
          const { userId, username } = message;
          if (!userId || !username) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Missing user credentials'
            }));
            return;
          }
          
          matchManager.addUser(userId, username, socketId, socket);
          socket.send(JSON.stringify({
            requestId,
            type: 'authSuccess',
            userId,
            username
          }));
        }
        
        // Handle create match
        else if (type === 'createMatch') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const match = matchManager.createMatch({
            ...message.matchData,
            whitePlayerId: user.id,
            whiteUsername: user.username,
          });
          
          socket.send(JSON.stringify({
            requestId,
            type: 'createMatchSuccess',
            success: true,
            match
          }));
        }
        
        // Handle join match
        else if (type === 'joinMatch') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const match = matchManager.joinMatch(message.matchId, user.id, user.username);
          if (!match) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Match not found or cannot be joined'
            }));
            return;
          }
          
          // Notify both players about the update
          matchManager.notifyMatchUpdate(match);
          
          // Also update the match in the database if both players are present
          if (match.whitePlayerId && match.blackPlayerId) {
            try {
              const { error } = await supabase
                .from('matches')
                .update({
                  blackPlayerId: match.blackPlayerId,
                  blackUsername: match.blackUsername,
                  status: 'active'
                })
                .eq('id', message.matchId);
              
              if (error) throw error;
            } catch (dbError) {
              console.error("Database update error:", dbError);
            }
          }
          
          socket.send(JSON.stringify({
            requestId,
            type: 'joinMatchSuccess',
            success: true,
            match
          }));
        }
        
        // Handle start match
        else if (type === 'startMatch') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const match = matchManager.getMatch(message.matchId);
          if (!match) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Match not found'
            }));
            return;
          }
          
          if (match.whitePlayerId !== user.id && match.blackPlayerId !== user.id) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not a player in this match'
            }));
            return;
          }
          
          const startedMatch = matchManager.startMatch(message.matchId);
          if (!startedMatch) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Failed to start match'
            }));
            return;
          }
          
          // Notify both players
          matchManager.notifyMatchUpdate(startedMatch);
          if (startedMatch.gameState) {
            matchManager.notifyGameStateUpdate(startedMatch.id, startedMatch.gameState);
          }
          
          socket.send(JSON.stringify({
            requestId,
            type: 'startMatchSuccess',
            success: true
          }));
        }
        
        // Handle make move
        else if (type === 'makeMove') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const match = matchManager.getMatch(message.matchId);
          if (!match) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Match not found'
            }));
            return;
          }
          
          if (match.whitePlayerId !== user.id && match.blackPlayerId !== user.id) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not a player in this match'
            }));
            return;
          }
          
          const updatedMatch = matchManager.makeMove(message.matchId, user.id, message.move);
          if (!updatedMatch) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Invalid move'
            }));
            return;
          }
          
          // Notify both players
          matchManager.notifyMatchUpdate(updatedMatch);
          if (updatedMatch.gameState) {
            matchManager.notifyGameStateUpdate(updatedMatch.id, updatedMatch.gameState);
          }
          
          // If game ended, update the database
          if (updatedMatch.status === 'completed') {
            try {
              const { error } = await supabase
                .from('matches')
                .update({
                  status: 'completed',
                  winner: updatedMatch.winner
                })
                .eq('id', message.matchId);
              
              if (error) console.error("Database update error:", error);
            } catch (dbError) {
              console.error("Database update error:", dbError);
            }
          }
          
          socket.send(JSON.stringify({
            requestId,
            type: 'makeMoveSuccess',
            success: true
          }));
        }
        
        // Handle get available matches
        else if (type === 'getAvailableMatches') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const matches = matchManager.getAvailableMatches();
          
          socket.send(JSON.stringify({
            requestId,
            type: 'getAvailableMatchesSuccess',
            success: true,
            matches
          }));
        }
        
        // Handle get user matches
        else if (type === 'getUserMatches') {
          const user = matchManager.getUserBySocketId(socketId);
          if (!user) {
            socket.send(JSON.stringify({
              requestId,
              type: 'error',
              error: 'Not authenticated'
            }));
            return;
          }
          
          const matches = matchManager.getUserMatches(user.id);
          
          socket.send(JSON.stringify({
            requestId,
            type: 'getUserMatchesSuccess',
            success: true,
            matches
          }));
        }
      } catch (error) {
        console.error("Error processing message:", error);
        socket.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }));
      }
    };
    
    socket.onclose = () => {
      console.log(`WebSocket connection closed: ${socketId}`);
      matchManager.removeUser(socketId);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error: ${error}`);
    };
    
    return response;
  } catch (error) {
    console.error("WebSocket server error:", error);
    return new Response("Internal Server Error", { 
      status: 500,
      headers: corsHeaders
    });
  }
});
