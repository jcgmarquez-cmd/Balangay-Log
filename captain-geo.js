// captain-geo.js - Advanced Mapbox Heatmap, Cluster & Synchronized Situation Hub
(function () {
    let map = null;
    let incidentsCache = [];
    let initialized = false;
    let styleReady = false;      // true once the Mapbox style is usable

    // Case-detail / highlight state
    const SAME_AREA_METERS = 75;   // cases within this distance count as the same area
    let selectedPoint = null;      // plotted [lng, lat] of the case being viewed
    let selectedPopup = null;
    let highlightRaf = null;
    let currentSituations = [];
    let currentSituationIndex = 0;
    let currentPhotoIndex = 0;

    mapboxgl.accessToken = window.MAPBOX_PUBLIC_TOKEN || '';

    // Exact coordinates for Barangay Duale, Limay, Bataan
    const DUALE_COORDS = [120.5912, 14.5505]; 

    const DUALE_LANDMARKS = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5925, 14.5495] }, properties: { name: 'Duale Elementary School', type: 'school' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5890, 14.5478] }, properties: { name: 'Duale Covered Court', type: 'facility' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5932, 14.5502] }, properties: { name: "Chelsea's Resort", type: 'resort' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5928, 14.5506] }, properties: { name: "Patrick's Swimming Pool", type: 'resort' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5872, 14.5471] }, properties: { name: 'RJ Billiard', type: 'commercial' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5878, 14.5467] }, properties: { name: 'Forte Print & Copy', type: 'commercial' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5825, 14.5475] }, properties: { name: 'Matias Mulberry Farm', type: 'farm' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5835, 14.5435] }, properties: { name: 'Steveth Resort', type: 'resort' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5855, 14.5422] }, properties: { name: "Man's Forest Inland Resort", type: 'resort' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5940, 14.5535] }, properties: { name: "Imelda's Store", type: 'commercial' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5960, 14.5550] }, properties: { name: 'Limayan Bodega', type: 'commercial' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5950, 14.5575] }, properties: { name: 'Gregorio Baluyot Jr. and Family Property', type: 'residential' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5920, 14.5590] }, properties: { name: "Maumbong Al Fresco Diner", type: 'dining' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5905, 14.5605] }, properties: { name: 'Golden Boy Catering', type: 'commercial' } },
            { type: 'Feature', geometry: { type: 'Point', coordinates: [120.5898, 14.5615] }, properties: { name: 'Ang Familia', type: 'commercial' } }
        ]
    };

    const mapboxStyles = {
        streets: 'mapbox://styles/mapbox/streets-v12',          
        navigation: 'mapbox://styles/mapbox/navigation-day-v1', 
        osm: 'mapbox://styles/mapbox/outdoors-v12',
        hybrid: 'mapbox://styles/mapbox/satellite-streets-v12'  
    };

    function initMap() {
        setupToolbar();
        setupPillsAndModals();
        setupDraggableModal();
        setupMonthlyArchiveUI();
        setupSidebarTabListener();

        const container = document.getElementById('captainMap');
        if (!container) return;

        if (!map) {
            try {
                map = new mapboxgl.Map({
                    container: 'captainMap',
                    style: mapboxStyles.streets, 
                    center: DUALE_COORDS,
                    zoom: 16,
                    minZoom: 10,
                    maxZoom: 20
                });

                map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

                map.on('move', updateWidgets);
                map.on('load', () => {
                    styleReady = true;
                    addCustomLayers();
                    fetchGeoData();
                });
            } catch (e) {
                console.error('Mapbox initialization error:', e);
            }
        } else {
            map.resize();
            map.flyTo({ center: DUALE_COORDS, zoom: 16 });
        }
        initialized = true;
    }

    // Force Mapbox to recalculate dimensions when sidebar tab is clicked
    function setupSidebarTabListener() {
        document.querySelectorAll('a, button, li').forEach(el => {
            if (el.textContent && el.textContent.includes('Purok Incident Heatmaps')) {
                el.addEventListener('click', () => {
                    setTimeout(() => {
                        if (map) {
                            map.resize();
                            if (incidentsCache.length > 0) {
                                addMapLayers(incidentsCache);
                            } else {
                                fetchGeoData();
                            }
                        }
                    }, 300);
                });
            }
        });
    }

    function addCustomLayers() {
        if (!map) return;

        if (!map.getSource('duale-landmarks')) {
            map.addSource('duale-landmarks', {
                type: 'geojson',
                data: DUALE_LANDMARKS
            });

            map.addLayer({
                id: 'duale-landmark-labels',
                type: 'symbol',
                source: 'duale-landmarks',
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                    'text-size': 11,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#000000',
                    'text-halo-width': 1.5
                }
            });
        }
    }

    function updateWidgets() {
        if (!map) return;
        const center = map.getCenter();
        const gridPill = document.getElementById('gridPill');
        if (gridPill) gridPill.textContent = `Coordinates [${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}]`;

        const scalePill = document.getElementById('scalePill');
        if (scalePill) {
            const zoom = map.getZoom();
            const meters = Math.round(100000 / Math.pow(2, zoom - 10));
            scalePill.textContent = meters >= 1000 ? `${(meters/1000).toFixed(1)} km` : `${meters} m`;
        }
    }

    function setupToolbar() {
        const btnLayers = document.getElementById('btnLayers');
        const mapLayersDialog = document.getElementById('mapLayersDialog');
        const btnBasemap = document.getElementById('btnBasemap');
        const panelBasemap = document.getElementById('panelBasemap');
        const btnLegend = document.getElementById('btnLegend');
        const panelLegend = document.getElementById('panelLegend');

        const panels = [panelBasemap, panelLegend];
        function closeAllPanels() {
            panels.forEach(p => p && p.classList.remove('active'));
        }

        btnLayers?.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllPanels();
            if (mapLayersDialog) {
                if (typeof mapLayersDialog.showModal === 'function') mapLayersDialog.showModal();
                else mapLayersDialog.setAttribute('open', true);
            }
        });

        mapLayersDialog?.querySelectorAll('[data-close-layers]').forEach(btn => {
            btn.addEventListener('click', () => mapLayersDialog.close());
        });

        btnLegend?.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasActive = panelLegend?.classList.contains('active');
            closeAllPanels();
            if (!wasActive && panelLegend) panelLegend.classList.add('active');
        });

        btnBasemap?.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasActive = panelBasemap?.classList.contains('active');
            closeAllPanels();
            if (!wasActive && panelBasemap) panelBasemap.classList.add('active');
        });

        document.addEventListener('click', () => closeAllPanels());
        panels.forEach(p => p?.addEventListener('click', e => e.stopPropagation()));

        document.querySelectorAll('.basemap-tile').forEach(tile => {
            tile.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.basemap-tile').forEach(t => t.classList.remove('active'));
                tile.classList.add('active');
                
                const key = tile.dataset.basemap; 
                if (map && mapboxStyles[key]) {
                    styleReady = false;
                    map.setStyle(mapboxStyles[key]);
                    map.once('style.load', () => {
                        styleReady = true;
                        addCustomLayers();
                        addMapLayers(incidentsCache);
                    });
                }
            });
        });
    }

    function setupMonthlyArchiveUI() {
        const heatmapSection = document.getElementById('view-heatmap');
        if (!heatmapSection || document.getElementById('monthlyArchiveBar')) return;

        const archiveBar = document.createElement('div');
        archiveBar.id = 'monthlyArchiveBar';
        archiveBar.style.cssText = 'position: absolute; top: 15px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 170px); z-index: 4; background: rgba(23, 43, 53, 0.95); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; gap: 10px; color: #fff; font-size: 12px; font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';
        
        archiveBar.innerHTML = `
            <span style="font-weight: 700; color: #58a69b;">Monthly Archive:</span>
            <select id="archiveMonthSelect" style="background: #0e1a21; color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                <option value="">All-Time / Current Month</option>
                <option value="2026-10">October 2026</option>
                <option value="2026-09">September 2026</option>
                <option value="2026-08">August 2026</option>
                <option value="2026-07">July 2026</option>
            </select>
        `;

        heatmapSection.querySelector('.map-view-pane')?.appendChild(archiveBar);

        document.getElementById('archiveMonthSelect')?.addEventListener('change', (e) => {
            filterIncidentsByMonth(e.target.value);
        });
    }

    function filterIncidentsByMonth(yearMonth) {
        if (!incidentsCache.length) return;
        if (!yearMonth || yearMonth === "") {
            addMapLayers(incidentsCache);
            return;
        }
        const filtered = incidentsCache.filter(inc => (inc.date || '').startsWith(yearMonth));
        if (filtered.length === 0) {
            addMapLayers(incidentsCache);
        } else {
            addMapLayers(filtered);
        }
    }

    function setupDraggableModal() {
        const modal = document.getElementById('earlyWarningDialog');
        const header = document.getElementById('ewModalHeader');
        const body = document.getElementById('ewModalBody');
        const minBtn = document.getElementById('ewMinimizeBtn');
        const maxBtn = document.getElementById('ewMaximizeBtn');

        if (!modal || !header) return;

        let isDragging = false, startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = modal.getBoundingClientRect();
            const parentRect = modal.offsetParent ? modal.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
            initialLeft = rect.left - parentRect.left;
            initialTop = rect.top - parentRect.top;
            modal.style.right = 'auto';
            modal.style.left = initialLeft + 'px';
            modal.style.top = initialTop + 'px';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            modal.style.left = (initialLeft + (e.clientX - startX)) + 'px';
            modal.style.top = (initialTop + (e.clientY - startY)) + 'px';
        }

        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        let isMinimized = false;
        minBtn?.addEventListener('click', () => {
            isMinimized = !isMinimized;
            body.style.display = isMinimized ? 'none' : 'block';
            modal.style.maxHeight = isMinimized ? 'none' : '580px';
            minBtn.textContent = isMinimized ? '+' : '-';
        });

        let isMaximized = false, prevStyle = {};
        maxBtn?.addEventListener('click', () => {
            isMaximized = !isMaximized;
            if (isMaximized) {
                prevStyle = { left: modal.style.left, top: modal.style.top, width: modal.style.width, height: modal.style.height, maxHeight: modal.style.maxHeight };
                modal.style.top = '10px'; modal.style.height = 'calc(100% - 20px)'; modal.style.width = '480px'; modal.style.maxHeight = 'none';
                body.style.maxHeight = 'calc(100% - 55px)';
                maxBtn.textContent = '❐';
            } else {
                modal.style.left = prevStyle.left || 'auto'; modal.style.top = prevStyle.top || '70px'; modal.style.width = '480px'; modal.style.height = 'auto'; modal.style.maxHeight = '580px';
                body.style.maxHeight = '500px';
                maxBtn.textContent = '□';
            }
        });
    }

    function setupPillsAndModals() {
        if (!window._earlyWarningBound) {
            window._earlyWarningBound = true;
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('#pillEarlyWarning');
                if (!btn) return;
                e.stopPropagation();
                e.preventDefault();

                const dialog = document.getElementById('earlyWarningDialog');
                if (!dialog) return;
                const isVisible = dialog.style.display === 'flex';
                dialog.style.display = isVisible ? 'none' : 'flex';
                if (isVisible) clearHighlight();
                if (!isVisible) {
                    dialog.style.right = '70px'; dialog.style.left = 'auto'; dialog.style.top = '70px'; dialog.style.zIndex = '10000';
                }
            });
        }

        const dialog = document.getElementById('earlyWarningDialog');
        if (dialog) {
            dialog.querySelectorAll('[data-close-dialog]').forEach(btn => {
                btn.addEventListener('click', () => { dialog.style.display = 'none'; clearHighlight(); });
            });

            dialog.querySelectorAll('.ew-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    dialog.querySelectorAll('.ew-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#b9c5c3'; });
                    dialog.querySelectorAll('.ew-tab-content').forEach(c => c.style.display = 'none');
                    btn.style.background = '#19766c';
                    btn.style.color = '#fff';
                    const target = document.getElementById(btn.dataset.target);
                    if (target) target.style.display = 'block';
                });
            });

            document.getElementById('backToListBtn')?.addEventListener('click', () => {
                document.getElementById('ewDetailView').style.display = 'none';
                document.getElementById('ewListView').style.display = 'block';
                document.getElementById('ewModalTitle').textContent = 'Active Case Alerts';
                clearHighlight();
            });

            bindSituationEvents();

            dialog.querySelectorAll('.ew-subtab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    dialog.querySelectorAll('.ew-subtab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#b9c5c3'; });
                    dialog.querySelectorAll('.ew-subtab-content').forEach(c => c.style.display = 'none');
                    btn.style.background = '#19766c';
                    btn.style.color = '#fff';
                    const target = document.getElementById(btn.dataset.subtarget);
                    if (target) target.style.display = 'block';
                });
            });
        }
    }

    async function fetchGeoData() {
        try {
            let res;
            try {
                res = await fetch('api/get_heatmap_data.php');
                if (!res.ok) throw new Error('Primary path failed');
            } catch (err) {
                res = await fetch('./api/get_heatmap_data.php');
            }

            if (!res.ok) throw new Error('The heatmap API returned an unsuccessful response.');
            const data = await res.json();
            if (!(data.status === 'success' || data.success)) throw new Error(data.message || 'Heatmap data could not be loaded.');
            incidentsCache = data.data || [];
            addMapLayers(incidentsCache);
            populateActiveAlertsList(incidentsCache);
            updateWarningCount(incidentsCache);
        } catch (e) {
            console.error('Failed to load Mapbox GIS data:', e);
            incidentsCache = [];
            addMapLayers(incidentsCache);
            populateActiveAlertsList(incidentsCache);
            updateWarningCount(incidentsCache);
        }
    }

    function populateActiveAlertsList(incidents) {
        const container = document.getElementById('dynamicCaseAlertsContainer');
        if (!container) return;

        const criticals = incidents.filter(i => i.severity === 'critical' || i.severity === 'high');
        const highs = incidents.filter(i => i.severity === 'moderate');
        const lows = incidents.filter(i => i.severity !== 'critical' && i.severity !== 'high' && i.severity !== 'moderate');

        let html = '';
        
        if (criticals.length > 0) {
            html += `<div style="margin-bottom: 16px;"><div style="font-size: 11px; text-transform: uppercase; color: #d9534f; font-weight: 800; margin-bottom: 8px;">🚨 Critical / High Severity Cases</div>`;
            criticals.forEach(c => { html += renderAlertCard(c, '#d9534f'); });
            html += `</div>`;
        }

        if (highs.length > 0) {
            html += `<div style="margin-bottom: 16px;"><div style="font-size: 11px; text-transform: uppercase; color: #f0ad4e; font-weight: 800; margin-bottom: 8px;">⚠️ Moderate Severity Cases</div>`;
            highs.forEach(c => { html += renderAlertCard(c, '#f0ad4e'); });
            html += `</div>`;
        }

        if (lows.length > 0) {
            html += `<div style="margin-bottom: 16px;"><div style="font-size: 11px; text-transform: uppercase; color: #5cb85c; font-weight: 800; margin-bottom: 8px;">ℹ️ Low Severity / Minor Blotter</div>`;
            lows.forEach(c => { html += renderAlertCard(c, '#5cb85c'); });
            html += `</div>`;
        }

        container.innerHTML = html;

        container.querySelectorAll('.view-case-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.case-alert-card');
                const lat = parseFloat(card.dataset.lat);
                const lng = parseFloat(card.dataset.lng);
                const id = card.dataset.caseId;
                const incident = incidents.find(i => String(i.id) === String(id)) || incidents[0];

                openCaseDetail(incident, incidents);
            });
        });
    }

    function renderAlertCard(c, borderColor) {
        return `
            <div class="case-alert-card" data-case-id="${c.id}" data-lat="${c.lat}" data-lng="${c.lng}" style="background: #223c47; border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 2px;">${escapeHtml(c.title)}</div>
                    <span style="font-size: 10px; color: #b9c5c3;">${escapeHtml(c.purok)} • ${escapeHtml(c.date)}</span>
                </div>
                <button type="button" class="button button-primary view-case-btn" style="background: ${borderColor}; color: #fff; font-size: 11px; padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-weight: 700;">View</button>
            </div>
        `;
    }

    function addMapLayers(incidents) {
        if (!map) return;

        // The style is not ready yet (first load or mid basemap switch).
        // The 'load' / 'style.load' handlers call addMapLayers again when it is.
        // NOTE: do not use map.isStyleLoaded() here. It also returns false while
        // any source is still fetching tiles, and no 'style.load' event follows
        // in that case, so the heat layers were never added.
        if (!styleReady) return;

        const geojsonFeatures = incidents.map(inc => {
            const plotted = plotCoords(inc);

            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: plotted },
                properties: {
                    id: inc.id,
                    title: inc.title,
                    purok: inc.purok || 'N/A',
                    severity: inc.severity || 'low',
                    weight: inc.intensity || 0.4,
                    date: inc.date || ''
                }
            };
        });

        ['clusters', 'cluster-count', 'unclustered-point', 'incident-heat'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
        });
        if (map.getSource('incidents')) map.removeSource('incidents');

        map.addSource('incidents', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: geojsonFeatures },
            cluster: false,
            clusterMaxZoom: 16,
            clusterRadius: 50
        });

        map.addLayer({
            id: 'incident-heat',
            type: 'heatmap',
            source: 'incidents',
            maxzoom: 20,
            paint: {
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(33,102,172,0)',
                    0.2, 'rgb(92,184,92)',
                    0.6, 'rgb(240,173,78)',
                    1.0, 'rgb(217,83,79)'
                ],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 30],
                'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 1, 19, 0.8]
            }
        });

        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'incidents',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': ['step', ['get', 'point_count'], '#5cb85c', 5, '#f0ad4e', 10, '#d9534f'],
                'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 10, 30],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'incidents',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            },
            paint: { 'text-color': '#ffffff' }
        });

        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'incidents',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-radius': 9,
                'circle-color': ['match', ['get', 'severity'], 'critical', '#d9534f', 'high', '#d9534f', 'moderate', '#f0ad4e', '#5cb85c'],
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff'
            }
        });

        map.off('click', 'clusters');
        map.on('click', 'clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
            const clusterId = features[0].properties.cluster_id;
            map.getSource('incidents').getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
            });
        });

        map.off('click', 'unclustered-point');
        map.on('click', 'unclustered-point', (e) => {
            const props = e.features[0].properties;
            const coordinates = e.features[0].geometry.coordinates.slice();

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <div style="font-family: 'DM Sans', sans-serif;">
                        <strong style="font-size: 13px; color: #172b35;">${escapeHtml(props.title)}</strong><br>
                        <span style="font-size: 11px; color: #6c7b81;">Sitio: ${escapeHtml(props.purok)} | Severity: ${escapeHtml(props.severity)}</span>
                    </div>
                `)
                .addTo(map);
        });

        ensureHighlightLayers();
    }
    
    function updateWarningCount(incidents) {
        const count = incidents.filter(i => ['high', 'critical', 'moderate'].includes(i.severity)).length;
        const badge = document.getElementById('warningBadgeCount');
        if (badge) badge.textContent = count;
    }

    // ------------------------------------------------------------------
    // Case detail: highlight, related situations, photos
    // ------------------------------------------------------------------

    // Where a case is drawn on the map. The dots are nudged slightly so cases that share a
    // point do not hide each other; the highlight must use the same position.
    function plotCoords(inc) {
        const lat = Number(inc.lat);
        const lng = Number(inc.lng);
        const idNum = Number(inc.id) || 1;
        const latOffset = ((idNum * 37) % 15 - 7) * 0.00012;
        const lngOffset = ((idNum * 53) % 15 - 7) * 0.00012;
        return [lng + lngOffset, lat + latOffset];
    }

    function distanceMeters(a, b) {
        const toRad = d => d * Math.PI / 180;
        const R = 6371000;
        const dLat = toRad(Number(b.lat) - Number(a.lat));
        const dLng = toRad(Number(b.lng) - Number(a.lng));
        const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(Number(a.lat))) * Math.cos(toRad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    }

    // The narrative may end with "[Location: ...]" (added at intake). Show it as its own field.
    function splitObservation(raw) {
        const text = String(raw || '').trim();
        const m = text.match(/\n?\s*\[Location:\s*([^\]]*)\]\s*$/i);
        if (!m) return { narrative: text, location: '' };
        return { narrative: text.slice(0, m.index).trim(), location: m[1].trim() };
    }

    function accuracyNote(inc) {
        const a = String(inc.accuracy || '').toUpperCase();
        if (a === 'PUROK') return 'Approximate location: plotted at the purok center';
        if (a === 'BARANGAY') return 'Approximate location: plotted at the barangay center';
        return '';
    }

    function severityColor(sev) {
        const s = String(sev || '').toLowerCase();
        if (s === 'critical' || s === 'high') return '#d9534f';
        if (s === 'moderate') return '#f0ad4e';
        return '#5cb85c';
    }

    function statusLabel(status) {
        const s = String(status || '').trim().toUpperCase();
        if (!s) return 'Status not recorded';
        const labels = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CRITICAL: 'Critical' };
        return labels[s] || s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
    }

    function formatDateTime(value) {
        const d = new Date(String(value || '').replace(' ', 'T'));
        if (isNaN(d.getTime())) return value || '—';
        return d.toLocaleString('en-US');
    }

    // Photos attached to the report. The feed supplies them as a "photos" array of URLs.
    function getPhotos(inc) {
        const raw = Array.isArray(inc.photos) ? inc.photos : (inc.photo ? [inc.photo] : []);
        return raw
            .map(p => String(p || '').trim())
            .filter(p => p && !/^\s*(javascript|data|vbscript):/i.test(p));
    }

    function emptyCollection() {
        return { type: 'FeatureCollection', features: [] };
    }

    function selectedCollection() {
        if (!selectedPoint) return emptyCollection();
        return {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: selectedPoint }, properties: {} }]
        };
    }

    function ensureHighlightLayers() {
        if (!map || !styleReady) return;
        try {
            const src = map.getSource('selected-incident');
            if (src) src.setData(selectedCollection());
            else map.addSource('selected-incident', { type: 'geojson', data: selectedCollection() });

            if (!map.getLayer('selected-incident-pulse')) {
                map.addLayer({
                    id: 'selected-incident-pulse',
                    type: 'circle',
                    source: 'selected-incident',
                    paint: {
                        'circle-radius': 20,
                        'circle-color': '#ffd54a',
                        'circle-opacity': 0.3,
                        'circle-stroke-width': 3,
                        'circle-stroke-color': '#ffd54a',
                        'circle-stroke-opacity': 0.9
                    }
                });
            }
            if (!map.getLayer('selected-incident-ring')) {
                map.addLayer({
                    id: 'selected-incident-ring',
                    type: 'circle',
                    source: 'selected-incident',
                    paint: {
                        'circle-radius': 16,
                        'circle-color': 'rgba(0,0,0,0)',
                        'circle-stroke-width': 3.5,
                        'circle-stroke-color': '#ffd54a'
                    }
                });
            }
            // Layers added later draw on top, so lift the highlight above the rebuilt dots.
            map.moveLayer('selected-incident-pulse');
            map.moveLayer('selected-incident-ring');
        } catch (e) {
            console.warn('[geo] highlight layers failed', e);
            return;
        }
        if (selectedPoint) startPulse();
    }

    function startPulse() {
        stopPulse();
        const t0 = performance.now();
        const tick = (now) => {
            if (!map || !selectedPoint || !map.getLayer('selected-incident-pulse')) {
                highlightRaf = null;
                return;
            }
            const p = ((now - t0) % 1500) / 1500;
            map.setPaintProperty('selected-incident-pulse', 'circle-radius', 16 + p * 30);
            map.setPaintProperty('selected-incident-pulse', 'circle-opacity', 0.35 * (1 - p));
            map.setPaintProperty('selected-incident-pulse', 'circle-stroke-opacity', 0.9 * (1 - p));
            highlightRaf = requestAnimationFrame(tick);
        };
        highlightRaf = requestAnimationFrame(tick);
    }

    function stopPulse() {
        if (highlightRaf) cancelAnimationFrame(highlightRaf);
        highlightRaf = null;
    }

    function setHighlight(inc) {
        selectedPoint = plotCoords(inc);
        ensureHighlightLayers();

        if (selectedPopup) selectedPopup.remove();
        const { location } = splitObservation(inc.observations);
        const note = accuracyNote(inc);
        selectedPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 26 })
            .setLngLat(selectedPoint)
            .setHTML(`
                <div style="font-family: 'DM Sans', sans-serif;">
                    <strong style="font-size: 12px; color: #172b35;">${escapeHtml(inc.case_no || ('Case #' + inc.id))}</strong><br>
                    <span style="font-size: 11px; color: #172b35;">${escapeHtml(inc.title)}${inc.purok ? ' · ' + escapeHtml(inc.purok) : ''}</span>
                    ${location ? `<br><span style="font-size: 11px; color: #6c7b81;">📍 ${escapeHtml(location)}</span>` : ''}
                    ${note ? `<br><span style="font-size: 10px; color: #b36b00;">${escapeHtml(note)}</span>` : ''}
                </div>
            `)
            .addTo(map);
    }

    function clearHighlight() {
        selectedPoint = null;
        stopPulse();
        if (selectedPopup) { selectedPopup.remove(); selectedPopup = null; }
        if (map && styleReady) {
            const src = map.getSource('selected-incident');
            if (src) src.setData(emptyCollection());
        }
    }

    // A location is "approximate" when it was plotted at a purok or barangay center.
    function isApproximate(inc) {
        const a = String(inc.accuracy || '').toUpperCase();
        return a === 'PUROK' || a === 'BARANGAY';
    }

    function normPurok(inc) {
        return String(inc.purok || '').trim().toLowerCase();
    }

    // The clicked case first, then the other cases from the same area (newest first).
    // - Exact or street-level case: other exact cases within SAME_AREA_METERS.
    // - Approximate case: other approximate cases in the same purok (their points are
    //   only purok or barangay centers, so distance says nothing about the real place).
    function findRelatedSituations(selected, incidents) {
        const selApprox = isApproximate(selected);
        const selPurok = normPurok(selected);
        const related = incidents
            .filter(i => {
                if (String(i.id) === String(selected.id)) return false;
                if (isApproximate(i) !== selApprox) return false;
                if (selApprox) return selPurok !== '' && normPurok(i) === selPurok;
                return Number.isFinite(Number(i.lat)) && Number.isFinite(Number(i.lng)) &&
                    distanceMeters(selected, i) <= SAME_AREA_METERS;
            })
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        return [selected, ...related];
    }

    function openCaseDetail(incident, incidents) {
        currentSituations = findRelatedSituations(incident, incidents);
        document.getElementById('ewListView').style.display = 'none';
        document.getElementById('ewDetailView').style.display = 'block';
        bindSituationEvents();
        showSituation(0);
    }

    function showSituation(index) {
        const total = currentSituations.length;
        if (!total) return;
        currentSituationIndex = ((index % total) + total) % total;
        currentPhotoIndex = 0;
        const inc = currentSituations[currentSituationIndex];

        if (map) map.flyTo({ center: plotCoords(inc), zoom: 18, duration: 1200 });
        setHighlight(inc);
        renderOverview(inc);
        renderSituations();
    }

    function renderOverview(inc) {
        const { narrative } = splitObservation(inc.observations);
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set('ewModalTitle', inc.title || 'Case');
        set('ovCaseTitle', inc.title || 'Case');
        set('ovCaseDate', formatDateTime(inc.date));
        set('ovSeverityBadge', String(inc.severity || 'Normal').toUpperCase());
        set('ovStatusBadge', statusLabel(inc.status));
        set('ovDescriptionText', narrative || inc.title || '—');
        const sev = document.getElementById('ovSeverityBadge');
        if (sev) sev.style.background = severityColor(inc.severity);
    }

    function renderSituations() {
        const el = document.getElementById('subSituations');
        if (!el) return;
        const total = currentSituations.length;
        const inc = currentSituations[currentSituationIndex];
        if (!inc) { el.innerHTML = ''; return; }

        const { narrative, location } = splitObservation(inc.observations);
        const photos = getPhotos(inc);
        const sevColor = severityColor(inc.severity);
        const note = accuracyNote(inc);

        const arrowStyle = 'width: 30px; height: 30px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: #172b35; color: #fff; font-size: 16px; line-height: 1; cursor: pointer; flex-shrink: 0;';
        const photoArrowStyle = 'position: absolute; top: 50%; transform: translateY(-50%); width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(14,26,33,0.75); color: #fff; font-size: 14px; cursor: pointer;';

        const field = (label, valueHtml) => `
            <div>
                <span style="font-size: 9px; color: #8a9b99; text-transform: uppercase; display: block; margin-bottom: 2px;">${label}</span>
                <strong style="font-size: 11px; color: #fff; word-break: break-word;">${valueHtml}</strong>
            </div>`;

        const photoHtml = photos.length
            ? `<div style="position: relative; background: #0e1a21; border-radius: 8px; overflow: hidden; margin-bottom: 14px; border: 1px solid rgba(255,255,255,0.1);">
                    <img src="${escapeHtml(photos[currentPhotoIndex])}" alt="Report photo ${currentPhotoIndex + 1}" style="width: 100%; height: 200px; object-fit: cover; display: block;">
                    ${photos.length > 1 ? `
                        <button type="button" data-photo-nav="-1" aria-label="Previous photo" style="${photoArrowStyle} left: 8px;">‹</button>
                        <button type="button" data-photo-nav="1" aria-label="Next photo" style="${photoArrowStyle} right: 8px;">›</button>
                        <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(14,26,33,0.75); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 10px;">${currentPhotoIndex + 1} / ${photos.length}</span>` : ''}
               </div>`
            : `<div style="background: #0e1a21; border: 1px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 22px 12px; margin-bottom: 14px; text-align: center; font-size: 11px; color: #8a9b99;">No photo was attached to this report.</div>`;

        el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 12px; font-weight: 700; color: #fff; border-left: 3px solid #19766c; padding-left: 8px;">Mapped Situations Related to Event</span>
                <span style="background: rgba(88,166,155,0.25); color: #58a69b; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px;">${total}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; background: #223c47; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                ${total > 1 ? `<button type="button" data-sit-nav="-1" aria-label="Previous situation" style="${arrowStyle}">‹</button>` : ''}
                <div style="flex: 1; text-align: center; min-width: 0;">
                    <div style="font-size: 12px; font-weight: 700; color: #fff;">Situation ${currentSituationIndex + 1} of ${total}</div>
                    <div style="font-size: 10px; color: #b9c5c3; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(inc.case_no || '')}${inc.case_no ? ' · ' : ''}${escapeHtml(inc.title || '')}</div>
                </div>
                ${total > 1 ? `<button type="button" data-sit-nav="1" aria-label="Next situation" style="${arrowStyle}">›</button>` : ''}
            </div>

            ${photoHtml}

            <div style="margin-bottom: 14px;">
                <span style="font-size: 10px; text-transform: uppercase; color: #8a9b99; font-weight: 700; display: block; margin-bottom: 4px;">Actual Observation</span>
                <p style="font-size: 12px; color: #fff; margin: 0; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${escapeHtml(narrative || 'No narrative was recorded for this report.')}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #0e1a21; padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                ${field('Case No.', escapeHtml(inc.case_no || '—'))}
                ${field('Type', escapeHtml(inc.category || inc.title || 'General'))}
                ${field('Severity', `<span style="color: ${sevColor}; text-transform: capitalize;">${escapeHtml(inc.severity || 'Normal')}</span>`)}
                ${field('Status', escapeHtml(statusLabel(inc.status)))}
                ${field('Purok', escapeHtml(inc.purok || '—'))}
                ${field('Location', escapeHtml(location || '—'))}
                ${field('Officer-in-Charge', escapeHtml(inc.officer || 'Desk Officer'))}
                ${field('Date &amp; Time Reported', escapeHtml(formatDateTime(inc.date)))}
            </div>
            ${note ? `<p style="font-size: 10px; color: #f0ad4e; margin: 8px 0 0 0;">${escapeHtml(note)}</p>` : ''}
        `;
    }

    function bindSituationEvents() {
        const el = document.getElementById('subSituations');
        if (!el || el.dataset.bound) return;
        el.dataset.bound = '1';

        el.addEventListener('click', (e) => {
            const nav = e.target.closest('[data-sit-nav]');
            if (nav) {
                showSituation(currentSituationIndex + Number(nav.dataset.sitNav));
                return;
            }
            const photoNav = e.target.closest('[data-photo-nav]');
            if (photoNav) {
                const photos = getPhotos(currentSituations[currentSituationIndex] || {});
                if (photos.length) {
                    currentPhotoIndex = (currentPhotoIndex + Number(photoNav.dataset.photoNav) + photos.length) % photos.length;
                    renderSituations();
                }
            }
        });

        // A photo that fails to load is replaced with a short message.
        el.addEventListener('error', (e) => {
            if (e.target && e.target.tagName === 'IMG') {
                e.target.outerHTML = '<div style="padding: 40px 12px; text-align: center; font-size: 11px; color: #8a9b99;">This photo could not be loaded.</div>';
            }
        }, true);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    window.BLGeo = {
        init: initMap,
        onShow: function () {
            if (!initialized) initMap();
            else if (map) {
                map.resize();
                map.flyTo({ center: DUALE_COORDS, zoom: 16 });
            }
            fetchGeoData(); 
        }
    };

    const observer = new MutationObserver(() => {
        const heatmapView = document.getElementById('view-heatmap');
        if (heatmapView && !heatmapView.hasAttribute('hidden')) {
            window.BLGeo.onShow();
        }
    });
    
    const targetNode = document.getElementById('view-heatmap');
    if (targetNode) {
        observer.observe(targetNode, { attributes: true, attributeFilter: ['hidden'] });
    }
    window.setInterval(() => {
        const heatmapView = document.getElementById('view-heatmap');
        if (heatmapView && !heatmapView.hasAttribute('hidden')) fetchGeoData();
    }, 30000);
})();