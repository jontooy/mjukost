import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import './main.css';

// ----- Initialize map -----
const style = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }]
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [0, 20],
  zoom: 2
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// ----- SPA-like UI logic -----
const mainTabBar = document.getElementById('main-tab-bar');
const overlay = document.getElementById('content-overlay');
const template = document.getElementById('tab-bar-template');
const tabs = mainTabBar.querySelectorAll('.tab');

function setOverlayActive(active) {
  document.body.classList.toggle('overlay-active', active);
  overlay.classList.toggle('active', active);
}

function renderTabContent(tabName) {
  overlay.innerHTML = '';

  // Clone the tab bar into overlay
  const clone = template.content.cloneNode(true);
  overlay.appendChild(clone);

  const innerTabs = overlay.querySelectorAll('.tab');
  innerTabs.forEach(innerTab => {
    innerTab.addEventListener('click', e => {
      e.stopPropagation();
      renderTabContent(innerTab.dataset.tab);
    });
  });

  const content = document.createElement('div');
  content.className = 'tab-content';
  overlay.appendChild(content);

  // --- Content by tab ---
  if (tabName === 'projects') {
    // Only one project now: Snake
    const grid = document.createElement('div');
    grid.className = 'project-grid';

    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `<h3>Snake</h3><p>Play the classic Snake game!</p>`;
    grid.appendChild(card);

    // When Snake card is clicked → start the game
    card.addEventListener('click', e => {
      e.stopPropagation();
      setOverlayActive(false); // Close the projects overlay
      startSnakeGame();
    });

    content.appendChild(grid);
  }
  else if (tabName === 'about') {
    content.innerHTML = `<h2>About</h2><p>Created with ❤️ using MapLibre GL.</p>`;
  }

  setOverlayActive(true);
}

// ----- Snake Game -----
let gameLoopId = null;

function startSnakeGame() {
  const snakeOverlay = document.getElementById('snake-overlay');
  const canvas = document.getElementById('snake-game-canvas');
  const gameOverDiv = document.getElementById('snake-game-over');
  const finalScoreDisplay = document.getElementById('snake-final-score');
  const restartBtn = document.getElementById('restart-snake');
  const closeBtn = document.getElementById('close-snake');

  snakeOverlay.style.display = 'flex';
  gameOverDiv.style.display = 'none';
  document.body.classList.add('snake-active');

  // Calculate canvas size to cover entire screen, keeping tiles constant
  const tileSize = 20;
  const tilesX = Math.floor(window.innerWidth / tileSize);
  const tilesY = Math.floor(window.innerHeight / tileSize);

  canvas.width = tilesX * tileSize;
  canvas.height = tilesY * tileSize;

  const ctx = canvas.getContext('2d');

  let snake = [{ x: Math.floor(tilesX / 2), y: Math.floor(tilesY / 2) }];
  let velocity = { x: 0, y: 0 };
  let food = {
    x: Math.floor(Math.random() * tilesX),
    y: Math.floor(Math.random() * tilesY)
  };
  let score = 0;
  let gameActive = true;

  function handleKeyDown(e) {
    if (!gameActive) return;

    switch (e.key) {
      case 'ArrowUp':
        if (velocity.y === 0) velocity = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
        if (velocity.y === 0) velocity = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
        if (velocity.x === 0) velocity = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
        if (velocity.x === 0) velocity = { x: 1, y: 0 };
        break;
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  function gameLoop() {
    if (!gameActive) return;

    // Move
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
    snake.unshift(head);

    // Check if snake eats food
    if (head.x === food.x && head.y === food.y) {
      score++;
      food = {
        x: Math.floor(Math.random() * tilesX),
        y: Math.floor(Math.random() * tilesY)
      };
    } else {
      snake.pop();
    }

    // Check collisions (walls or self)
    if (
      head.x < 0 || head.y < 0 ||
      head.x >= tilesX || head.y >= tilesY ||
      snake.slice(1).some(s => s.x === head.x && s.y === head.y)
    ) {
      gameActive = false;
      document.removeEventListener('keydown', handleKeyDown);
      finalScoreDisplay.textContent = `Score: ${score}`;
      gameOverDiv.style.display = 'block';
      return;
    }

    // Draw everything
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize - 2, tileSize - 2);

    // Draw snake
    snake.forEach((part, index) => {
      if (index === 0) {
        ctx.fillStyle = '#88ff88'; // Lighter head
      } else {
        ctx.fillStyle = '#44ff44';
      }
      ctx.fillRect(part.x * tileSize, part.y * tileSize, tileSize - 2, tileSize - 2);
    });

    gameLoopId = setTimeout(gameLoop, 100);
  }

  restartBtn.onclick = () => {
    gameActive = false;
    if (gameLoopId) clearTimeout(gameLoopId);
    document.removeEventListener('keydown', handleKeyDown);
    startSnakeGame();
  };

  closeBtn.onclick = () => {
    gameActive = false;
    if (gameLoopId) clearTimeout(gameLoopId);
    document.removeEventListener('keydown', handleKeyDown);
    snakeOverlay.style.display = 'none';
    document.body.classList.remove('snake-active');
  };

  gameLoop();
}

// ----- Main tab click handling -----
tabs.forEach(tab => {
  tab.addEventListener('click', e => {
    e.stopPropagation();
    const tabName = tab.dataset.tab;
    renderTabContent(tabName);
  });
});

// ----- Close overlay when clicking outside -----
overlay.addEventListener('click', e => {
  const clickedInsideTabBar = e.target.closest('.tab-bar');
  const clickedInsideContent = e.target.closest('.tab-content');
  const clickedInsideCard = e.target.closest('.project-card');

  if (!clickedInsideTabBar && !clickedInsideContent && !clickedInsideCard) {
    setOverlayActive(false);
  }
});

// Also close if user clicks on the map directly
map.getContainer().addEventListener('click', () => {
  setOverlayActive(false);
});