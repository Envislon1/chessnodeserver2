import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";

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

  constructor() {}

  // User management
  addUser(id: string, username: string, socketId: string): void {
    this.users.set(id, { id, username, socketId });
    console.log(`Added user: ${username} (${id})`);
  }

  removeUser(id: string): void {
    if (this.users.has(id)) {
      const user = this.users.get(id)!;
      console.log(`Removed user: ${user.username} (${id})`);
      this.users.delete(id);
    }
  }

  getUserBySocketId(socketId: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.socketId === socketId) {
        return user;
      }
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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Create a Socket.IO server
    const socketServer = new Server({
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    const matchManager = new ChessMatchManager();

    socketServer.on("connection", (socket) => {
      const { userId, username } = socket.handshake.auth;
      
      if (!userId || !username) {
        console.log("Connection rejected: missing user data");
        socket.disconnect();
        return;
      }
      
      console.log(`User connected: ${username} (${userId})`);
      matchManager.addUser(userId, username, socket.id);

      // Match creation
      socket.on("createMatch", (matchData, callback) => {
        try {
          const match = matchManager.createMatch({
            ...matchData,
            whitePlayerId: userId,
            whiteUsername: username,
          });
          
          // Emit an event to all connected clients about the new match
          socketServer.emit("matchCreated", match);
          
          if (callback) callback({ success: true, match });
        } catch (error) {
          console.error("Error creating match:", error);
          if (callback) callback({ success: false, error: "Failed to create match" });
        }
      });

      // Join match
      socket.on("joinMatch", async ({ matchId }, callback) => {
        try {
          const match = matchManager.joinMatch(matchId, userId, username);
          
          if (!match) {
            if (callback) callback({ success: false, error: "Match not found or cannot be joined" });
            return;
          }
          
          // Join the socket room for this match
          socket.join(matchId);
          
          // Emit an event to all users in the match
          socketServer.to(matchId).emit("matchUpdate", match);
          
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
                .eq('id', matchId);
              
              if (error) throw error;
            } catch (dbError) {
              console.error("Database update error:", dbError);
            }
          }
          
          if (callback) callback({ success: true, match });
        } catch (error) {
          console.error("Error joining match:", error);
          if (callback) callback({ success: false, error: "Failed to join match" });
        }
      });

      // Start match
      socket.on("startMatch", ({ matchId }, callback) => {
        try {
          const match = matchManager.getMatch(matchId);
          
          if (!match) {
            if (callback) callback({ success: false, error: "Match not found" });
            return;
          }
          
          if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) {
            if (callback) callback({ success: false, error: "Not a player in this match" });
            return;
          }
          
          const startedMatch = matchManager.startMatch(matchId);
          
          if (!startedMatch) {
            if (callback) callback({ success: false, error: "Failed to start match" });
            return;
          }
          
          // Emit game state to both players
          socketServer.to(matchId).emit("matchUpdate", startedMatch);
          socketServer.to(matchId).emit("gameStateUpdate", { 
            matchId, 
            gameState: startedMatch.gameState 
          });
          
          if (callback) callback({ success: true });
        } catch (error) {
          console.error("Error starting match:", error);
          if (callback) callback({ success: false, error: "Failed to start match" });
        }
      });

      // Make move
      socket.on("makeMove", ({ matchId, move }, callback) => {
        try {
          const match = matchManager.getMatch(matchId);
          
          if (!match) {
            if (callback) callback({ success: false, error: "Match not found" });
            return;
          }
          
          if (match.whitePlayerId !== userId && match.blackPlayerId !== userId) {
            if (callback) callback({ success: false, error: "Not a player in this match" });
            return;
          }
          
          const updatedMatch = matchManager.makeMove(matchId, userId, move);
          
          if (!updatedMatch) {
            if (callback) callback({ success: false, error: "Invalid move" });
            return;
          }
          
          // Emit updated state to both players
          socketServer.to(matchId).emit("matchUpdate", updatedMatch);
          socketServer.to(matchId).emit("gameStateUpdate", { 
            matchId, 
            gameState: updatedMatch.gameState 
          });
          
          // If game ended, update the database
          if (updatedMatch.status === 'completed') {
            try {
              supabase
                .from('matches')
                .update({
                  status: 'completed',
                  winner: updatedMatch.winner
                })
                .eq('id', matchId)
                .then(({ error }) => {
                  if (error) console.error("Database update error:", error);
                });
            } catch (dbError) {
              console.error("Database update error:", dbError);
            }
          }
          
          if (callback) callback({ success: true });
        } catch (error) {
          console.error("Error making move:", error);
          if (callback) callback({ success: false, error: "Failed to make move" });
        }
      });

      // Get available matches
      socket.on("getAvailableMatches", (callback) => {
        try {
          const matches = matchManager.getAvailableMatches();
          if (callback) callback({ success: true, matches });
        } catch (error) {
          console.error("Error getting available matches:", error);
          if (callback) callback({ success: false, error: "Failed to get matches" });
        }
      });

      // Get user matches
      socket.on("getUserMatches", (callback) => {
        try {
          const matches = matchManager.getUserMatches(userId);
          if (callback) callback({ success: true, matches });
        } catch (error) {
          console.error("Error getting user matches:", error);
          if (callback) callback({ success: false, error: "Failed to get matches" });
        }
      });

      // Disconnect handling
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${username} (${userId})`);
        matchManager.removeUser(userId);
      });
    });

    const response = await socketServer.attachToServer(req);
    return response;
  } catch (error) {
    console.error("Socket server error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
