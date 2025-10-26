import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import * as Tone from 'tone';
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
const tabs = mainTabBar.querySelectorAll('.tab');

function updateActiveTab(tabName) {
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
}

function setOverlayActive(active) {
  overlay.classList.toggle('active', active);
}

function renderTabContent(tabName) {
  updateActiveTab(tabName);
  overlay.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'tab-content';
  overlay.appendChild(content);

  // --- Content by tab ---
  if (tabName === 'projects') {
    const grid = document.createElement('div');
    grid.className = 'project-grid';

    const snakeCard = document.createElement('div');
    snakeCard.className = 'project-card';
    snakeCard.innerHTML = `<h3>Snake</h3><p>Play the classic Snake game!</p>`;

    snakeCard.addEventListener('click', e => {
      e.stopPropagation();
      setOverlayActive(false);
      startSnakeGame();
    });

    const pianoCard = document.createElement('div');
    pianoCard.className = 'project-card';
    pianoCard.innerHTML = `<h3>Piano</h3><p>Play an interactive piano!</p>`;

    pianoCard.addEventListener('click', e => {
      e.stopPropagation();
      setOverlayActive(false);
      startPiano();
    });

    grid.appendChild(snakeCard);
    grid.appendChild(pianoCard);
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
  };

  gameLoop();
}

// ----- Piano -----
function startPiano() {
  const pianoOverlay = document.getElementById('piano-overlay');
  pianoOverlay.style.display = 'flex';

  const closeBtn = document.getElementById('close-piano');
  const pianoKeys = document.getElementById('piano-keys');

  // Clear previous keys if any
  pianoKeys.innerHTML = '';

  // Initialize Tone.js sampler
  const sampler = new Tone.Sampler({
    urls: {
      C4: "C4.mp3",
      "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3",
      A4: "A4.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination();

  // Define C3-C4 octave (white and black keys) with keyboard mappings
  const notes = [
    { note: 'C3', type: 'white', label: 'C', key: 'A' },
    { note: 'C#3', type: 'black', label: 'C#', key: 'W' },
    { note: 'D3', type: 'white', label: 'D', key: 'S' },
    { note: 'D#3', type: 'black', label: 'D#', key: 'E' },
    { note: 'E3', type: 'white', label: 'E', key: 'D' },
    { note: 'F3', type: 'white', label: 'F', key: 'F' },
    { note: 'F#3', type: 'black', label: 'F#', key: 'T' },
    { note: 'G3', type: 'white', label: 'G', key: 'G' },
    { note: 'G#3', type: 'black', label: 'G#', key: 'Y' },
    { note: 'A3', type: 'white', label: 'A', key: 'H' },
    { note: 'A#3', type: 'black', label: 'A#', key: 'U' },
    { note: 'B3', type: 'white', label: 'B', key: 'J' },
    { note: 'C4', type: 'white', label: 'C', key: 'K' }
  ];

  // Create a map from keyboard keys to notes
  const keyToNote = {};
  notes.forEach(({ note, key }) => {
    keyToNote[key.toLowerCase()] = note;
    keyToNote[key.toUpperCase()] = note;
  });

  // Create piano keys
  notes.forEach(({ note, type, label, key }) => {
    const keyDiv = document.createElement('div');
    keyDiv.className = `piano-key ${type}-key`;
    keyDiv.dataset.note = note;

    //const labelSpan = document.createElement('span');
    //labelSpan.textContent = `${label} (${key})`;
    //keyDiv.appendChild(labelSpan);

    // Play note on click
    keyDiv.addEventListener('mousedown', async () => {
      await Tone.start();
      keyDiv.classList.add('active');
      sampler.triggerAttackRelease(note, '8n');
    });

    keyDiv.addEventListener('mouseup', () => {
      keyDiv.classList.remove('active');
    });

    keyDiv.addEventListener('mouseleave', () => {
      keyDiv.classList.remove('active');
    });

    pianoKeys.appendChild(keyDiv);
  });

  // Add keyboard listener for playing notes
  function handlePianoKeyDown(e) {
    const note = keyToNote[e.key];
    if (note) {
      e.preventDefault();
      const keyDiv = pianoKeys.querySelector(`[data-note="${note}"]`);
      if (keyDiv && !keyDiv.classList.contains('active')) {
        Tone.start();
        keyDiv.classList.add('active');
        sampler.triggerAttackRelease(note, '8n');
      }
    }
  }

  function handlePianoKeyUp(e) {
    const note = keyToNote[e.key];
    if (note) {
      const keyDiv = pianoKeys.querySelector(`[data-note="${note}"]`);
      if (keyDiv) {
        keyDiv.classList.remove('active');
      }
    }
  }

  document.addEventListener('keydown', handlePianoKeyDown);
  document.addEventListener('keyup', handlePianoKeyUp);

  closeBtn.onclick = () => {
    document.removeEventListener('keydown', handlePianoKeyDown);
    document.removeEventListener('keyup', handlePianoKeyUp);
    pianoOverlay.style.display = 'none';
  };
}

// ----- Main tab click handling -----
tabs.forEach(tab => {
  tab.addEventListener('click', e => {
    e.stopPropagation();
    const tabName = tab.dataset.tab;
    renderTabContent(tabName);
  });
});

// ----- Close overlay when clicking outside content -----
overlay.addEventListener('click', e => {
  const clickedInsideContent = e.target.closest('.tab-content');

  if (!clickedInsideContent) {
    setOverlayActive(false);
  }
});