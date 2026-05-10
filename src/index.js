import 'regenerator-runtime/runtime';
import mapboxgl from 'mapbox-gl';
import Fuse from 'fuse.js';
import railData from './vn-rail.geo.json';
import stationsData from './stations.json';
import { getCurrentLanguage, setLanguage, t } from './i18n.js';

const $ = (id) => document.getElementById(id);
let stationsDataGlobal = null;
let fuse = null;
const $home = $('home');
const $btnCloseHome = $('btn-close-home');
const $station = $('station');
const $search = $('search');
const $searchField = $('search-field');
const $searchCancel = $('search-cancel');
const $searchResults = $('search-results');
const $langToggle = $('lang-toggle');
const $langText = $('lang-text');

// Close home panel
$btnCloseHome.onclick = (e) => {
  e.preventDefault();
  $home.classList.remove('open');
};

// Force hide home panel on load
$home.classList.remove('open');

// Language switching
function updateTranslations() {
  const lang = getCurrentLanguage();
  
  // Update language toggle button
  $langText.textContent = lang === 'vi' ? 'EN' : 'VI';
  
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  
  // Update all elements with data-i18n-html attribute
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key);
  });
  
  // Update search placeholder
  if ($searchField) {
    $searchField.placeholder = t('searchPlaceholder');
  }
  
  // Update page title and meta
  document.title = t('metaTitle');
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = t('metaDescription');
  }
  
  // Update map labels
  updateMapLabels();
}

// Update map station labels based on language
function updateMapLabels() {
  // Use try-catch to safely check if map exists (it's initialized later)
  try {
    if (!window.map || !window.map.getLayer('stations-labels')) {
      return; // Map not ready yet, skip silently
    }
    
    const lang = getCurrentLanguage();
    const textField = lang === 'en' 
      ? ['coalesce', ['get', 'nameEn'], ['get', 'name']]
      : ['get', 'name'];
    
    console.log('Updating map labels to:', lang);
    window.map.setLayoutProperty('stations-labels', 'text-field', textField);
    console.log('Map labels updated successfully');
  } catch (e) {
    // Map not initialized yet, skip silently
    return;
  }
}

// Language toggle button click
$langToggle.onclick = () => {
  const currentLang = getCurrentLanguage();
  const newLang = currentLang === 'vi' ? 'en' : 'vi';
  setLanguage(newLang);
  updateTranslations();
  
  // Re-initialize Fuse.js with new language
  if (stationsDataGlobal) {
    const searchKeys = newLang === 'en' 
      ? ['properties.nameEn', 'properties.name']
      : ['properties.name', 'properties.nameEn'];
    
    fuse = new Fuse(stationsDataGlobal.features, {
      keys: searchKeys,
      threshold: 0.3,
      includeScore: true
    });
  }
  
  // Refresh search results if search panel is open
  if ($search && !$search.hidden) {
    const query = $searchField.value.trim();
    if (!query) {
      showAllStations();
    } else {
      // Trigger search again with new language
      $searchField.oninput({ target: $searchField });
    }
  }
};

// Initialize translations on load
updateTranslations();

// Add event delegation for home panel close button
$home.addEventListener('click', (e) => {
  if (e.target.classList.contains('sheet-close')) {
    e.preventDefault();
    $home.classList.remove('open');
  }
});

// Toggle home panel when clicking logo
const $logo = $('logo');
$logo.onclick = () => {
  $home.classList.toggle('open');
};
$logo.style.cursor = 'pointer';

// Mapbox access token (using template's token for now)
mapboxgl.accessToken = 'pk.eyJ1IjoiY2hlZWF1biIsImEiOiJja2NydG83cWMwaGJsMnBqdjR5aHc3MzdlIn0.YGTZpi7JQMquEOv9E8K_bg';

// HCMC center coordinates
const center = [106.7, 10.8];
const bounds = [106.6, 10.7, 106.9, 10.9];

// Initialize map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center,
  zoom: 12,
  bounds,
  renderWorldCopies: false,
  boxZoom: false,
});

