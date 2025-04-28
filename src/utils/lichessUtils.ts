
/**
 * Utility functions for Lichess integration
 */

/**
 * Checks if a Lichess game URL or ID is valid and accessible
 * @param gameId The game ID or URL to check
 * @returns Promise resolving to an object with validation status and message
 */
export const validateLichessGame = async (
  gameId: string
): Promise<{ valid: boolean; message: string; cleanId: string }> => {
  try {
    // Extract game ID from URL if necessary
    const cleanId = extractGameIdFromUrl(gameId);
    
    if (!cleanId) {
      return {
        valid: false,
        message: "Invalid Lichess game ID",
        cleanId: ""
      };
    }

    console.log(`Validating Lichess game ID: ${cleanId}`);

    // Check if this is a challenge URL (which is handled differently)
    if (gameId.includes('/challenge/')) {
      return {
        valid: true,
        message: "Valid challenge URL",
        cleanId
      };
    }

    // Check if the game exists by making a HEAD request to the game URL
    const response = await fetch(`https://lichess.org/${cleanId}`, {
      method: "HEAD"
    });

    console.log(`Lichess validation response status: ${response.status}`);

    if (response.ok) {
      return {
        valid: true,
        message: "Game is valid and accessible",
        cleanId
      };
    } else if (response.status === 404) {
      return {
        valid: false,
        message: "Game not found on Lichess",
        cleanId
      };
    } else {
      return {
        valid: false,
        message: `Game may not be ready yet (status: ${response.status})`,
        cleanId
      };
    }
  } catch (error) {
    console.error("Error validating Lichess game:", error);
    return {
      valid: false,
      message: "Error checking game validity",
      cleanId: extractGameIdFromUrl(gameId) || ""
    };
  }
};

/**
 * Extracts a game ID from a Lichess URL or returns the ID if already clean
 * @param input The game URL or ID
 * @returns The extracted game ID or null if invalid
 */
export const extractGameIdFromUrl = (input: string): string | null => {
  try {
    if (!input) return null;

    console.log("Extracting game ID from input:", input);

    // Handle challenge URLs
    if (input.includes('/challenge/')) {
      const challengeMatch = input.match(/\/challenge\/([a-zA-Z0-9]{8,12})/);
      if (challengeMatch && challengeMatch[1]) {
        console.log("Extracted challenge ID:", challengeMatch[1]);
        return challengeMatch[1];
      }
    }
    
    // Handle direct game URLs
    if (input.includes('/game/')) {
      const gameMatch = input.match(/\/game\/([a-zA-Z0-9]{8,12})/);
      if (gameMatch && gameMatch[1]) {
        console.log("Extracted game ID from API URL:", gameMatch[1]);
        return gameMatch[1];
      }
    }

    if (!input.includes("lichess.org")) {
      // Clean the ID by removing any non-alphanumeric characters
      const cleanId = input.replace(/[^a-zA-Z0-9]/g, '');
      return cleanId || null;
    }

    // Standard URL parsing
    try {
      const url = new URL(input);
      const pathSegments = url.pathname.split("/").filter(Boolean);
      return pathSegments[0] || null;
    } catch (e) {
      // If URL parsing fails, try a simple regex extraction
      const matches = input.match(/lichess\.org\/([a-zA-Z0-9]{8,12})/);
      return matches ? matches[1] : null;
    }
  } catch (e) {
    console.error("Failed to parse Lichess URL:", e);
    return null;
  }
};

/**
 * Builds a proper Lichess game URL from a game ID or URL
 * @param input The game ID or URL
 * @returns A properly formatted Lichess game URL
 */
export const buildLichessGameUrl = (input: string): string => {
  if (!input) return '';
  
  if (input.startsWith('http')) {
    return input; // Already a URL
  }
  
  return `https://lichess.org/${input}`;
};

/**
 * Checks if a challenge link is accessible and valid
 * @param url The challenge URL to check
 * @returns Promise resolving to validity status
 */
