
import React, { createContext, useContext, useState, useReducer } from 'react';

// Types for chess pieces and positions
export type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';
export type Position = { row: number; col: number };

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  position: Position;
  hasMoved?: boolean;
}

export interface ChessGameState {
  board: (ChessPiece | null)[][];
  currentTurn: PieceColor;
  selectedPiece: Position | null;
  validMoves: Position[];
  capturedPieces: {
    white: ChessPiece[];
    black: ChessPiece[];
  };
  gameStatus: 'active' | 'check' | 'checkmate' | 'stalemate';
  winner: PieceColor | null;
}

type ChessGameAction =
  | { type: 'SELECT_PIECE'; position: Position }
  | { type: 'MOVE_PIECE'; from: Position; to: Position }
  | { type: 'RESET_GAME' }
  | { type: 'CLEAR_SELECTION' };

// Initial board setup
const createInitialBoard = (): (ChessPiece | null)[][] => {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Set up pawns
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'pawn', color: 'white', position: { row: 1, col }, hasMoved: false };
    board[6][col] = { type: 'pawn', color: 'black', position: { row: 6, col }, hasMoved: false };
  }
  
  // Set up other pieces
  const setupRow = (row: number, color: PieceColor) => {
    board[row][0] = { type: 'rook', color, position: { row, col: 0 }, hasMoved: false };
    board[row][1] = { type: 'knight', color, position: { row, col: 1 } };
    board[row][2] = { type: 'bishop', color, position: { row, col: 2 } };
    board[row][3] = { type: 'queen', color, position: { row, col: 3 } };
    board[row][4] = { type: 'king', color, position: { row, col: 4 }, hasMoved: false };
    board[row][5] = { type: 'bishop', color, position: { row, col: 5 } };
    board[row][6] = { type: 'knight', color, position: { row, col: 6 } };
    board[row][7] = { type: 'rook', color, position: { row, col: 7 }, hasMoved: false };
  };
  
  setupRow(0, 'white');
  setupRow(7, 'black');
  
  return board;
};

const initialState: ChessGameState = {
  board: createInitialBoard(),
  currentTurn: 'white',
  selectedPiece: null,
  validMoves: [],
  capturedPieces: {
    white: [],
    black: [],
  },
  gameStatus: 'active',
  winner: null,
};

// Helper function to get valid moves for a piece
const getValidMoves = (piece: ChessPiece, board: (ChessPiece | null)[][]): Position[] => {
  const { type, color, position } = piece;
  const { row, col } = position;
  const moves: Position[] = [];
  
  // Basic move validation - can be expanded for more complex chess rules
  if (type === 'pawn') {
    const direction = color === 'white' ? 1 : -1;
    const startingRow = color === 'white' ? 1 : 6;
    
    // Move forward one square
    if (row + direction >= 0 && row + direction < 8 && !board[row + direction][col]) {
      moves.push({ row: row + direction, col });
      
      // Move forward two squares on first move
      if (row === startingRow && !board[row + 2 * direction][col]) {
        moves.push({ row: row + 2 * direction, col });
      }
    }
    
    // Capture diagonally
    if (col + 1 < 8 && row + direction >= 0 && row + direction < 8) {
      const targetPiece = board[row + direction][col + 1];
      if (targetPiece && targetPiece.color !== color) {
        moves.push({ row: row + direction, col: col + 1 });
      }
    }
    
    if (col - 1 >= 0 && row + direction >= 0 && row + direction < 8) {
      const targetPiece = board[row + direction][col - 1];
      if (targetPiece && targetPiece.color !== color) {
        moves.push({ row: row + direction, col: col - 1 });
      }
    }
  }
  
  // Simplified movement for other pieces - would need to be expanded for a full chess implementation
  if (type === 'rook') {
    // Horizontal and vertical moves
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!board[r][c]) {
          moves.push({ row: r, col: c });
        } else {
          if (board[r][c]?.color !== color) {
            moves.push({ row: r, col: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }
  
  if (type === 'bishop') {
    // Diagonal moves
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!board[r][c]) {
          moves.push({ row: r, col: c });
        } else {
          if (board[r][c]?.color !== color) {
            moves.push({ row: r, col: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }
  
  if (type === 'queen') {
    // Combination of rook and bishop moves
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of directions) {
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!board[r][c]) {
          moves.push({ row: r, col: c });
        } else {
          if (board[r][c]?.color !== color) {
            moves.push({ row: r, col: c });
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }
  
  if (type === 'knight') {
    // L-shaped moves
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [dr, dc] of knightMoves) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!board[r][c] || board[r][c]?.color !== color) {
          moves.push({ row: r, col: c });
        }
      }
    }
  }
  
  if (type === 'king') {
    // One square in any direction
    const kingMoves = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1], [0, 1],
      [1, -1], [1, 0], [1, 1]
    ];
    
    for (const [dr, dc] of kingMoves) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        if (!board[r][c] || board[r][c]?.color !== color) {
          moves.push({ row: r, col: c });
        }
      }
    }
  }
  
  return moves;
};

