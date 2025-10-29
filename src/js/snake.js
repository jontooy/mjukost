import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = "https://wdqxlhioavgcjasfvpmu.supabase.co";
const supabaseKey = "sb_publishable_sFCrXr8mu68TOvAnvMvjjA_2hArQc7J";
const supabase = createClient(supabaseUrl, supabaseKey);

// Game state
let gameLoopId = null;
let highScores = [];

// High score functions using Supabase
async function loadHighScores() {
  try {
    const { data, error } = await supabase
      .from("highscores")
      .select("name, score")
      .order("score", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Failed to load high scores:", error);
      highScores = [];
    } else {
      highScores = data || [];
    }
  } catch (error) {
    console.error("Failed to load high scores:", error);
    highScores = [];
  }
}

function isHighScore(score) {
  return (
    highScores.length < 10 ||
    score > (highScores[highScores.length - 1]?.score || 0)
  );
}

async function addHighScore(name, score) {
  try {
    // Insert new score into Supabase
    const { data, error } = await supabase
      .from("highscores")
      .insert([{ name: name.trim(), score }]);

    if (error) {
      console.error("Failed to save high score:", error);
    } else {
      console.log("High score saved to Supabase!");
      // Reload high scores to get updated list
      await loadHighScores();
    }
  } catch (error) {
    console.error("Failed to save high score:", error);
  }
}

// High score display function
function displayHighScores() {
  const highScoresDiv = document.getElementById("snake-high-scores");
  const highScoresList = document.getElementById("high-scores-list");

  highScoresList.innerHTML = "";

  if (highScores.length === 0) {
    highScoresList.innerHTML = "<p>No high scores yet!</p>";
  } else {
    highScores.forEach((score, index) => {
      const scoreDiv = document.createElement("div");
      scoreDiv.className = "high-score-item";
      scoreDiv.innerHTML = `
        <span class="rank">${index + 1}.</span>
        <span class="name">${score.name}</span>
        <span class="score">${score.score}</span>
      `;
      highScoresList.appendChild(scoreDiv);
    });
  }

  highScoresDiv.style.display = "block";
}

// Main snake game function
export function startSnakeGame() {
  const snakeOverlay = document.getElementById("snake-overlay");
  const canvas = document.getElementById("snake-game-canvas");
  const gameOverDiv = document.getElementById("snake-game-over");
  const finalScoreDisplay = document.getElementById("snake-final-score");
  const restartBtn = document.getElementById("restart-snake");
  const closeBtn = document.getElementById("close-snake");

  snakeOverlay.style.display = "flex";
  gameOverDiv.style.display = "none";

  // Load high scores when game starts
  loadHighScores();

  // Calculate canvas size to cover entire screen, keeping tiles constant
  const tileSize = 20;
  const tilesX = Math.floor(window.innerWidth / tileSize);
  const tilesY = Math.floor(window.innerHeight / tileSize);

  canvas.width = tilesX * tileSize;
  canvas.height = tilesY * tileSize;

  const ctx = canvas.getContext("2d");

  let snake = [{ x: Math.floor(tilesX / 2), y: Math.floor(tilesY / 2) }];
  let velocity = { x: 0, y: 0 };
  let food = {
    x: Math.floor(Math.random() * tilesX),
    y: Math.floor(Math.random() * tilesY),
  };
  let score = 0;
  let gameActive = true;

  function handleKeyDown(e) {
    if (!gameActive) return;

    switch (e.key) {
      case "ArrowUp":
        if (velocity.y === 0) velocity = { x: 0, y: -1 };
        break;
      case "ArrowDown":
        if (velocity.y === 0) velocity = { x: 0, y: 1 };
        break;
      case "ArrowLeft":
        if (velocity.x === 0) velocity = { x: -1, y: 0 };
        break;
      case "ArrowRight":
        if (velocity.x === 0) velocity = { x: 1, y: 0 };
        break;
    }
  }

  document.addEventListener("keydown", handleKeyDown);

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
        y: Math.floor(Math.random() * tilesY),
      };
    } else {
      snake.pop();
    }

    // Check collisions (walls or self)
    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= tilesX ||
      head.y >= tilesY ||
      snake.slice(1).some((s) => s.x === head.x && s.y === head.y)
    ) {
      gameActive = false;
      document.removeEventListener("keydown", handleKeyDown);

      // Check if this is a high score
      if (isHighScore(score)) {
        const playerName = prompt(
          `🎉 New High Score! Score: ${score}\nEnter your name:`
        );
        if (playerName && playerName.trim()) {
          addHighScore(playerName.trim(), score);
        }
      }

      finalScoreDisplay.textContent = `Score: ${score}`;
      gameOverDiv.style.display = "block";
      return;
    }

    // Draw everything
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(
      food.x * tileSize,
      food.y * tileSize,
      tileSize - 2,
      tileSize - 2
    );

    // Draw snake
    snake.forEach((part, index) => {
      if (index === 0) {
        ctx.fillStyle = "#88ff88"; // Lighter head
      } else {
        ctx.fillStyle = "#44ff44";
      }
      ctx.fillRect(
        part.x * tileSize,
        part.y * tileSize,
        tileSize - 2,
        tileSize - 2
      );
    });

    gameLoopId = setTimeout(gameLoop, 100);
  }

  // Event listeners
  restartBtn.onclick = () => {
    gameActive = false;
    if (gameLoopId) clearTimeout(gameLoopId);
    document.removeEventListener("keydown", handleKeyDown);
    startSnakeGame();
  };

  const viewHighScoresBtn = document.getElementById("view-high-scores");
  viewHighScoresBtn.onclick = () => {
    displayHighScores();
  };

  const closeHighScoresBtn = document.getElementById("close-high-scores");
  closeHighScoresBtn.onclick = () => {
    document.getElementById("snake-high-scores").style.display = "none";
  };

  closeBtn.onclick = () => {
    gameActive = false;
    if (gameLoopId) clearTimeout(gameLoopId);
    document.removeEventListener("keydown", handleKeyDown);
    snakeOverlay.style.display = "none";
  };

  gameLoop();
}
