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
  if (tabName === 'main') {
    content.innerHTML = `
      <h2>Welcome to Mjukost</h2>
      <p>This is your main dashboard.</p>
    `;
  }
  else if (tabName === 'projects') {
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
      renderSnakeGame(content);
    });

    content.appendChild(grid);
  }
  else if (tabName === 'site') {
    content.innerHTML = `<h2>Site Info</h2><p>Details about this platform and its features.</p>`;
  }
  else if (tabName === 'about') {
    content.innerHTML = `<h2>About</h2><p>Created with ❤️ using MapLibre GL.</p>`;
  }

  setOverlayActive(true);
}

// ----- Snake Game Renderer -----
function renderSnakeGame(container) {
  container.innerHTML = `
    <h2>Snake 🐍</h2>
    <canvas id="snake-canvas" width="400" height="400"></canvas>
    <p>Use arrow keys to move. Eat the food, avoid hitting yourself!</p>
  `;

  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  const tileCount = canvas.width / gridSize;

  let snake = [{ x: 10, y: 10 }];
  let velocity = { x: 0, y: 0 };
  let food = { x: 5, y: 5 };
  let score = 0;

  document.addEventListener('keydown', e => {
    switch (e.key) {
      case 'ArrowUp': if (velocity.y === 0) velocity = { x: 0, y: -1 }; break;
      case 'ArrowDown': if (velocity.y === 0) velocity = { x: 0, y: 1 }; break;
      case 'ArrowLeft': if (velocity.x === 0) velocity = { x: -1, y: 0 }; break;
      case 'ArrowRight': if (velocity.x === 0) velocity = { x: 1, y: 0 }; break;
    }
  });

  function gameLoop() {
    // Move
    const head = { x: snake[0].x + velocity.x, y: snake[0].y + velocity.y };
    snake.unshift(head);

    // Check if snake eats food
    if (head.x === food.x && head.y === food.y) {
      score++;
      food = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount)
      };
    } else {
      snake.pop();
    }

    // Check collisions (walls or self)
    if (
      head.x < 0 || head.y < 0 ||
      head.x >= tileCount || head.y >= tileCount ||
      snake.slice(1).some(s => s.x === head.x && s.y === head.y)
    ) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'red';
      ctx.font = '24px sans-serif';
      ctx.fillText('Game Over!', 140, 200);
      ctx.fillStyle = 'white';
      ctx.fillText(`Score: ${score}`, 160, 240);
      return; // stop loop
    }

    // Draw everything
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = 'red';
    ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize - 2, gridSize - 2);

    // Draw snake
    ctx.fillStyle = 'lime';
    snake.forEach(part => {
      ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2);
    });

    setTimeout(gameLoop, 100);
  }

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
