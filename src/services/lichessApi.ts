import { LichessUserProfile } from '@/types';
import { supabase } from "@/integrations/supabase/client";

// Lichess API base URL
const API_BASE_URL = 'https://lichess.org/api';

// Auth token management
let authToken: string | null = null;

export const lichessApi = {
  setAuthToken: (token: string) => {
    authToken = token;
    localStorage.setItem('lichess_token', token);
    console.log('Lichess token set:', token);
  },

  getAuthToken: () => {
    if (!authToken) {
      authToken = localStorage.getItem('lichess_token');
    }
    return authToken;
  },

  clearAuthToken: () => {
    authToken = null;
    localStorage.removeItem('lichess_token');
    console.log('Lichess token cleared');
  },

  isAuthenticated: () => {
    return !!lichessApi.getAuthToken();
  },

  followPlayer: async (username: string): Promise<boolean> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/rel/follow/${username}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to follow player');
      return true;
    } catch (error) {
      console.error('Error following player:', error);
      return false;
    }
  },

  unfollowPlayer: async (username: string): Promise<boolean> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/rel/unfollow/${username}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to unfollow player');
      return true;
    } catch (error) {
      console.error('Error unfollowing player:', error);
      return false;
    }
  },

  sendMessage: async (username: string, text: string): Promise<boolean> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/inbox/${username}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error('Failed to send message');
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  },

  getIncomingChallenges: async () => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/challenge`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch challenges');
      return await response.json();
    } catch (error) {
      console.error('Error getting challenges:', error);
      throw error;
    }
  },

  createChallenge: async (opponent: string, timeControl: string, mode: string): Promise<string> => {
    console.log(`Creating challenge for opponent: ${opponent}, time control: ${timeControl}, mode: ${mode}`);
    const token = lichessApi.getAuthToken();
    if (!token) {
      console.error('Authentication required for creating challenge');
      throw new Error('Authentication required');
    }

    try {
      const params = new URLSearchParams();
      params.append('rated', mode === 'rated' ? 'true' : 'false');
      params.append('clock.limit', (parseInt(timeControl) * 60).toString());
      params.append('clock.increment', '0');
      
      console.log(`Challenge parameters: ${params.toString()}`);
      console.log(`Sending challenge to: ${API_BASE_URL}/challenge/${opponent}`);

      const response = await fetch(`${API_BASE_URL}/challenge/${opponent}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      console.log(`Challenge API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response from Lichess:', errorText);
        throw new Error(`Failed to create challenge: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Challenge created:', data);
      return data.challenge.id;
    } catch (error) {
      console.error('Error creating challenge:', error);
      throw error;
    }
  },

  createOpenChallenge: async (timeControl: string, mode: string = 'casual', color: string = 'random'): Promise<{ challengeId: string, challengeUrl: string }> => {
    console.log(`Creating open challenge: time control: ${timeControl}, mode: ${mode}, color: ${color}`);
    
    try {
      // Add a random increment occasionally to create more diverse games
      const increment = Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0;
      
      const { data, error } = await supabase.functions.invoke('lichess-challenge', {
        body: { 
          timeControl, 
          mode, 
          color,
          increment,
          variant: 'standard' 
        }
      });

      console.log('Supabase function response:', data, error);
      
      if (error) {
        console.error('Error from Supabase function:', error);
        throw new Error(error.message || 'Failed to create open challenge');
      }
      
      if (!data || !data.success) {
        console.error('Error creating open challenge:', data?.error || 'Unknown error');
        throw new Error(data?.error || 'Failed to create open challenge');
      }

      console.log('Open challenge created successfully:', data);
      
      return {
        challengeId: data.challengeId || data.gameId,
        challengeUrl: data.challengeUrl
      };
    } catch (error) {
      console.error('Error creating open challenge:', error);
      throw error;
    }
  },

  extractGameId: (url: string): string | null => {
    try {
      if (!url) return null;
      
      console.log('Extracting game ID from:', url);

      if (!url.includes('lichess.org')) {
        console.log('Not a Lichess URL, using as-is:', url);
        return url;
      }

      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      const extractedId = pathSegments[0] || null;
      console.log('Extracted game ID:', extractedId);
      return extractedId;
    } catch (e) {
      console.error("Failed to parse Lichess URL:", e);
      return null;
    }
  },

  acceptChallenge: async (challengeId: string): Promise<boolean> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to accept challenge');
      return true;
    } catch (error) {
      console.error('Error accepting challenge:', error);
      return false;
    }
  },

  declineChallenge: async (challengeId: string): Promise<boolean> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/challenge/${challengeId}/decline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to decline challenge');
      return true;
    } catch (error) {
      console.error('Error declining challenge:', error);
      return false;
    }
  },

  mockAuthenticate: async (username: string): Promise<{ token: string, user: { id: string, username: string } }> => {
    console.log(`Mock authenticating as ${username}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Use the updated token
        const mockToken = 'lip_suKGoqMXNMRAEzpR6zeP';
        lichessApi.setAuthToken(mockToken);
        
        console.log(`Mock authenticated as ${username} with token ${mockToken}`);
        
        resolve({
          token: mockToken,
          user: {
            id: `user_${Math.random().toString(36).substr(2, 9)}`,
            username: username
          }
        });
      }, 500);
    });
  },

  getUserProfile: async (): Promise<LichessUserProfile> => {
    const token = lichessApi.getAuthToken();
    if (!token) throw new Error('Authentication required');

    try {
      const response = await fetch(`${API_BASE_URL}/account`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch user profile');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  checkGameStatus: async (gameId: string): Promise<{ exists: boolean, ready: boolean }> => {
    try {
      if (!gameId) {
        return { exists: false, ready: false };
      }
      
      // Clean up the game ID if it's a URL
      const cleanId = lichessApi.extractGameId(gameId) || gameId;
      
      const response = await fetch(`https://lichess.org/api/game/${cleanId}`, {
        method: 'HEAD'
      });
      
      if (response.ok) {
        return { exists: true, ready: true };
      } else if (response.status === 404) {
        return { exists: false, ready: false };
      } else {
        // Game might exist but not be ready yet
        return { exists: true, ready: false };
      }
    } catch (error) {
      console.error('Error checking game status:', error);
      return { exists: false, ready: false };
    }
  }
};
