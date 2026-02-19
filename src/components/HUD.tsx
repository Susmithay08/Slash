import React from 'react';
import { MenuState } from '../types/game';

interface HUDProps {
  score: number;
  cubeCount: number;
  isCasual: boolean;
  menu: MenuState;
  slowmoPercent: number;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({ score, cubeCount, isCasual, menu, slowmoPercent, onPause }) => {
  const visible = menu === MenuState.NONE;
  if (!visible) return null;

  return (
    <div className="hud">
      <div className="hud__score">
        {!isCasual && (
          <div className="score-lbl">SCORE: {score.toLocaleString()}</div>
        )}
        <div className="cube-count-lbl" style={{ opacity: isCasual ? 1 : 0.65 }}>
          CUBES: {cubeCount.toLocaleString()}
        </div>
      </div>

      <button
        className="pause-btn"
        onPointerDown={(e) => { e.stopPropagation(); onPause(); }}
        aria-label="Pause"
      >
        <div className="pause-icon">
          <span /><span />
        </div>
      </button>

      {slowmoPercent > 0 && (
        <div className="slowmo">
          <div className="slowmo-label">SLOW-MO</div>
          <div className="slowmo-track">
            <div
              className="slowmo-bar"
              style={{ transform: `scaleX(${slowmoPercent.toFixed(3)})` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
