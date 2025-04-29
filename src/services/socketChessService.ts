// WebSocket chess service
import { Match } from '@/types';

// Server URL from environment variable
const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_CHESS_SERVER_URL || 'wss://fmnopirdysucmxwgyezo.supabase.co/functions/v1/socket-chess-server';

// Connection settings
const MAX_RECONNECTION_ATTEMPTS = 3;
const CONNECTION_TIMEOUT = 10000; // 10 seconds

class SocketChessService {
  private socket: WebSocket | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private matchListeners: Map<string, Array<(match: Match) => void>> = new Map();
  private gameStateListeners: Map<string, Array<(gameState: any) => void>> = new Map();
  private connectionAttempts = 0;
  private isReconnecting = false;
  
  // Initialize the WebSocket connection
  connect(userId: string, username: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        resolve(true);
        return;
      }
      
      this.userId = userId;
      this.username = username;
      this.connectionAttempts += 1;
      
      console.log(`Connecting to WebSocket server at ${SOCKET_SERVER_URL} (attempt ${this.connectionAttempts})`);
      
      // Clean up any existing socket
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.close();
        this.socket = null;
      }
      
      try {
        // Create a new WebSocket connection
        this.socket = new WebSocket(SOCKET_SERVER_URL);
        
        this.socket.onopen = () => {
          console.log('✅ WebSocket connected successfully to', SOCKET_SERVER_URL);
          this.connectionAttempts = 0; // Reset counter on successful connection
          this.isReconnecting = false;
          
          // Send auth information
          this.send({
            type: 'auth',
            userId,
            username
          });
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 Message from server:', data);
            
            if (data.type === 'matchUpdate' && data.match) {
              const match = data.match;
              const listeners = this.matchListeners.get(match.id) || [];
              listeners.forEach(listener => listener(match));
            }
            
            if (data.type === 'gameStateUpdate' && data.matchId) {
              const listeners = this.gameStateListeners.get(data.matchId) || [];
              listeners.forEach(listener => listener(data.gameState));
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          if (this.connectionAttempts < MAX_RECONNECTION_ATTEMPTS && !this.isReconnecting) {
            console.log(`Retrying connection (${this.connectionAttempts}/${MAX_RECONNECTION_ATTEMPTS})...`);
            setTimeout(() => {
              this.connect(userId, username).then(resolve);
            }, 2000); // Wait 2 seconds before retrying
          } else {
            resolve(false);
          }
        };
        
        this.socket.onclose = () => {
          console.log('🔌 Disconnected from WebSocket server');
        };
        
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        resolve(false);
      }
      
      // Set a timeout to prevent hanging on connection attempts
      setTimeout(() => {
        if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
          console.log('Connection attempt timed out');
          resolve(false);
        }
      }, CONNECTION_TIMEOUT);
    });
  }
  
  // Private method to send data to the server
  private send(data: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }
  
  // Try to reconnect
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
      this.socket.close();
      this.socket = null;
      this.userId = null;
      this.username = null;
      this.connectionAttempts = 0;
      console.log('WebSocket disconnected');
    }
  }
  
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  // Get the socket instance
  getSocket(): WebSocket | null {
    return this.socket;
  }
  
  // Match related methods
  createMatch(matchData: Partial<Match>): Promise<Match> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const requestId = this.generateRequestId();
      
      // Set up a one-time listener for the response
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.requestId === requestId) {
            // Remove the listener once we get the response
            this.socket?.removeEventListener('message', messageHandler);
            
            if (data.success && data.match) {
              resolve(data.match);
            } else {
              reject(new Error(data.error || 'Failed to create match'));
            }
          }
        } catch (error) {
          console.error('Error processing create match response:', error);
        }
      };
      
      this.socket.addEventListener('message', messageHandler);
      
      // Send the create match request
      this.send({
        type: 'createMatch',
        requestId,
        matchData: {
          ...matchData,
          whitePlayerId: this.userId,
          whiteUsername: this.username,
        }
      });
    });
  }
  
  joinMatch(matchId: string): Promise<Match> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const requestId = this.generateRequestId();
      
      // Set up a one-time listener for the response
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.requestId === requestId) {
            // Remove the listener once we get the response
            this.socket?.removeEventListener('message', messageHandler);
            
            if (data.success && data.match) {
              resolve(data.match);
            } else {
              reject(new Error(data.error || 'Failed to join match'));
            }
          }
        } catch (error) {
          console.error('Error processing join match response:', error);
        }
      };
      
      this.socket.addEventListener('message', messageHandler);
      
      // Send the join match request
      this.send({
        type: 'joinMatch',
        requestId,
        matchId
      });
    });
  }
  
  startMatch(matchId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const requestId = this.generateRequestId();
      
      // Set up a one-time listener for the response
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.requestId === requestId) {
            // Remove the listener once we get the response
            this.socket?.removeEventListener('message', messageHandler);
            
            if (data.success) {
              resolve(true);
            } else {
              reject(new Error(data.error || 'Failed to start match'));
            }
          }
        } catch (error) {
          console.error('Error processing start match response:', error);
        }
      };
      
      this.socket.addEventListener('message', messageHandler);
      
      // Send the start match request
      this.send({
        type: 'startMatch',
        requestId,
        matchId
      });
    });
  }
  
  makeMove(matchId: string, move: { from: string, to: string }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const requestId = this.generateRequestId();
      
      // Set up a one-time listener for the response
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.requestId === requestId) {
            // Remove the listener once we get the response
            this.socket?.removeEventListener('message', messageHandler);
            
            if (data.success) {
              resolve(true);
            } else {
              reject(new Error(data.error || 'Failed to make move'));
            }
          }
        } catch (error) {
          console.error('Error processing make move response:', error);
        }
      };
      
      this.socket.addEventListener('message', messageHandler);
      
      // Send the make move request
      this.send({
        type: 'makeMove',
        requestId,
        matchId,
        move
      });
    });
  }
  
  // Helper method to generate unique request IDs
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
