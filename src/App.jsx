import React from 'react';
import Game from './Game';
import './Game.css';

const App = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-mark">PF</div>
        <div className="header-text">
          <h1>Perfect Fit</h1>
          <p>Rotate. Align. Glide through the gap.</p>
        </div>
      </header>

      <main className="main-stage">
        <Game />
      </main>

      <footer className="app-footer">
        Built to feel premium on desktop and mobile. Tap, rotate, and chase the perfect pass.
      </footer>
    </div>
  );
};

export default App;
