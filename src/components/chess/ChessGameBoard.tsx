import { useState } from 'react';
import { useChessGame, Position, ChessPiece } from '@/context/ChessGameContext';
import { Badge } from "@/components/ui/badge";

interface ChessGameBoardProps {
  size?: 'sm' | 'md' | 'lg';
}

export const ChessGameBoard = ({ size = 'md' }: ChessGameBoardProps) => {
  const { gameState, selectPiece, movePiece } = useChessGame();
  const { board, selectedPiece, validMoves, currentTurn, gameStatus } = gameState;
  
  const handleSquareClick = (row: number, col: number) => {
    const clickedPosition: Position = { row, col };
    const piece = board[row][col];
    
    // If game is over, don't allow moves
    if (gameStatus === 'checkmate' || gameStatus === 'stalemate') {
      return;
    }
    
    // If we already have a selected piece, try to move it
    if (selectedPiece) {
      // Check if the clicked position is a valid move
      const isValidMove = validMoves.some(
        move => move.row === row && move.col === col
      );
      
      if (isValidMove) {
        movePiece(clickedPosition);
      } 
      // If clicking on own piece, select it instead
      else if (piece && piece.color === currentTurn) {
        selectPiece(clickedPosition);
      }
      // Otherwise, deselect
      else {
        selectPiece(null);
      }
    } else if (piece && piece.color === currentTurn) {
      selectPiece(clickedPosition);
    }
  };
  
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'w-full max-w-[300px]';
      case 'lg': return 'w-full max-w-[600px]';
      case 'md':
      default: return 'w-full max-w-[450px]';
    }
  };
  
  const renderPiece = (piece: ChessPiece | null) => {
    if (!piece) return null;
    
    const pieceSymbols: Record<string, string> = {
      'white-pawn': '♙',
      'white-rook': '♖',
      'white-knight': '♘',
      'white-bishop': '♗',
      'white-queen': '♕',
      'white-king': '♔',
      'black-pawn': '♟',
      'black-rook': '♜',
      'black-knight': '♞',
      'black-bishop': '♝',
      'black-queen': '♛',
      'black-king': '♚',
    };
    
    const symbol = pieceSymbols[`${piece.color}-${piece.type}`];
    
    return (
      <span className={`chess-piece text-2xl ${piece.color === currentTurn ? 'animate-pulse' : ''}`}>
        {symbol}
      </span>
    );
  };
  
  const isSquareSelected = (row: number, col: number) => {
    return selectedPiece?.row === row && selectedPiece?.col === col;
  };
  
  const isValidMove = (row: number, col: number) => {
    return validMoves.some(move => move.row === row && move.col === col);
  };
  
  const isInCheck = () => {
    return gameStatus === 'check';
  };
  
  const getKingPosition = (color: 'white' | 'black') => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === color) {
          return { row, col };
        }
      }
    }
    return null;
  };
  
  const kingInCheckPos = isInCheck() ? getKingPosition(currentTurn) : null;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <Badge className={`${currentTurn === 'black' ? 'bg-black text-white' : 'bg-white text-black border border-gray-300'} px-3 py-1`}>
          {currentTurn === 'white' ? 'White to Move' : 'Black to Move'}
        </Badge>
      </div>
      
      <div className={`${getSizeClass()} aspect-square mx-auto`}>
        <div className="w-full aspect-square grid grid-cols-8 grid-rows-8 border border-chess-brown">
          {board.flat().map((_, index) => {
            const row = Math.floor(index / 8);
            const col = index % 8;
            const isLight = (row + col) % 2 === 0;
            const piece = board[row][col];
            const isSelected = isSquareSelected(row, col);
            const isValid = isValidMove(row, col);
            const isKingInCheck = kingInCheckPos && kingInCheckPos.row === row && kingInCheckPos.col === col;
            
            return (
              <div
                key={index}
                onClick={() => handleSquareClick(row, col)}
                className={`
                  ${isLight ? 'bg-chess-light' : 'bg-chess-brown'}
                  ${isSelected ? 'ring-2 ring-chess-accent' : ''}
                  ${isValid ? 'bg-green-500/30' : ''}
                  ${isKingInCheck ? 'bg-red-500/50' : ''}
                  flex items-center justify-center relative cursor-pointer
                  transition-all duration-150
                  ${piece && piece.color === currentTurn && !isSelected ? 'hover:bg-chess-accent/20' : ''}
                `}
              >
                {renderPiece(piece)}
                
                {/* Column labels (a-h) at bottom row */}
                {row === 7 && (
                  <div className="absolute bottom-0 right-0 text-xs p-0.5 opacity-70">
                    {String.fromCharCode(97 + col)}
                  </div>
                )}
                
                {/* Row numbers (1-8) at leftmost column */}
                {col === 0 && (
                  <div className="absolute top-0 left-0 text-xs p-0.5 opacity-70">
                    {8 - row}
                  </div>
                )}
                
                {/* Visual indicator for valid moves */}
                {isValid && !piece && (
                  <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                )}
                
                {/* Visual indicator for captures */}
                {isValid && piece && (
                  <div className="absolute inset-0 border-2 border-red-500/70 rounded-sm"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
