const map = L.map('map').setView([55.751244,37.618423], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

function metersToLat(m){ return m/111000; }
function metersToLng(m, lat){ return m/(111000 * Math.cos(lat * Math.PI / 180)); }

export { map, metersToLat, metersToLng };
