export const createKeyHandler = ({ rotateLeft, rotateRight, togglePause, startGame, gameRunning }) => {
  return (event) => {
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
      event.preventDefault();
      startGame();
    }
  };
};
