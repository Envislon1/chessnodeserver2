
import { io, Socket } from 'socket.io-client';
import { Match } from '@/types';

// We'll set a default server URL and fallback to local if not available
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_CHESS_SERVER_URL || 'http://localhost:3001';

// Constants for reconnection
const MAX_RECONNECTION_ATTEMPTS = 3;
const RECONNECTION_DELAY = 2000; // 2 seconds

class SocketChessService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private matchListeners: Map<string, Array<(match: Match) => void>> = new Map();
  private gameStateListeners: Map<string, Array<(gameState: any) => void>> = new Map();
  private connectionAttempts = 0;
  private isReconnecting = false;
  
  // Initialize the socket connection with retry logic
  connect(userId: string, username: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        console.log('Socket already connected');
        resolve(true);
        return;
      }
      
      this.userId = userId;
      this.username = username;
      this.connectionAttempts += 1;
      
      console.log(`Connecting to socket server at ${SOCKET_SERVER_URL} (attempt ${this.connectionAttempts})`);
      
      // Clean up any existing socket
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      
      // Create new socket connection with improved options
      this.socket = io(SOCKET_SERVER_URL, {
        auth: {
          userId,
          username
        },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
        reconnectionDelay: RECONNECTION_DELAY,
        timeout: 10000, // 10 seconds timeout
        transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
      });
      
      this.socket.on('connect', () => {
        console.log('Socket connected successfully');
        this.connectionAttempts = 0; // Reset counter on successful connection
        this.isReconnecting = false;
        resolve(true);
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        
        if (this.connectionAttempts < MAX_RECONNECTION_ATTEMPTS && !this.isReconnecting) {
          console.log(`Retrying connection (${this.connectionAttempts}/${MAX_RECONNECTION_ATTEMPTS})...`);
          // Will automatically retry due to reconnection options
        } else {
          resolve(false);
        }
      });
      
      this.socket.on('matchUpdate', (matchData: Match) => {
        console.log('Received match update:', matchData);
        const listeners = this.matchListeners.get(matchData.id) || [];
        listeners.forEach(listener => listener(matchData));
      });
      
      this.socket.on('gameStateUpdate', (data: { matchId: string, gameState: any }) => {
        console.log(`Received game state update for match ${data.matchId}:`, data.gameState);
        const listeners = this.gameStateListeners.get(data.matchId) || [];
        listeners.forEach(listener => listener(data.gameState));
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
      
      // Set a timeout to prevent hanging on connection attempts
      setTimeout(() => {
        if (!this.socket?.connected) {
          console.log('Connection attempt timed out');
          resolve(false);
        }
      }, 10000); // 10 second timeout
    });
  }
  
  // Try to reconnect with exponential backoff
  async reconnect(): Promise<boolean> {
    if (!this.userId || !this.username) {
      console.error('Cannot reconnect without user credentials');
      return false;
    }
    
    if (this.isReconnecting) {
      console.log('Reconnection already in progress');
      return false;
    }
    
    this.isReconnecting = true;
    
    try {
      return await this.connect(this.userId, this.username);
    } finally {
      this.isReconnecting = false;
    }
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.username = null;
      this.connectionAttempts = 0;
      console.log('Socket disconnected');
    }
  }
  
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
  
  // Add method to get the socket instance
  getSocket(): Socket | null {
    return this.socket;
  }
  
  // Match related methods
  createMatch(matchData: Partial<Match>): Promise<Match> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      this.socket.emit('createMatch', matchData, (response: { success: boolean, match?: Match, error?: string }) => {
        if (response.success && response.match) {
          resolve(response.match);
        } else {
          reject(new Error(response.error || 'Failed to create match'));
        }
      });
    });
  }
  
  joinMatch(matchId: string): Promise<Match> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      this.socket.emit('joinMatch', { matchId }, (response: { success: boolean, match?: Match, error?: string }) => {
        if (response.success && response.match) {
          resolve(response.match);
        } else {
          reject(new Error(response.error || 'Failed to join match'));
        }
      });
    });
  }
  
  startMatch(matchId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      this.socket.emit('startMatch', { matchId }, (response: { success: boolean, error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to start match'));
        }
      });
    });
  }
  
  makeMove(matchId: string, move: { from: string, to: string }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }
      
      this.socket.emit('makeMove', { matchId, move }, (response: { success: boolean, error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to make move'));
        }
      });
    });
  }
  
  // Listeners
  onMatchUpdate(matchId: string, listener: (match: Match) => void): () => void {
    if (!this.matchListeners.has(matchId)) {
      this.matchListeners.set(matchId, []);
    }
    
    this.matchListeners.get(matchId)?.push(listener);
    
    return () => {
      const listeners = this.matchListeners.get(matchId) || [];
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  onGameStateUpdate(matchId: string, listener: (gameState: any) => void): () => void {
    if (!this.gameStateListeners.has(matchId)) {
      this.gameStateListeners.set(matchId, []);
    }
    
    this.gameStateListeners.get(matchId)?.push(listener);
    
    return () => {
      const listeners = this.gameStateListeners.get(matchId) || [];
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
}

export const socketChessService = new SocketChessService();
