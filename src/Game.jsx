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
    handleTapControl,
    soundOn,
    toggleSound,
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

  const START_TIP_TEXT =
    "Rotate with A/D, left/right arrows or Space (or tap the side arrows), then slide through the glowing gap.";

  const [mobileTipVisible, setMobileTipVisible] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    if (!tipMessage) {
      setMobileTipVisible(false);
      return;
    }
    setMobileTipVisible(true);
    const id = setTimeout(() => setMobileTipVisible(false), 2000);
    return () => clearTimeout(id);
  }, [isMobile, tipMessage]);

  const MobileKeyList = () => (
    <div className="mobile-key-list" aria-label="Mobile controls">
      <div className="mobile-key-row">
        <span className="mobile-key-pill">Tap left of shape</span>
        <span className="mobile-key-hint">Move left</span>
      </div>
      <div className="mobile-key-row">
        <span className="mobile-key-pill">Tap right of shape</span>
        <span className="mobile-key-hint">Move right</span>
      </div>
      <div className="mobile-key-row">
        <span className="mobile-key-pill">Tap below shape</span>
        <span className="mobile-key-hint">Fast drop</span>
      </div>
    </div>
  );

  const MobileBrand = () => (
    <div className="mobile-brand-card" aria-label="SpaceSlip brand">
      <div className="mobile-brand-mark">SS</div>
      <div className="mobile-brand-text">
        <div className="mobile-brand-title">SpaceSlip</div>
        <div className="mobile-brand-subtitle">Rotate. Align. Glide through the gap.</div>
      </div>
    </div>
  );

  const handleCanvasTap = useCallback(
    (clientX, clientY) => {
      if (!isMobile) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      handleTapControl(clientX, clientY, rect);
    },
    [canvasRef, handleTapControl, isMobile]
  );

  const handleTouchStart = useCallback(
    (event) => {
      if (!isMobile || !event.touches || event.touches.length === 0) return;
      const touch = event.touches[0];
      handleCanvasTap(touch.clientX, touch.clientY);
    },
    [handleCanvasTap, isMobile]
  );

  const handleClick = useCallback(
    (event) => {
      if (!isMobile) return;
      handleCanvasTap(event.clientX, event.clientY);
    },
    [handleCanvasTap, isMobile]
  );

  return (
    <section className={`game-root ${isMobile ? "is-mobile" : "is-desktop"}`}>
      <div className="game-frame">
        {/* LEFT: Brand rail (desktop only) */}
        <aside className="side-rail left-rail" aria-label="Brand">
          <div className="brand-card">
            <div className="brand-mark">SS</div>
            <div className="brand-vertical">
              <div className="brand-title">SpaceSlip</div>
              <div className="brand-subtitle">Rotate. Align. Glide through the gap.</div>
            </div>
          </div>

          <div className="kbd-card">
            <div className="kbd-title">Keys</div>
            <div className="kbd-row">
              <span className="kbd-pill">A / Left</span>
              <span className="kbd-pill">D / Right / Space</span>
            </div>
            <div className="kbd-row">
              <span className="kbd-pill">Down Arrow</span>
              <span className="kbd-hint">Fast drop</span>
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
                  <span className="hud-label">Time to Impact</span>
                  <span className="hud-value mono">{timeToDrop != null ? `${timeToDrop}s` : "--"}</span>
                </div>
              </div>

              <div className="hud-right">
                <button className="hud-btn" onClick={toggleSound}>
                  {soundOn ? "🔊" : "🔇"}
                </button>
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

          {isMobile && mobileTipVisible && (
            <div className="mobile-tip-pop" aria-live="polite">
              {tipMessage}
            </div>
          )}

          <div className="game-area arena-tall">
            <canvas
              ref={canvasRef}
              className="game-canvas"
              onClick={isMobile ? undefined : handleClick}
              onTouchStart={isMobile ? handleTouchStart : undefined}
            />

            {perfectActive && <div className="perfect-chip">Solar flare!</div>}

            {!gameRunning && !gameOver && (
              <div className="game-overlay subtle">
                <div className="overlay-inner">
                  {isMobile && (
                    <div className="mobile-brand-wrapper">
                      <MobileBrand />
                    </div>
                  )}
                  <button className="primary-btn" onClick={handleStart}>
                    Start
                  </button>
                  {isMobile && <MobileKeyList />}
                </div>
              </div>
            )}

            {paused && !gameOver && (
              <div className="game-overlay subtle">
                <div className="overlay-inner">
                  {isMobile && (
                    <div className="mobile-brand-wrapper">
                      <MobileBrand />
                    </div>
                  )}
                  <h3>Paused</h3>
                  <div className="overlay-actions">
                    <button className="primary-btn ghost" onClick={restartGame}>
                      Restart
                    </button>
                    <button className="primary-btn" onClick={togglePause}>
                      {pauseLabel}
                    </button>
                  </div>
                  {isMobile && <MobileKeyList />}
                </div>
              </div>
            )}

            {gameOver && (
              <div className="game-overlay gameover">
                <div className="overlay-inner">
                  {isMobile && (
                    <div className="mobile-brand-wrapper">
                      <MobileBrand />
                    </div>
                  )}
                  <p className="eyebrow">Game Over</p>
                  <h3>Score {score}</h3>
                  <p className="overlay-copy">Best {highScore}</p>
                  <div className="overlay-actions">
                    <button className="primary-btn" onClick={restartGame}>
                      Restart
                    </button>
                  </div>
                  {isMobile && <MobileKeyList />}
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
              <span className="stat-label">Time to Impact</span>
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

            <button className="secondary-btn" onClick={toggleSound}>
              {soundOn ? "🔊 Sound" : "🔇 Sound"}
            </button>
          </div>

          {tipMessage && (
            <div className="rail-note" aria-live="polite">
              {tipMessage}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default Game;