// Make map accessible globally for language switching
window.map = map;

// Add navigation controls
map.addControl(
  new mapboxgl.NavigationControl({
    showZoom: true,
    visualizePitch: true,
  }),
  'bottom-right'
);

// Add geolocate control
map.addControl(
  new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
    },
    trackUserLocation: true,
  }),
  'bottom-right'
);

console.log('RailRouter VN initialized');

// Load rail data
map.on('load', async () => {
  try {
    // Store globally for search
    stationsDataGlobal = stationsData;
    
    // Initialize Fuse.js for search
    fuse = new Fuse(stationsData.features, {
      keys: ['properties.name', 'properties.nameEn', 'properties.code'],
      threshold: 0.3,
      includeScore: true
    });

    // Add rail lines source
    map.addSource('rail-lines', {
      type: 'geojson',
      data: railData
    });

    // Add stations source
    map.addSource('stations', {
      type: 'geojson',
      data: stationsData
    });

    // Add station buildings source (footprints)
    const customBuildings = {
      'opera-house': [
        [106.70142986825043, 10.775104173445452],
        [106.7017091818701, 10.774917449969093],
        [106.7027212281328, 10.775975104767578],
        [106.7025554219094, 10.77609188154825],
        [106.70142986825043, 10.775104173445452]
      ]
    };

    const stationBuildings = {
      type: 'FeatureCollection',
      features: stationsData.features.map(station => {
        const coords = station.geometry.coordinates;
        const stationId = station.properties.id;
        
        // Use custom polygon if available, otherwise generate rectangle
        let polygonCoords;
        if (customBuildings[stationId]) {
          polygonCoords = [customBuildings[stationId]];
        } else {
          const offset = 0.0008; // ~90 meters
          polygonCoords = [[
            [coords[0] - offset, coords[1] - offset/2],
            [coords[0] + offset, coords[1] - offset/2],
            [coords[0] + offset, coords[1] + offset/2],
            [coords[0] - offset, coords[1] + offset/2],
            [coords[0] - offset, coords[1] - offset/2]
          ]];
        }
        
        return {
          type: 'Feature',
          properties: {
            id: stationId,
            name: station.properties.name,
            status: station.properties.status
          },
          geometry: {
            type: 'Polygon',
            coordinates: polygonCoords
          }
        };
      })
    };

    map.addSource('station-buildings', {
      type: 'geojson',
      data: stationBuildings
    });

    // Add rail lines layers - only show operational metro lines
    map.addLayer({
      id: 'rail-lines-layer',
      type: 'line',
      source: 'rail-lines',
      filter: ['all',
        ['==', ['get', 'type'], 'mrt'],
        ['==', ['get', 'status'], 'operational']
      ],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': 1
      }
    });

    // Add station building footprints
    map.addLayer({
      id: 'station-buildings-layer',
      type: 'fill',
      source: 'station-buildings',
      paint: {
        'fill-color': [
          'case',
          ['==', ['get', 'status'], 'operational'], '#0061A8',
          '#808080'
        ],
        'fill-opacity': 0.3
      }
    });

    // Add station building outlines
    map.addLayer({
      id: 'station-buildings-outline',
      type: 'line',
      source: 'station-buildings',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'status'], 'operational'], '#0061A8',
          '#808080'
        ],
        'line-width': 2,
        'line-opacity': 0.8
      }
    });

    // Add station circles
    map.addLayer({
      id: 'stations-layer',
      type: 'circle',
      source: 'stations',
      paint: {
        'circle-radius': 8,
        'circle-color': '#ffffff',
        'circle-stroke-width': 3,
        'circle-stroke-color': [
          'case',
          ['==', ['get', 'status'], 'operational'], '#0061A8',
          '#808080'
        ]
      }
    });

    // Add station labels with dynamic language support
    const currentLang = getCurrentLanguage();
    const initialTextField = currentLang === 'en' 
      ? ['coalesce', ['get', 'nameEn'], ['get', 'name']]
      : ['get', 'name'];
    
    map.addLayer({
      id: 'stations-labels',
      type: 'symbol',
      source: 'stations',
      layout: {
        'text-field': initialTextField,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 12,
        'text-offset': [0, 1.5],
        'text-anchor': 'top'
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    // Add exits source - show all exits from all stations
    const allExits = {
      type: 'FeatureCollection',
      features: []
    };
    
    stationsData.features.forEach(station => {
      if (station.properties.exits && station.properties.exits.length > 0) {
        station.properties.exits.forEach(exit => {
          allExits.features.push({
            type: 'Feature',
            properties: {
              number: exit.number,
              name: exit.name,
              description: exit.description,
              status: exit.status || 'open',
              stationId: station.properties.id,
              stationName: station.properties.name
            },
            geometry: {
              type: 'Point',
              coordinates: exit.location
            }
          });
        });
      }
    });

    map.addSource('exits', {
      type: 'geojson',
      data: allExits
    });

    // Add exits layer - only visible when zoomed in
    map.addLayer({
      id: 'exits-layer',
      type: 'circle',
      source: 'exits',
      minzoom: 14,
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'case',
          ['==', ['get', 'status'], 'closed'], '#808080',
          '#E8A000'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': [
          'case',
          ['==', ['get', 'status'], 'closed'], 0.5,
          1
        ]
      }
    });

    // Add exit labels - only visible when zoomed in
    map.addLayer({
      id: 'exits-labels',
      type: 'symbol',
      source: 'exits',
      minzoom: 14,
      layout: {
        'text-field': ['concat', 'Lối ra ', ['get', 'number']],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 10,
        'text-offset': [0, 1.2],
        'text-anchor': 'top'
      },
      paint: {
        'text-color': [
          'case',
          ['==', ['get', 'status'], 'closed'], '#808080',
          '#E8A000'
        ],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': [
          'case',
          ['==', ['get', 'status'], 'closed'], 0.5,
          1
        ]
      }
    });

    // Click handler for stations
    map.on('click', 'stations-layer', (e) => {
      const feature = e.features[0];
      const station = feature.properties;
      
      // Show station info panel
      showStationInfo(station, stationsData.features.find(f => f.properties.id === station.id));
      
      // Fly to station
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 16,
        duration: 1000
      });
    });

    // Click handler for exits
    map.on('click', 'exits-layer', (e) => {
      const feature = e.features[0];
      const exit = feature.properties;
      const coordinates = feature.geometry.coordinates.slice();
      showExitInfo(exit, coordinates);
    });

    // Change cursor on hover
    map.on('mouseenter', 'stations-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'stations-layer', () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('mouseenter', 'exits-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'exits-layer', () => {
      map.getCanvas().style.cursor = '';
    });

    console.log('Rail data loaded successfully');
  } catch (error) {
    console.error('Error loading rail data:', error);
  }
});