// Game reducer
const chessGameReducer = (state: ChessGameState, action: ChessGameAction): ChessGameState => {
  switch (action.type) {
    case 'SELECT_PIECE': {
      const { row, col } = action.position;
      const piece = state.board[row][col];
      
      // Can only select own pieces
      if (!piece || piece.color !== state.currentTurn) {
        return { ...state, selectedPiece: null, validMoves: [] };
      }
      
      const validMoves = getValidMoves(piece, state.board);
      return {
        ...state,
        selectedPiece: { row, col },
        validMoves
      };
    }
    
    case 'MOVE_PIECE': {
      const { from, to } = action;
      const piece = state.board[from.row][from.col];
      
      if (!piece) return state;
      
      // Create new board with the move
      const newBoard = state.board.map(row => [...row]);
      
      // Check if there's a piece to capture
      const capturedPiece = newBoard[to.row][to.col];
      const newCapturedPieces = { ...state.capturedPieces };
      
      if (capturedPiece) {
        newCapturedPieces[piece.color].push(capturedPiece);
      }
      
      // Update piece position
      const updatedPiece = {
        ...piece,
        position: to,
        hasMoved: true
      };
      
      newBoard[from.row][from.col] = null;
      newBoard[to.row][to.col] = updatedPiece;
      
      // Switch turns
      const newTurn = state.currentTurn === 'white' ? 'black' : 'white';
      
      return {
        ...state,
        board: newBoard,
        currentTurn: newTurn,
        selectedPiece: null,
        validMoves: [],
        capturedPieces: newCapturedPieces
      };
    }
    
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedPiece: null,
        validMoves: []
      };
    
    case 'RESET_GAME':
      return initialState;
    
    default:
      return state;
  }
};

// Create context
interface ChessGameContextType {
  gameState: ChessGameState;
  selectPiece: (position: Position) => void;
  movePiece: (to: Position) => void;
  clearSelection: () => void;
  resetGame: () => void;
}

const ChessGameContext = createContext<ChessGameContextType | null>(null);

// Provider component
export const ChessGameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, dispatch] = useReducer(chessGameReducer, initialState);
  
  const selectPiece = (position: Position) => {
    dispatch({ type: 'SELECT_PIECE', position });
  };
  
  const movePiece = (to: Position) => {
    if (gameState.selectedPiece) {
      dispatch({ type: 'MOVE_PIECE', from: gameState.selectedPiece, to });
    }
  };
  
  const clearSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION' });
  };
  
  const resetGame = () => {
    dispatch({ type: 'RESET_GAME' });
  };
  
  return (
    <ChessGameContext.Provider
      value={{
        gameState,
        selectPiece,
        movePiece,
        clearSelection,
        resetGame
      }}
    >
      {children}
    </ChessGameContext.Provider>
  );
};

// Custom hook to use chess game context
export const useChessGame = () => {
  const context = useContext(ChessGameContext);
  if (!context) {
    throw new Error('useChessGame must be used within a ChessGameProvider');
  }
  return context;
};
