import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import './main.css';

// ----- Initialize the map -----
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
const mainTabBar = document.getElementById('main-tab-bar'); // your fixed top slide tab bar
const overlay = document.getElementById('content-overlay'); // dynamic content overlay
const template = document.getElementById('tab-bar-template'); // hidden template for tab bar reuse
const tabs = mainTabBar.querySelectorAll('.tab');

function setOverlayActive(active) {
  document.body.classList.toggle('overlay-active', active);
  overlay.classList.toggle('active', active);
}

// render tab content dynamically inside overlay
function renderTabContent(tabName) {
  overlay.innerHTML = ''; // clear overlay

  // clone tab bar into overlay so user can always navigate
  const clone = template.content.cloneNode(true);
  overlay.appendChild(clone);

  const innerTabs = overlay.querySelectorAll('.tab');
  innerTabs.forEach(innerTab => {
    innerTab.addEventListener('click', () => {
      renderTabContent(innerTab.dataset.tab);
    });
  });

  // container for tab body
  const content = document.createElement('div');
  content.className = 'tab-content';
  overlay.appendChild(content);

  // fill content depending on tabName
  if (tabName === 'projects') {
    const projects = [
      { name: 'Urban Map Upgrade', desc: 'Improving OSM layer detail' },
      { name: 'Hydrology Viewer', desc: 'Mapping global water systems' },
      { name: 'Transport Insights', desc: 'Analyzing movement networks' },
      { name: 'Climate Layers', desc: 'Visualizing weather data' }
    ];

    const grid = document.createElement('div');
    grid.className = 'project-grid';

    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `<h3>${p.name}</h3><p>${p.desc}</p>`;
      card.addEventListener('click', () => {
        alert(`You selected: ${p.name}`);
      });
      grid.appendChild(card);
    });

    content.appendChild(grid);
  }
  else if (tabName === 'about') {
    content.innerHTML = `<h2>About</h2><p>Created with ❤️ using MapLibre GL and OpenStreetMap data.</p>`;
  }

  // activate overlay
  setOverlayActive(true);
}

// click handling on main slide bar
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    renderTabContent(tabName);
  });
});

// optional: close overlay if clicking outside (on map)
map.getContainer().addEventListener('click', () => {
  setOverlayActive(false);
});