// Show station info in panel
function showStationInfo(station, stationFeature) {
  const exits = stationFeature.properties.exits || [];
  const lines = stationFeature.properties.lines || [];
  const lang = getCurrentLanguage();
  const stationName = lang === 'en' 
    ? (stationFeature.properties.nameEn || stationFeature.properties.name)
    : (stationFeature.properties.name || stationFeature.properties.nameEn);
  
  let html = `
    <button type="button" class="sheet-close"></button>
    <div class="station-header">
      <h2>${stationName}</h2>
    </div>
    <div class="station-lines">
      ${lines.map(lineId => {
        const lineColors = {
          'line-1': '#0061A8',
          'line-2': '#A05FA0',
          'line-3a': '#E8692A',
          'line-4': '#1B9E77',
          'bt-cangio': '#808080'
        };
        const lineNamesVi = {
          'line-1': 'Tuyến 1 - Bến Thành - Suối Tiên',
          'line-2': 'Tuyến 2',
          'line-3a': 'Tuyến 3A',
          'line-4': 'Tuyến 4',
          'bt-cangio': 'Bến Thành - Cần Giờ'
        };
        const lineNamesEn = {
          'line-1': 'Line 1 - Ben Thanh - Suoi Tien',
          'line-2': 'Line 2',
          'line-3a': 'Line 3A',
          'line-4': 'Line 4',
          'bt-cangio': 'Ben Thanh - Can Gio'
        };
        const lineName = lang === 'en' ? lineNamesEn[lineId] : lineNamesVi[lineId];
        return `<span class="line-badge" style="background-color: ${lineColors[lineId]} !important; padding: 6px 10px; border-radius: 4px; color: white !important; font-size: 12px; font-weight: 600; display: inline-block; margin: 2px;">${lineName}</span>`;
      }).join('')}
    </div>
  `;
  
  if (exits.length > 0) {
    html += `
      <div class="station-exits">
        <h3>${t('stationExits')}</h3>
        <ul>
          ${exits.map(exit => {
            const [lng, lat] = exit.location;
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            const closedText = exit.status === 'closed' ? `<span class="badge-closed">${t('stationClosed')}</span>` : '';
            return `
              <li class="exit-item ${exit.status === 'closed' ? 'closed' : ''}" 
                  data-exit-number="${exit.number}"
                  data-exit-name="${exit.name}"
                  data-exit-description="${exit.description}"
                  data-exit-status="${exit.status || 'open'}"
                  data-exit-lng="${lng}"
                  data-exit-lat="${lat}"
                  data-station-name="${stationName}"
                  style="cursor: pointer;">
                <strong>${t('stationExit')} ${exit.number}</strong> - ${exit.name}
                ${closedText}
                <div class="exit-desc">${exit.description}</div>
                <a href="${googleMapsUrl}" target="_blank" class="btn-maps-small" style="display: inline-block; margin-top: 6px; padding: 6px 12px; background: #4285F4; color: white; text-decoration: none; border-radius: 3px; font-size: 12px; font-weight: 500;" onclick="event.stopPropagation();">
                  ${t('btnGoogleMaps')}
                </a>
              </li>
            `;
          }).join('')}
        </ul>
      </div>
    `;
  }
  
  $station.innerHTML = html;
  $station.classList.add('open');
  
  // Add click handlers for exit items
  const exitItems = $station.querySelectorAll('.exit-item');
  exitItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't trigger if clicking on Google Maps link
      if (e.target.closest('.btn-maps-small')) return;
      
      const exitData = {
        number: item.dataset.exitNumber,
        name: item.dataset.exitName,
        description: item.dataset.exitDescription,
        status: item.dataset.exitStatus,
        stationName: item.dataset.stationName
      };
      const coordinates = [parseFloat(item.dataset.exitLng), parseFloat(item.dataset.exitLat)];
      
      showExitInfo(exitData, coordinates);
      
      // Fly to exit location
      map.flyTo({
        center: coordinates,
        zoom: 17,
        duration: 1000
      });
    });
  });
}

