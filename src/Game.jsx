import React, { useEffect, useState } from 'react';
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
    perfectActive
  } = useGameLogic();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
        startGame();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameRunning, rotateLeft, rotateRight, startGame, togglePause]);

  const primaryLabel = gameRunning ? 'Restart' : gameOver ? 'Restart' : 'Start';
  const pauseLabel = paused ? 'Resume' : 'Pause';

  return (
    <section className={`game-card ${isMobile ? 'mobile-card' : ''}`}>
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
      </div>

      <div className="game-shell">
        <div className="game-area">
          <canvas ref={canvasRef} className="game-canvas" />

          <div className="floating-score">Score {score}</div>
          {perfectActive && <div className="perfect-chip">Perfect!</div>}

          {!gameRunning && !gameOver && (
            <div className="game-overlay">
              <div className="overlay-inner">
                <p className="eyebrow">Timing-based casual</p>
                <h3>Rotate to slip through</h3>
                <p className="overlay-copy">
                  {isMobile
                    ? 'Mobile mode: tap Rotate Left/Right to roll the shape toward the gap. Shapes cycle circle → square → rectangle → triangle. Gap drifts and shrinks each score.'
                    : 'Desktop mode: roll with ←/A (left) or →/D/Space (right). Shapes cycle circle → square → rectangle → triangle. Gap drifts and shrinks each score.'}
                </p>
                <button className="primary-btn" onClick={startGame}>
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
          <button className="primary-btn" onClick={gameOver ? restartGame : startGame}>
            {primaryLabel}
          </button>
          <button className="secondary-btn" onClick={togglePause} disabled={!gameRunning || gameOver}>
            {pauseLabel}
          </button>
        </div>

        <div className="rotate-row">
          <button className="rotate-btn ghost" onClick={rotateLeft} disabled={!gameRunning || paused || gameOver}>
            Rotate Left (← / A)
          </button>
          <button className="rotate-btn" onClick={rotateRight} disabled={!gameRunning || paused || gameOver}>
            Rotate Right (→ / D / Space)
          </button>
        </div>

        <div className="hint-row">
          <span className="pill muted">Desktop: ←/A rolls left • →/D/Space rolls right • P to pause</span>
          <span className="pill">Mobile: Tap Rotate Left/Right to roll toward the gap</span>
          <span>Shapes cycle circle → square → rectangle → triangle; gap starts wide and shrinks.</span>
        </div>
      </div>
    </section>
  );
};

export default Game;
