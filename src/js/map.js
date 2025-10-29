import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

// Map configuration and initialization
const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-layer", type: "raster", source: "osm" }],
};

// Initialize and export the map
export const map = new maplibregl.Map({
  container: "map",
  style,
  center: [0, 20],
  zoom: 2,
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), "top-right");