// Show exit info
function showExitInfo(exit, coordinates) {
  const [lng, lat] = coordinates;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  
  const html = `
    <button type="button" class="sheet-close"></button>
    <div class="station-header">
      <h2>${exit.stationName}</h2>
    </div>
    <div class="exit-header" style="margin-top: 16px;">
      <div style="display: inline-block; padding: 6px 12px; background: #E8A000; color: white; border-radius: 6px; font-size: 14px; font-weight: 700; margin-bottom: 12px;">
        Lối ra ${exit.number}
      </div>
      ${exit.status === 'closed' ? '<span class="badge-closed" style="margin-left: 8px;">Đóng</span>' : ''}
    </div>
    <h3 style="margin: 8px 0;">${exit.name}</h3>
    <p>${exit.description}</p>
    <a href="${googleMapsUrl}" target="_blank" class="btn btn-maps" style="display: inline-block; margin-top: 12px; padding: 10px 16px; background: #4285F4; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">
      📍 Mở Google Maps
    </a>
  `;
  
  $station.innerHTML = html;
  $station.classList.add('open');
}

// Close station panel - use event delegation since button is added dynamically
$station.addEventListener('click', (e) => {
  if (e.target.classList.contains('sheet-close')) {
    e.preventDefault();
    $station.classList.remove('open');
  }
});

