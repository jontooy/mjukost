// Main application entry point
import "../css/main.css";
import "./map.js"; // Initialize map
import { startSnakeGame } from "./snake.js";
import { startPiano } from "./piano.js";

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Initialize UI components
  initializeUI();
});

// UI component for handling navigation and overlays
function initializeUI() {
  const mainTabBar = document.getElementById("main-tab-bar");
  const overlay = document.getElementById("content-overlay");
  const tabs = mainTabBar.querySelectorAll(".tab");

  function updateActiveTab(tabName) {
    tabs.forEach((tab) => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }

  function setOverlayActive(active) {
    overlay.classList.toggle("active", active);
  }

  function renderTabContent(tabName) {
    updateActiveTab(tabName);
    overlay.innerHTML = "";

    const content = document.createElement("div");
    content.className = "tab-content";
    overlay.appendChild(content);

    // --- Content by tab ---
    if (tabName === "projects") {
      const grid = document.createElement("div");
      grid.className = "project-grid";

      const snakeCard = document.createElement("div");
      snakeCard.className = "project-card";
      snakeCard.innerHTML = `<h3>Snake</h3><p>Play the classic Snake game!</p>`;

      snakeCard.addEventListener("click", (e) => {
        e.stopPropagation();
        setOverlayActive(false);
        startSnakeGame();
      });

      const pianoCard = document.createElement("div");
      pianoCard.className = "project-card";
      pianoCard.innerHTML = `<h3>Piano</h3><p>Play an interactive piano!</p>`;

      pianoCard.addEventListener("click", (e) => {
        e.stopPropagation();
        setOverlayActive(false);
        startPiano();
      });

      grid.appendChild(snakeCard);
      grid.appendChild(pianoCard);
      content.appendChild(grid);
    } else if (tabName === "about") {
      content.innerHTML = `<h2>About</h2><p>Created with ❤️ using MapLibre GL.</p>`;
    }

    setOverlayActive(true);
  }

  // Main tab click handling
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      const tabName = tab.dataset.tab;
      renderTabContent(tabName);
    });
  });

  // Close overlay when clicking outside content
  overlay.addEventListener("click", (e) => {
    const clickedInsideContent = e.target.closest(".tab-content");

    if (!clickedInsideContent) {
      setOverlayActive(false);
    }
  });
}