export const validateChallengeLink = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  try {
    console.log("Validating challenge link:", url);
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual' // Do not follow redirects
    });
    
    console.log("Challenge link validation status:", response.status);
    
    // Challenge URLs are valid even if they return a redirect
    return response.status === 200 || response.status === 302;
  } catch (error) {
    console.error('Error validating challenge link:', error);
    return false;
  }
};

/**
 * Checks if a game ID or challenge ID is active on Lichess
 * @param gameIdOrUrl The game ID, challenge ID, or URL to check
 * @returns Promise resolving to game status information
 */
export const checkGameStatus = async (gameIdOrUrl: string): Promise<{ exists: boolean; active: boolean; type: 'game' | 'challenge' | 'unknown'; gameId?: string }> => {
  try {
    if (!gameIdOrUrl) {
      return { exists: false, active: false, type: 'unknown' };
    }
    
    const cleanId = extractGameIdFromUrl(gameIdOrUrl);
    if (!cleanId) {
      return { exists: false, active: false, type: 'unknown' };
    }
    
    console.log(`Checking status for game/challenge: ${cleanId}`);
    
    // First check if it's a challenge
    if (gameIdOrUrl.includes('/challenge/')) {
      try {
        const challengeResponse = await fetch(`https://lichess.org/api/challenge/${cleanId}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (challengeResponse.ok) {
          const challengeData = await challengeResponse.json();
          console.log("Challenge data:", challengeData);
          
          // Check if the challenge has been accepted and converted to a game
          if (challengeData.game && challengeData.game.id) {
            return { 
              exists: true, 
              active: true, 
              type: 'game', 
              gameId: challengeData.game.id 
            };
          }
          
          return { exists: true, active: true, type: 'challenge' };
        }
        
        if (challengeResponse.status === 302) {
          // Challenge might have been converted to a game, try to extract the game ID
          const location = challengeResponse.headers.get('Location');
          if (location) {
            const gameId = extractGameIdFromUrl(location);
            if (gameId) {
              return { exists: true, active: true, type: 'game', gameId };
            }
          }
        }
      } catch (e) {
        console.error("Error checking challenge:", e);
      }
    }
    
    // Then check if it's a game
    try {
      const gameResponse = await fetch(`https://lichess.org/api/game/${cleanId}`, {
        method: 'HEAD'
      });
      
      if (gameResponse.ok) {
        return { exists: true, active: true, type: 'game', gameId: cleanId };
      }
    } catch (e) {
      console.error("Error checking game API endpoint:", e);
    }
    
    // If we got this far, try a regular URL check
    try {
      const urlResponse = await fetch(`https://lichess.org/${cleanId}`, {
        method: 'HEAD'
      });
      
      if (urlResponse.ok) {
        return { exists: true, active: true, type: 'game', gameId: cleanId };
      }
    } catch (e) {
      console.error("Error checking game URL:", e);
    }
    
    return { exists: false, active: false, type: 'unknown' };
  } catch (error) {
    console.error('Error checking game status:', error);
    return { exists: false, active: false, type: 'unknown' };
  }
};

/**
 * Polls Lichess for challenge status until it becomes a game or times out
 * @param challengeId The challenge ID to poll
 * @param maxAttempts Maximum number of polling attempts
 * @returns Promise resolving to game ID if converted, or null
 */
export const pollChallengeUntilGame = async (
  challengeId: string,
  maxAttempts = 10
): Promise<string | null> => {
  if (!challengeId) return null;
  
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    console.log(`Polling challenge ${challengeId}, attempt ${attempts + 1}/${maxAttempts}`);
    
    try {
      const status = await checkGameStatus(`https://lichess.org/challenge/${challengeId}`);
      
      if (status.type === 'game' && status.gameId) {
        console.log(`Challenge converted to game: ${status.gameId}`);
        return status.gameId;
      }
      
      if (!status.exists) {
        console.log(`Challenge ${challengeId} no longer exists`);
        return null;
      }
    } catch (e) {
      console.error(`Error polling challenge ${challengeId}:`, e);
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  console.log(`Challenge ${challengeId} polling timed out after ${maxAttempts} attempts`);
  return null;
}