// Search button click handler
const $searchBtn = $('search-btn');
$searchBtn.onclick = () => {
  $search.hidden = false;
  $searchField.focus();
  
  // Show all stations by default
  if (!$searchField.value.trim()) {
    showAllStations();
  }
};

// Function to show all stations
function showAllStations() {
  if (!stationsDataGlobal) return;
  
  const lineColors = {
    'line-1': '#0061A8',
    'line-2': '#A05FA0',
    'line-3a': '#E8692A',
    'line-4': '#1B9E77',
    'bt-cangio': '#808080'
  };
  
  const lang = getCurrentLanguage();
  $searchResults.innerHTML = stationsDataGlobal.features.map(feature => {
    const station = feature.properties;
    const codes = station.codes || [];
    const displayName = lang === 'en' ? (station.nameEn || station.name) : station.name;
    
    // Generate code badges for all codes
    const codeBadges = codes.map(codeObj => {
      const color = lineColors[codeObj.line] || '#808080';
      return `<div class="station-code-badge" style="background-color: ${color}">${codeObj.code}</div>`;
    }).join('');
    
    return `
      <li onclick="selectStation('${station.id}')">
        <div class="station-info">
          <div class="station-name">${displayName}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          ${codeBadges}
        </div>
      </li>
    `;
  }).join('');
}

// Search functionality
$searchCancel.onclick = () => {
  $search.hidden = true;
  $searchField.value = '';
  $searchResults.innerHTML = '';
};

// Search input handler
$searchField.oninput = (e) => {
  const query = e.target.value.trim();
  
  if (!query) {
    showAllStations();
    return;
  }
  
  if (!fuse) return;
  
  const results = fuse.search(query);
  
  if (results.length === 0) {
    $searchResults.innerHTML = `<li style="padding: 20px; text-align: center; color: #999;">${t('searchNoResults')}</li>`;
    return;
  }
  
  const lineColors = {
    'line-1': '#0061A8',
    'line-2': '#A05FA0',
    'line-3a': '#E8692A',
    'line-4': '#1B9E77',
    'bt-cangio': '#808080'
  };
  
  const lang = getCurrentLanguage();
  $searchResults.innerHTML = results.slice(0, 10).map(result => {
    const station = result.item.properties;
    const codes = station.codes || [];
    const displayName = lang === 'en' ? (station.nameEn || station.name) : station.name;
    
    // Generate code badges for all codes
    const codeBadges = codes.map(codeObj => {
      const color = lineColors[codeObj.line] || '#808080';
      return `<div class="station-code-badge" style="background-color: ${color}">${codeObj.code}</div>`;
    }).join('');
    
    return `
      <li onclick="selectStation('${station.id}')">
        <div class="station-info">
          <div class="station-name">${displayName}</div>
        </div>
        <div style="display: flex; gap: 4px;">
          ${codeBadges}
        </div>
      </li>
    `;
  }).join('');
};

// Global function to select station from search
window.selectStation = (stationId) => {
  const stationFeature = stationsDataGlobal.features.find(f => f.properties.id === stationId);
  if (!stationFeature) return;
  
  const station = stationFeature.properties;
  const coords = stationFeature.geometry.coordinates;
  
  // Close search
  $search.hidden = true;
  $searchField.value = '';
  $searchResults.innerHTML = '';
  
  // Show station info
  showStationInfo(station, stationFeature);
  
  // Fly to station
  map.flyTo({
    center: coords,
    zoom: 16,
    duration: 1000
  });
};

// Service Worker registration (disabled for now)
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', function () {
//     navigator.serviceWorker.register('/src/sw.js', {
//       type: 'module',
//     }).catch(err => console.log('SW registration failed:', err));
//   });
// }
