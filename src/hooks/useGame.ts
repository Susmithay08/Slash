import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameMode, MenuState } from '../types/game';
import { HIGH_SCORE_KEY } from '../game/constants';

export interface GameStateValues {
  score: number;
  cubeCount: number;
  menu: MenuState;
  mode: GameMode;
  slowmoPercent: number;
  highScore: number;
}

export function useGame(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameStateValues>({
    score: 0,
    cubeCount: 0,
    menu: MenuState.MAIN,
    mode: GameMode.RANKED,
    slowmoPercent: 0,
    highScore: parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10),
  });

  const updateState = useCallback((partial: Partial<GameStateValues>) => {
    setGameState((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleGameEnd = useCallback((score: number) => {
    const prev = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    if (score > prev) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      setGameState((s) => ({ ...s, highScore: score }));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, updateState, handleGameEnd);
    engineRef.current = engine;
    engine.startLoop();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p') {
        const eng = engineRef.current;
        if (!eng) return;
        setGameState((s) => {
          if (s.menu === MenuState.PAUSE) {
            eng.resumeGame();
          } else {
            eng.pauseGame();
          }
          return s;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      engine.stopLoop();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canvasRef, updateState, handleGameEnd]);

  const startGame = useCallback((mode: GameMode) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMode(mode);
    engine.setMenu(MenuState.NONE);
    engine.resetGame();
    setGameState((s) => ({ ...s, mode, menu: MenuState.NONE, score: 0, cubeCount: 0 }));
  }, []);

  const pauseGame = useCallback(() => {
    engineRef.current?.pauseGame();
  }, []);

  const resumeGame = useCallback(() => {
    engineRef.current?.resumeGame();
    setGameState((s) => ({ ...s, menu: MenuState.NONE }));
  }, []);

  const goToMainMenu = useCallback(() => {
    engineRef.current?.setMenu(MenuState.MAIN);
    setGameState((s) => ({ ...s, menu: MenuState.MAIN }));
  }, []);

  const playAgain = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setMenu(MenuState.NONE);
    engine.resetGame();
    setGameState((s) => ({ ...s, menu: MenuState.NONE, score: 0, cubeCount: 0 }));
  }, []);

  // Pointer handlers
  const handlePointerDown = useCallback((x: number, y: number) => {
    engineRef.current?.handlePointerDown(x, y);
  }, []);

  const handlePointerUp = useCallback(() => {
    engineRef.current?.handlePointerUp();
  }, []);

  const handlePointerMove = useCallback((x: number, y: number) => {
    engineRef.current?.handlePointerMove(x, y);
  }, []);

  return {
    gameState,
    startGame,
    pauseGame,
    resumeGame,
    goToMainMenu,
    playAgain,
    handlePointerDown,
    handlePointerUp,
    handlePointerMove,
  };
}
