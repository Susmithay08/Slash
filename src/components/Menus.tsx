import React from 'react';
import { GameMode, MenuState } from '../types/game';
import { playSound } from '../game/sounds';

interface MainMenuProps {
  onPlay: (mode: GameMode) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onPlay }) => (
  <div className="menu menu--main">
    <div className="menu-title-wrapper">
      <h1 className="game-title">
        <span className="title-slash">/</span>SLASH
      </h1>
      <p className="game-subtitle">Slice. Smash. Score.</p>
    </div>
    <div className="menu-buttons">
      <button
        className="btn btn--primary"
        onClick={() => { playSound('click'); onPlay(GameMode.RANKED); }}
      >
        <span className="btn-text">PLAY</span>
        <span className="btn-sub">Ranked Mode</span>
      </button>
      <button
        className="btn btn--secondary"
        onClick={() => { playSound('click'); onPlay(GameMode.CASUAL); }}
      >
        <span className="btn-text">CASUAL</span>
        <span className="btn-sub">No Game Over</span>
      </button>
    </div>
    <div className="menu-footer">
      <p>Slash cubes before they fall · Fast swipes score more</p>
    </div>
  </div>
);

interface PauseMenuProps {
  onResume: () => void;
  onMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({ onResume, onMainMenu }) => (
  <div className="menu menu--pause">
    <h2 className="menu-heading">PAUSED</h2>
    <div className="menu-buttons">
      <button
        className="btn btn--primary"
        onClick={() => { playSound('click'); onResume(); }}
      >
        <span className="btn-text">RESUME</span>
      </button>
      <button
        className="btn btn--secondary"
        onClick={() => { playSound('click'); onMainMenu(); }}
      >
        <span className="btn-text">MAIN MENU</span>
      </button>
    </div>
    <p className="menu-hint">Press P to toggle pause</p>
  </div>
);

interface ScoreMenuProps {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export const ScoreMenu: React.FC<ScoreMenuProps> = ({
  score,
  highScore,
  isNewHighScore,
  onPlayAgain,
  onMainMenu,
}) => (
  <div className="menu menu--score">
    <h2 className="menu-heading">GAME OVER</h2>
    <div className="score-display">
      <div className="score-value">{score.toLocaleString()}</div>
      {isNewHighScore ? (
        <div className="high-score-badge">✦ NEW HIGH SCORE ✦</div>
      ) : (
        <div className="high-score-prev">Best: {highScore.toLocaleString()}</div>
      )}
    </div>
    <div className="menu-buttons">
      <button
        className="btn btn--primary"
        onClick={() => { playSound('click'); onPlayAgain(); }}
      >
        <span className="btn-text">PLAY AGAIN</span>
      </button>
      <button
        className="btn btn--secondary"
        onClick={() => { playSound('click'); onMainMenu(); }}
      >
        <span className="btn-text">MAIN MENU</span>
      </button>
    </div>
  </div>
);

interface MenuOverlayProps {
  menu: MenuState;
  score: number;
  highScore: number;
  onPlay: (mode: GameMode) => void;
  onResume: () => void;
  onMainMenu: () => void;
  onPlayAgain: () => void;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({
  menu,
  score,
  highScore,
  onPlay,
  onResume,
  onMainMenu,
  onPlayAgain,
}) => {


  const isNewHighScore = score > highScore && menu === MenuState.SCORE;

  return (
    <div className={`menus ${menu !== MenuState.NONE ? 'has-active' : ''}`}>
      <div className="menu-backdrop" />
      {menu === MenuState.MAIN && <MainMenu onPlay={onPlay} />}
      {menu === MenuState.PAUSE && (
        <PauseMenu onResume={onResume} onMainMenu={onMainMenu} />
      )}
      {menu === MenuState.SCORE && (
        <ScoreMenu
          score={score}
          highScore={Math.max(score, highScore)}
          isNewHighScore={isNewHighScore}
          onPlayAgain={onPlayAgain}
          onMainMenu={onMainMenu}
        />
      )}
    </div>
  );
};