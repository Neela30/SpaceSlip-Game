import React, { useCallback, useEffect, useMemo, useState } from "react";
import useGameLogic from "./useGameLogic";
import "./Game.css";

const Game = () => {
  const {
    canvasRef,
    rotateLeft,
    rotateRight,
    startFastDrop,
    stopFastDrop,
    startGame,
    restartGame,
    togglePause,
    gameRunning,
    paused,
    gameOver,
    score,
    highScore,
    perfectActive,
    timeToDrop,
    tipMessage,
  } = useGameLogic();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 920px)");
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleStart = useCallback(() => {
    startGame();
  }, [startGame]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        rotateLeft();
      }
      if (
        event.code === "ArrowRight" ||
        event.code === "KeyD" ||
        event.code === "Space"
      ) {
        event.preventDefault();
        rotateRight();
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        startFastDrop();
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        togglePause();
      }
      if (event.code === "Enter" && !gameRunning) {
        event.preventDefault();
        handleStart();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameRunning, handleStart, rotateLeft, rotateRight, startFastDrop, togglePause]);

  useEffect(() => {
    const handleKeyUp = (event) => {
      if (event.code === "ArrowDown") {
        event.preventDefault();
        stopFastDrop();
      }
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, [stopFastDrop]);

  const primaryLabel = useMemo(() => {
    if (gameOver) return "Restart";
    return gameRunning ? "Restart" : "Start";
  }, [gameOver, gameRunning]);

  const pauseLabel = paused ? "Resume" : "Pause";

  const statusText = gameRunning ? (paused ? "Paused" : "Running") : "Ready";

  return (
    <section className={`game-root ${isMobile ? "is-mobile" : "is-desktop"}`}>
      <div className="game-frame">
        {/* LEFT: Brand rail (desktop only) */}
        <aside className="side-rail left-rail" aria-label="Brand">
          <div className="brand-card">
            <div className="brand-mark">PF</div>
            <div className="brand-vertical">
              <div className="brand-title">Perfect Fit</div>
              <div className="brand-subtitle">Rotate. Align. Glide through the gap.</div>
            </div>
          </div>

          <div className="kbd-card">
            <div className="kbd-title">Keys</div>
            <div className="kbd-row">
              <span className="kbd-pill">A / ←</span>
              <span className="kbd-pill">D / → / Space</span>
            </div>
            <div className="kbd-row">
              <span className="kbd-pill">P</span>
              <span className="kbd-hint">Pause/Resume</span>
            </div>
            <div className="kbd-row">
              <span className="kbd-pill">Enter</span>
              <span className="kbd-hint">Start</span>
            </div>
          </div>
        </aside>

        {/* CENTER: Game arena */}
        <div className="arena-wrap">
          {/* MOBILE HUD (top overlay) */}
          {isMobile && (
            <div className="mobile-hud" aria-label="Game HUD">
              <div className="hud-left">
                <div className="hud-chip">
                  <span className="hud-label">Score</span>
                  <span className="hud-value">{score}</span>
                </div>
                <div className="hud-chip">
                  <span className="hud-label">Best</span>
                  <span className="hud-value">{highScore}</span>
                </div>
              </div>

              <div className="hud-right">
                <button
                  className="hud-btn"
                  onClick={togglePause}
                  disabled={!gameRunning || gameOver}
                >
                  {pauseLabel}
                </button>
              </div>
            </div>
          )}

          <div className="game-area arena-tall">
            <canvas ref={canvasRef} className="game-canvas" />

            {perfectActive && <div className="perfect-chip">Solar flare!</div>}

            {!gameRunning && !gameOver && (
              <div className="game-overlay subtle">
                <div className="overlay-inner">
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
                  <div className="overlay-actions">
                    <button className="primary-btn ghost" onClick={restartGame}>
                      Restart
                    </button>
                    <button className="primary-btn" onClick={togglePause}>
                      {pauseLabel}
                    </button>
                  </div>
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
        </div>

        {/* RIGHT: Stats + controls rail (desktop only) */}
        <aside className="side-rail right-rail" aria-label="Controls and stats">
          <div className="stats-card">
            <div className="stat-row">
              <span className="stat-label">Score</span>
              <span className="stat-value">{score}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Best</span>
              <span className="stat-value">{highScore}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Drop ETA</span>
              <span className="stat-value mono">{timeToDrop != null ? `${timeToDrop}s` : "--"}</span>
            </div>

            <div className={`status-pill ${gameRunning ? "status-live" : "status-idle"}`}>
              {statusText}
            </div>
          </div>

          <div className="rail-controls">
            <button
              className="primary-btn"
              onClick={gameOver ? restartGame : handleStart}
            >
              {primaryLabel}
            </button>

            <button
              className="secondary-btn"
              onClick={togglePause}
              disabled={!gameRunning || gameOver}
            >
              {pauseLabel}
            </button>
          </div>

          <div className="rail-note" aria-live="polite">
            {tipMessage}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default Game;

