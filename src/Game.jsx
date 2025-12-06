import React, { useCallback, useEffect, useState } from 'react';
import useGameLogic from './useGameLogic';
import './Game.css';

const Game = () => {
  const {
    canvasRef,
    rotateLeft,
    rotateRight,
    startGame,
    restartGame,
    togglePause,
    gameRunning,
    paused,
    gameOver,
    score,
    highScore,
    perfectActive,
    timeToDrop
  } = useGameLogic();

  const [isMobile, setIsMobile] = useState(false);
  const [oneHanded, setOneHanded] = useState(() => localStorage.getItem('pf-one-hand') === '1');
  const [tutorialSeen, setTutorialSeen] = useState(() => localStorage.getItem('pf-seen-tutorial') === '1');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleStart = useCallback(() => {
    if (!tutorialSeen) {
      localStorage.setItem('pf-seen-tutorial', '1');
      setTutorialSeen(true);
    }
    startGame();
  }, [startGame, tutorialSeen]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        rotateLeft();
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD' || event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        rotateRight();
      }
      if (event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'Enter' && !gameRunning) {
        handleStart();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameRunning, handleStart, rotateLeft, rotateRight, togglePause]);

  const primaryLabel = gameRunning ? 'Restart' : gameOver ? 'Restart' : 'Start';
  const pauseLabel = paused ? 'Resume' : 'Pause';

  return (
    <section className={`game-card ${isMobile ? 'mobile-card' : ''} ${oneHanded ? 'one-hand' : ''}`}>
      <div className="game-meta">
        <div className={`status-pill ${gameRunning ? 'status-live' : 'status-idle'}`}>
          {gameRunning ? (paused ? 'Paused' : 'Running') : 'Ready'}
        </div>
        <div className="score-stack">
          <span className="label">Score</span>
          <span className="value">{score}</span>
        </div>
        <div className="score-stack">
          <span className="label">Best</span>
          <span className="value">{highScore}</span>
        </div>
        <div className="score-stack eta">
          <span className="label">Drop ETA</span>
          <span className="value">{timeToDrop != null ? `${timeToDrop}s` : '--'}</span>
        </div>
        <button
          className="pill toggle"
          onClick={() => {
            const next = !oneHanded;
            setOneHanded(next);
            localStorage.setItem('pf-one-hand', next ? '1' : '0');
          }}
        >
          {oneHanded ? 'One-hand: ON' : 'One-hand: OFF'}
        </button>
      </div>

      <div className="game-shell">
        <div className="game-area">
          <canvas ref={canvasRef} className="game-canvas" />

          <div className="floating-score">Score {score}</div>
          {perfectActive && <div className="perfect-chip">Solar flare!</div>}

          {!gameRunning && !gameOver && (
            <div className="game-overlay">
              <div className="overlay-inner">
                <p className="eyebrow">Timing-based casual</p>
                <h3>Rotate to slip through</h3>
                <p className="overlay-copy">
                  {isMobile
                    ? 'Mobile: tap Rotate Left/Right to roll toward the gap. Shapes cycle circle -> square -> rectangle -> triangle. Gap drifts and shrinks each score.'
                    : 'Desktop: roll with ArrowLeft/A (left) or ArrowRight/D/Space (right). Shapes cycle circle -> square -> rectangle -> triangle. Gap drifts and shrinks each score.'}
                </p>
                {!tutorialSeen && (
                  <div className="micro-tutorial">
                    <span>🎯 Align with the gap</span>
                    <span>💫 Rotate to roll sideways</span>
                    <span>✨ Perfect fit triggers a ribbon</span>
                  </div>
                )}
                <button className="primary-btn" onClick={handleStart}>
                  Start
                </button>
              </div>
            </div>
          )}

          {paused && !gameOver && (
            <div className="game-overlay subtle">
              <div className="overlay-inner">
                <h3>Paused</h3>
                <p className="overlay-copy">Take a breather, the shape will hold.</p>
                <button className="primary-btn ghost" onClick={togglePause}>
                  {pauseLabel}
                </button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="game-overlay gameover">
              <div className="overlay-inner">
                <p className="eyebrow">Game Over</p>
                <h3>Score {score}</h3>
                <p className="overlay-copy">Best {highScore}</p>
                <div className="overlay-actions">
                  <button className="primary-btn" onClick={restartGame}>
                    Restart
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="controls-row">
          <button className="primary-btn" onClick={gameOver ? restartGame : handleStart}>
            {primaryLabel}
          </button>
          <button className="secondary-btn" onClick={togglePause} disabled={!gameRunning || gameOver}>
            {pauseLabel}
          </button>
        </div>

        <div className={`rotate-row ${oneHanded ? 'stacked' : ''}`}>
          <button className="rotate-btn ghost" onClick={rotateLeft} disabled={!gameRunning || paused || gameOver}>
            {'Rotate Left (<- / A)'}
          </button>
          <button className="rotate-btn" onClick={rotateRight} disabled={!gameRunning || paused || gameOver}>
            {'Rotate Right (-> / D / Space)'}
          </button>
        </div>

        <div className="hint-row">
          <span className="pill muted">{'⌨️ <- / A rolls left · -> / D / Space rolls right · P pause'}</span>
          <span className="pill">📱 Tap Rotate Left/Right · One-hand stacks controls</span>
          <span className="pill">🎁 Perfect = ribbon + particles</span>
        </div>
      </div>
    </section>
  );
};

export default Game;
