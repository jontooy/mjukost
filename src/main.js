import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import './main.css';

// Define a basic raster style using OpenStreetMap tiles
const style = {
  version: 8,
  name: 'OSM Raster Style',
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm'
    }
  ]
};

// Initialize the map
const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [0, 20], // [longitude, latitude]
  zoom: 2
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Attribution element (required for OSM)
const attr = document.createElement('div');
attr.className = 'maplibre-attr';
attr.innerHTML = '© OpenStreetMap contributors';
document.body.appendChild(attr);
