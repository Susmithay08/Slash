import React, { useRef, useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { HUD } from './components/HUD';
import { MenuOverlay } from './components/Menus';
import { GameMode, MenuState } from './types/game';
import { loadSounds } from './game/sounds';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gameState,
    startGame,
    pauseGame,
    resumeGame,
    goToMainMenu,
    playAgain,
    handlePointerDown,
    handlePointerUp,
    handlePointerMove,
  } = useGame(canvasRef);

  const { score, cubeCount, menu, mode, slowmoPercent, highScore } = gameState;

  // Load sounds on first user interaction (browser requires this)
  useEffect(() => {
    const unlock = () => {
      loadSounds();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  return (
    <div className="game-wrapper">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        onPointerDown={(e) => e.isPrimary && handlePointerDown(e.clientX, e.clientY)}
        onPointerUp={(e) => e.isPrimary && handlePointerUp()}
        onPointerMove={(e) => e.isPrimary && handlePointerMove(e.clientX, e.clientY)}
        onMouseLeave={handlePointerUp}
        style={{ display: 'block', touchAction: 'none' }}
      />

      <HUD
        score={score}
        cubeCount={cubeCount}
        isCasual={mode === GameMode.CASUAL}
        menu={menu}
        slowmoPercent={slowmoPercent}
        onPause={pauseGame}
      />

      {menu !== MenuState.NONE && (
        <MenuOverlay
          menu={menu}
          score={score}
          highScore={highScore}
          onPlay={startGame}
          onResume={resumeGame}
          onMainMenu={goToMainMenu}
          onPlayAgain={playAgain}
        />
      )}
    </div>
  );
}