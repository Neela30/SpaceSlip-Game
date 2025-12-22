import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import useGameLogic from "./useGameLogic";
import "./Game.css";

const TOKEN_KEY = "spaceslip_token";
const GUEST_PROFILE_KEY = "spaceslip_guest_profile";

const Game = () => {
  const [pendingScore, setPendingScore] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [guestProfile, setGuestProfile] = useState(() => {
    try {
      const raw = localStorage.getItem(GUEST_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn("Unable to read guest profile", error);
      return null;
    }
  });
  const [user, setUser] = useState(null);
  const [authVisible, setAuthVisible] = useState(
    !localStorage.getItem(TOKEN_KEY) && !localStorage.getItem(GUEST_PROFILE_KEY)
  );
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [leaderboardTop5Raw, setLeaderboardTop5Raw] = useState([]);
  const [leaderboardTop50Raw, setLeaderboardTop50Raw] = useState([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [runSession, setRunSession] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);

  const {
    canvasRef,
    rotateLeft,
    rotateRight,
    startFastDrop,
    stopFastDrop,
    handleTapControl,
    soundOn,
    toggleSound,
    startGame: startGameInternal,
    restartGame: restartGameInternal,
    togglePause,
    gameRunning,
    paused,
    gameOver,
    score,
    highScore,
    perfectActive,
    timeToDrop,
    tipMessage,
    syncHighScore
  } = useGameLogic({ onGameOver: setPendingScore });

  const [isMobile, setIsMobile] = useState(false);
  const isAuthenticated = Boolean(token);
  const bestScoreDisplay = user?.bestScore ?? guestProfile?.bestScore ?? highScore;

  const decorateLeaderboard = useCallback(
    (entries = []) => {
      const normalized = (entries || [])
        .filter((entry) => entry && typeof entry.username === "string")
        .map((entry, idx) => ({
          username: entry.username.trim(),
          score: Number(entry.score) || 0,
          rank: entry.rank ?? idx + 1
        }));

      const deduped = new Map();
      normalized.forEach((entry) => {
        const key = entry.username.toLowerCase();
        const existing = deduped.get(key);
        const best = existing ? Math.max(existing.score, entry.score) : entry.score;
        deduped.set(key, { ...entry, score: best });
      });

      if (guestProfile?.username) {
        const guestScore = Number(guestProfile.bestScore || 0);
        if (guestScore > 0) {
          const guestName = String(guestProfile.username);
          deduped.set(guestName.trim().toLowerCase(), {
            username: guestName,
            score: guestScore,
            isGuest: true
          });
        }
      }

      return Array.from(deduped.values())
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    },
    [guestProfile]
  );

  const leaderboardTop5 = useMemo(
    () => decorateLeaderboard(leaderboardTop5Raw),
    [decorateLeaderboard, leaderboardTop5Raw]
  );
  const leaderboardTop50 = useMemo(
    () => decorateLeaderboard(leaderboardTop50Raw),
    [decorateLeaderboard, leaderboardTop50Raw]
  );
  const sidebarLeaderboard = useMemo(
    () => leaderboardTop5.filter((entry) => !entry.isGuest).slice(0, 3),
    [leaderboardTop5]
  );

  useEffect(() => {
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const mq = window.matchMedia("(max-width: 920px)");
    const handler = () => setIsMobile(hasTouch && mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const refreshTop5 = useCallback(async () => {
    try {
      const data = await api.leaderboardTop5();
      setLeaderboardTop5Raw(data.entries || []);
    } catch (error) {
      setStatusMessage((prev) => prev || "Unable to load leaderboard");
    }
  }, []);

  const loadTop50 = useCallback(async () => {
    try {
      const data = await api.leaderboardTop50();
      setLeaderboardTop50Raw(data.entries || []);
    } catch (error) {
      setStatusMessage((prev) => prev || "Unable to load leaderboard");
    }
  }, []);

  useEffect(() => {
    refreshTop5();
  }, [refreshTop5]);

  useEffect(() => {
    if (leaderboardOpen) {
      loadTop50();
    }
  }, [leaderboardOpen, loadTop50]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .me(token)
      .then((data) => {
        if (cancelled) return;
        setUser(data);
        syncHighScore(data.bestScore ?? 0);
        setAuthVisible(false);
      })
      .catch(() => {
        if (cancelled) return;
        setToken("");
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setAuthVisible(true);
        setStatusMessage("Session expired, please log in again.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, syncHighScore]);

  const generateGuestId = useCallback(() => {
    const num = Math.floor(Math.random() * 999) + 1;
    return `guest${String(num).padStart(3, "0")}`;
  }, []);

  const persistGuestProfile = useCallback((profile) => {
    try {
      localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn("Unable to persist guest profile", error);
    }
  }, []);

  const activateGuestProfile = useCallback(
    (profile) => {
      const normalized = {
        username: profile?.username || generateGuestId(),
        bestScore: Math.max(0, Number(profile?.bestScore) || 0),
        isGuest: true
      };
      persistGuestProfile(normalized);
      setGuestProfile(normalized);
      setUser(normalized);
      setToken("");
      localStorage.removeItem(TOKEN_KEY);
      setRunSession(null);
      setPendingScore(null);
      syncHighScore(normalized.bestScore);
      setAuthVisible(false);
      setStatusMessage("");
      setAuthError("");
    },
    [generateGuestId, persistGuestProfile, syncHighScore]
  );

  const handleGuestPlay = useCallback(() => {
    const profile = { username: generateGuestId(), bestScore: 0, isGuest: true };
    activateGuestProfile(profile);
    setAuthForm({ username: "", password: "", confirmPassword: "" });
  }, [activateGuestProfile, generateGuestId]);

  const updateGuestScore = useCallback(
    (score) => {
      const bestScore = Math.max(0, Number(score) || 0, Number(guestProfile?.bestScore || 0));
      const profile = guestProfile?.username
        ? { ...guestProfile, bestScore, isGuest: true }
        : { username: generateGuestId(), bestScore, isGuest: true };
      activateGuestProfile(profile);
    },
    [activateGuestProfile, generateGuestId, guestProfile]
  );

  useEffect(() => {
    if (token || !guestProfile) return;
    if (user?.username === guestProfile.username) return;
    activateGuestProfile(guestProfile);
  }, [activateGuestProfile, guestProfile, token, user]);

  useEffect(() => {
    if (!authVisible && !token && !user && !guestProfile) {
      handleGuestPlay();
    }
  }, [authVisible, guestProfile, handleGuestPlay, token, user]);

  const prepareRun = useCallback(async () => {
    setPendingScore(null);
    if (!isAuthenticated) {
      setRunSession(null);
      return true;
    }
    try {
      const result = await api.startRun(token);
      setRunSession(result);
      return true;
    } catch (error) {
      setStatusMessage(error.message || "Could not start run");
      setRunSession(null);
      if ((error.message || "").toLowerCase().includes("unauthorized")) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
        setAuthVisible(true);
      }
      return false;
    }
  }, [isAuthenticated, token]);

  const handleStart = useCallback(async () => {
    const ok = await prepareRun();
    if (!ok) return;
    startGameInternal();
  }, [prepareRun, startGameInternal]);

  const handleRestart = useCallback(async () => {
    const ok = await prepareRun();
    if (!ok) return;
    restartGameInternal();
  }, [prepareRun, restartGameInternal]);

  const submitRun = useCallback(
    async (finalScore) => {
      if (!runSession || !token) return;
      if (runSession.expiresAt && Date.now() > Number(runSession.expiresAt)) {
        setStatusMessage("Run expired before submission.");
        setRunSession(null);
        setPendingScore(null);
        return;
      }
      setSubmittingScore(true);
      try {
        const result = await api.finishRun(token, {
          runId: runSession.runId,
          score: finalScore,
          signature: runSession.signature
        });
        if (result.bestScore != null) {
          syncHighScore(result.bestScore);
          setUser((prev) => (prev ? { ...prev, bestScore: result.bestScore } : prev));
        }
        if (Array.isArray(result.leaderboardTop5)) {
          setLeaderboardTop5Raw(result.leaderboardTop5);
        } else {
          refreshTop5();
        }
      } catch (error) {
        setStatusMessage(error.message || "Failed to submit score");
        if ((error.message || "").toLowerCase().includes("unauthorized")) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setUser(null);
          setAuthVisible(true);
        }
      } finally {
        setSubmittingScore(false);
        setRunSession(null);
        setPendingScore(null);
      }
    },
    [runSession, token, syncHighScore, refreshTop5]
  );

  useEffect(() => {
    if (pendingScore == null) return;
    if (user?.isGuest) {
      updateGuestScore(pendingScore);
      setPendingScore(null);
      return;
    }
    if (!token || !runSession) {
      setPendingScore(null);
      return;
    }
    submitRun(pendingScore);
  }, [pendingScore, token, runSession, submitRun, updateGuestScore, user]);

  const handleAuthSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();
      setAuthError("");
      setStatusMessage("");
      if (authMode === "register" && authForm.password.length < 5) {
        setAuthError("Please use at least 5 characters for your password.");
        return;
      }
      setAuthLoading(true);
      try {
        const payload = {
          username: authForm.username.trim(),
          password: authForm.password
        };
        if (authMode === "register") {
          payload.confirmPassword = authForm.confirmPassword;
        }
        const response = authMode === "login" ? await api.login(payload) : await api.register(payload);
        const nextToken = response.token;
        const nextUser = response.user;
        setToken(nextToken);
        localStorage.setItem(TOKEN_KEY, nextToken);
        setUser(nextUser);
        syncHighScore(nextUser.bestScore ?? 0);
        setAuthVisible(false);
        setAuthForm({ username: "", password: "", confirmPassword: "" });
        refreshTop5();
      } catch (error) {
        const message = (error.message || "Authentication failed").toString();
        if (message.toLowerCase().includes("invalid credentials")) {
          setAuthError("User not found. Please register first.");
        } else {
          setAuthError(message);
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [authForm, authMode, refreshTop5, syncHighScore]
  );

  const handleLogout = useCallback(() => {
    setToken("");
    setRunSession(null);
    setPendingScore(null);
    localStorage.removeItem(TOKEN_KEY);
    if (guestProfile) {
      const normalizedGuest = {
        username: guestProfile.username,
        bestScore: Number(guestProfile.bestScore || 0),
        isGuest: true
      };
      setUser(normalizedGuest);
      syncHighScore(normalizedGuest.bestScore);
      setAuthVisible(false);
    } else {
      setUser(null);
      setAuthVisible(true);
    }
  }, [guestProfile, syncHighScore]);

  const handleOpenLeaderboard = useCallback(() => setLeaderboardOpen(true), []);
  const handleCloseLeaderboard = useCallback(() => setLeaderboardOpen(false), []);
  const safeUsername = user?.username || guestProfile?.username || "Guest";

  useEffect(() => {
    const handleKey = (event) => {
      const el = document.activeElement;
      const isTyping =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      if (isTyping) return;

      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        rotateLeft();
      }
      if (event.code === "ArrowRight" || event.code === "KeyD" || event.code === "Space") {
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

          <div className="leaderboard-card">
            <div className="leaderboard-header">
              <div>
                <div className="leaderboard-title">Top 3</div>
                <div className="leaderboard-subtitle">Registered players</div>
              </div>
              <button className="link-btn" onClick={handleOpenLeaderboard}>
                View full leaderboard
              </button>
            </div>
            <div className="leaderboard-list" aria-label="Top 3 leaderboard">
              {sidebarLeaderboard.length === 0 && <div className="leaderboard-empty">No registered scores yet</div>}
              {sidebarLeaderboard.map((entry) => (
                <div className="leaderboard-row" key={entry.rank}>
                  <span className="lb-rank">#{entry.rank}</span>
                  <span className="lb-name">{entry.isGuest ? `${entry.username} (Guest)` : entry.username}</span>
                  <span className="lb-score">{entry.score}</span>
                </div>
              ))}
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
                  <span className="hud-value">{bestScoreDisplay}</span>
                </div>
                <div className="hud-chip">
                  <span className="hud-label">Time to Impact</span>
                  <span className="hud-value mono">{timeToDrop != null ? `${timeToDrop}s` : "--"}</span>
                </div>
              </div>

              <div className="hud-right">
                <button className="hud-btn" onClick={toggleSound}>
                  {soundOn ? "Sound On" : "Sound Off"}
                </button>
                <button
                  className="hud-btn"
                  onClick={togglePause}
                  disabled={!gameRunning || gameOver}
                >
                  {pauseLabel}
                </button>
                <button className="hud-btn ghost" onClick={handleOpenLeaderboard}>
                  Leaderboard
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
                    <button className="primary-btn ghost" onClick={handleRestart}>
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
                  <p className="overlay-copy">Best {bestScoreDisplay}</p>
                  <div className="overlay-actions">
                    <button className="primary-btn" onClick={handleRestart}>
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
          <div className="player-card">
            <div>
              <div className="player-label">Player</div>
              <div className="player-name">{safeUsername}</div>
              <div className="player-meta">Best {bestScoreDisplay}</div>
            </div>
            <div className="player-actions">
              {isAuthenticated ? (
                <button className="link-btn" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                <button className="link-btn" onClick={() => setAuthVisible(true)}>
                  Login / Register
                </button>
              )}
            </div>
          </div>

          <div className="stats-card">
            <div className="stat-row">
              <span className="stat-label">Score</span>
              <span className="stat-value">{score}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Best</span>
              <span className="stat-value">{bestScoreDisplay}</span>
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
              onClick={gameOver ? handleRestart : handleStart}
              disabled={submittingScore}
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
              {soundOn ? "Sound On" : "Sound Off"}
            </button>
          </div>

          {submittingScore && (
            <div className="rail-note" aria-live="polite">
              Submitting score...
            </div>
          )}

          {statusMessage && (
            <div className="rail-note warning" aria-live="polite">
              {statusMessage}
            </div>
          )}

          {tipMessage && (
            <div className="rail-note" aria-live="polite">
              {tipMessage}
            </div>
          )}
        </aside>
      </div>

      {authVisible && (
        <div className="modal-backdrop" onClick={() => setAuthVisible(false)} role="dialog" aria-modal="true">
          <div className="modal-panel auth-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-hero">
              <p className="eyebrow">SpaceSlip</p>
              <h2>Welcome, pilot.</h2>
              <p className="auth-hero-sub">Sign in to save scores and climb the leaderboard.</p>
            </div>
            <div className="modal-header">
              <h3>{authMode === "login" ? "Login" : "New Player / Register"}</h3>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`tab-btn ${authMode === "login" ? "active" : ""}`}
                  onClick={() => setAuthMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`tab-btn ${authMode === "register" ? "active" : ""}`}
                  onClick={() => setAuthMode("register")}
                >
                  New Player / Register
                </button>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>Username</span>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={(e) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      username: e.target.value
                    }))
                  }
                  maxLength={20}
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  minLength={authMode === "register" ? 5 : undefined}
                  required
                />
              </label>
              {authMode === "register" && (
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    minLength={5}
                    required
                  />
                </label>
              )}
              {authError && <div className="form-error">{authError}</div>}
              <div className="auth-actions">
                <button type="submit" className="primary-btn" disabled={authLoading}>
                  {authLoading ? "Working..." : authMode === "login" ? "Login" : "Register"}
                </button>
                <button type="button" className="secondary-btn ghost" onClick={handleGuestPlay}>
                  Play as guest
                </button>
              </div>
              <p className="auth-footnote">Scores save to your account and power the leaderboard.</p>
            </form>
          </div>
        </div>
      )}

      {leaderboardOpen && (
        <div className="modal-backdrop" onClick={handleCloseLeaderboard} role="dialog" aria-modal="true">
          <div className="modal-panel leaderboard-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Top 50</h3>
              <button className="link-btn" onClick={handleCloseLeaderboard}>
                Close
              </button>
            </div>
            <div className="leaderboard-table" aria-label="Top 50 leaderboard">
              {leaderboardTop50.length === 0 && <div className="leaderboard-empty">No scores yet</div>}
              {leaderboardTop50.map((row) => (
                <div className="leaderboard-row" key={`lb-${row.rank}`}>
                  <span className="lb-rank">#{row.rank}</span>
                  <span className="lb-name">{row.isGuest ? `${row.username} (Guest)` : row.username}</span>
                  <span className="lb-score">{row.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Game;
