<?php
require_once __DIR__ . '/auth.php';
requireRole(['CAPTAIN']);
$currentUser = getCurrentUser();
$captainName = htmlspecialchars((string) ($currentUser['full_name'] ?? 'Barangay Captain'), ENT_QUOTES, 'UTF-8');
$csrfToken = $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
    <title>Executive Overview | BalangayLog</title>
    <script>
        if (localStorage.getItem('balangay_theme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="admin-dashboard.css?v=<?= time() ?>">
    <link rel="stylesheet" href="captain-dashboard.css?v=<?= time() ?>">
    
    <!-- Mapbox GL JS & CSS CDNs -->
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet" />
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>

    <link rel="stylesheet" href="captain-geo.css?v=<?= time() ?>">
    <?php
    $mapboxPublicToken = '';
    $mapboxCfg = __DIR__ . '/config/mapbox_public.php';
    if (is_file($mapboxCfg)) { $mapboxPublicToken = (string) (require $mapboxCfg); }
    ?>
    <script>window.MAPBOX_PUBLIC_TOKEN = <?= json_encode($mapboxPublicToken) ?>;</script>
    <script src="captain-geo.js?v=<?= time() ?>" defer></script>
</head>
<body>
	<div class="admin-shell">
		<div class="sidebar-backdrop" id="sidebarBackdrop"></div>
		<header class="mobile-top-header">
			<button class="mobile-hamburger-btn" id="mobileMenuBtn" type="button" aria-label="Open Navigation" aria-expanded="false">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
					<line x1="3" y1="6" x2="21" y2="6"></line>
					<line x1="3" y1="12" x2="21" y2="12"></line>
					<line x1="3" y1="18" x2="21" y2="18"></line>
				</svg>
			</button>
			<a class="admin-brand mobile-brand-inline" href="captain_dashboard.php">
				<span class="admin-brand-mark">B</span>
				<span><strong>BalangayLog</strong><small>BARANGAY DUALE</small></span>
			</a>
		</header>
		<aside class="admin-sidebar" id="adminSidebar">
            <div class="sidebar-header-row">
                <a class="admin-brand" href="captain_dashboard.php" aria-label="BalangayLog Executive Overview">
                <span class="admin-brand-mark" style="background: transparent; overflow: hidden; display: grid; place-items: center;">
                  <img src="assets/balangaylog-logo.png" alt="Barangay Logo" style="width: 100%; height: 100%; object-fit: contain;">
                </span>
                <span><strong>BalangayLog</strong><small>BARANGAY DUALE</small></span>
            </a>
				<div class="sidebar-header-actions">
					<button class="sidebar-collapse-btn" id="sidebarCollapseBtn" type="button" aria-label="Collapse navigation" aria-expanded="true" title="Collapse navigation">
						<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
					</button>
					<button class="sidebar-close-btn" id="sidebarCloseBtn" type="button" aria-label="Close Navigation">×</button>
				</div>
			</div>
			<div class="admin-identity">
				<span class="identity-avatar" id="captainAvatar">CP<img id="captainPicture" alt="" hidden></span>
				<span><strong id="captainSideName">Capt. <?= $captainName ?></strong><small>Punong Barangay</small></span>
			</div>

			<nav class="admin-nav" aria-label="Captain navigation">
				<button class="admin-nav-link is-active" type="button" data-view="overview"><span class="nav-symbol">▦</span>Executive Overview</button>
				<button class="admin-nav-link" type="button" data-view="registry"><span class="nav-symbol">☰</span>Master Blotter Registry</button>
				<button class="admin-nav-link" type="button" data-view="endorsements"><span class="nav-symbol">✎</span>Awaiting Captain Endorsement <span class="nav-count" id="navEndorseCount" hidden>0</span></button>
				<button class="admin-nav-link" type="button" data-view="lupon"><span class="nav-symbol">⚖</span>Lupon / Mediation Registry</button>
				<button class="admin-nav-link" type="button" data-view="heatmap"><span class="nav-symbol">◉</span>Purok Incident Heatmaps</button>
				<button class="admin-nav-link" type="button" data-view="analytics"><span class="nav-symbol">◷</span>Analytics &amp; Official Reports</button>
				<button class="admin-nav-link" type="button" data-view="settings"><span class="nav-symbol">⚙</span>Settings</button>
			</nav>
			<div class="sidebar-bottom">
				<button class="back-link" id="themeToggleBtn" type="button" style="display: flex; align-items: center; justify-content: space-between;">
					<span id="themeToggleLabel">Dark Mode</span>
				</button>
				<button class="logout-link" id="logoutBtn" type="button">Log out</button>
			</div>
		</aside>

        <!-- Main Workspace -->
        <main class="admin-main">
            <header class="admin-topbar">
                <div>
                    <h1 id="viewTitle" style="font-size: 22px; font-weight: 800; margin: 0; font-family: 'Manrope', sans-serif;">Executive Overview</h1>
                    <p style="margin: 3px 0 0; color: var(--muted); font-size: 12px;">Peace and order, executive review, and municipal reporting</p>
                </div>
                <div class="topbar-right-controls" style="display: flex; align-items: center; gap: 12px;">
                    <button type="button" class="button button-primary" data-open-advisory style="background: #173d3b; border-color: #173d3b;">+ Issue Barangay Advisory</button>
                </div>
            </header>

            <div class="alert-banner" id="criticalBanner" role="alert" hidden>
                <span><strong id="criticalCount">0</strong> Critical Incidents Requiring Executive Notice</span>
                <button type="button" class="small-button" id="criticalReview">Review incidents</button>
            </div>

            <div class="notice" id="pageNotice" role="status" hidden></div>

            <!-- VIEW 1: EXECUTIVE OVERVIEW -->
            <section class="admin-view" id="view-overview">
                <div class="section-heading">
                    <div>
                        <h2>Peace and order at a glance</h2>
                        <p>This month's incidents, mediation, and items waiting for your signature.</p>
                    </div>
                    <button type="button" class="button button-quiet" data-refresh>Refresh data</button>
                </div>

                <div class="metric-grid" style="grid-template-columns: repeat(4, minmax(130px, 1fr));">
                    <article class="metric-tile metric-blue">
                        <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">MONTHLY INCIDENTS</span>
                        <strong id="metricIncidents">—</strong>
                        <small>Cases logged this month</small>
                    </article>
                    <article class="metric-tile metric-gold">
                        <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">CASES UNDER MEDIATION</span>
                        <strong id="metricMediation">—</strong>
                        <small>Active Lupon proceedings</small>
                    </article>
                    <article class="metric-tile metric-coral">
                        <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">ENDORSEMENTS NEEDED</span>
                        <strong id="metricEndorse">—</strong>
                        <small>Waiting for your signature</small>
                    </article>
                    <article class="metric-tile metric-green">
                        <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">RESOLUTION RATE</span>
                        <strong id="metricRate">—</strong>
                        <small>Resolved vs. filed this month</small>
                    </article>
                </div>

                <div class="content-panel" style="margin-top: 22px;">
                    <div class="panel-heading" style="border-bottom: 1px solid var(--line); padding-bottom: 14px;">
                        <div>
                            <h2>Cases awaiting endorsement</h2>
                            <p>Lupon certifications and PNP transmittals that need your formal approval.</p>
                        </div>
                        <button class="text-button" type="button" data-open-view="endorsements">View all →</button>
                    </div>
                    <div class="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Case</th>
                                    <th>Type</th>
                                    <th>Purok</th>
                                    <th>Referred by</th>
                                    <th>Date referred</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="overviewEndorseRows"></tbody>
                        </table>
                    </div>
                    <p class="empty-message" id="overviewEndorseEmpty" hidden>Nothing is waiting for your signature.</p>
                </div>

                <div class="analytics-grid">
                    <section class="content-panel">
                        <div class="panel-heading">
                            <div>
                                <h2>Incident trend</h2>
                                <p>Cases filed per month.</p>
                            </div>
                        </div>
                        <div id="trendChart" class="chart-box"></div>
                    </section>

                    <section class="content-panel">
                        <div class="panel-heading">
                            <div>
                                <h2>Incidents by purok</h2>
                                <p>This month, highest first.</p>
                            </div>
                        </div>
                        <div id="purokBars" class="bar-list"></div>
                    </section>

                    <section class="content-panel">
                        <div class="panel-heading">
                            <div>
                                <h2>Resolution rate</h2>
                                <p>Resolved cases this month.</p>
                            </div>
                        </div>
                        <div id="rateRing" class="rate-ring"></div>
                    </section>
                </div>

                <div class="content-panel">
                    <div class="panel-heading">
                        <div>
                            <h2>Quick actions</h2>
                        </div>
                    </div>
                    <div class="quick-actions">
                        <button type="button" class="button button-primary" data-open-advisory style="background: #173d3b; border-color: #173d3b;">Issue Barangay Advisory</button>
                        <button type="button" class="button button-quiet" data-generate-report>Generate Monthly DILG Report</button>
                        <button type="button" class="button button-quiet" data-open-view="lupon">Review Lupon Referrals</button>
                    </div>
                </div>
            </section>

            <!-- VIEW 2: MASTER BLOTTER REGISTRY -->
            <section class="admin-view" id="view-registry" hidden>
                <div class="section-heading">
                    <div>
                        <h2>Master blotter registry</h2>
                        <p>Read-only list of every case in the barangay.</p>
                    </div>
                </div>
                <div class="content-panel">
                    <div class="toolbar">
                        <label class="search-field">
                            <span class="sr-only">Search cases</span>
                            <input id="caseSearch" type="search" placeholder="Search reference no., incident, purok, priority">
                        </label>
                        <label class="select-field">
                            <span class="sr-only">Filter by status</span>
                            <select id="caseStatusFilter">
                                <option value="">All statuses</option>
                            </select>
                        </label>
                    </div>
                    <div class="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Case no.</th>
                                    <th>Incident</th>
                                    <th>Purok</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Reported</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="caseRows"></tbody>
                        </table>
                    </div>
                    <p class="empty-message" id="caseEmpty" hidden>No cases match this view.</p>
                </div>
            </section>

            <!-- VIEW 3: AWAITING CAPTAIN ENDORSEMENT -->
            <section class="admin-view" id="view-endorsements" hidden>
                <div class="section-heading">
                    <div>
                        <h2>Awaiting captain endorsement</h2>
                        <p>Pending Lupon certifications and PNP referrals.</p>
                    </div>
                </div>
                <div class="content-panel">
                    <div class="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Case</th>
                                    <th>Type</th>
                                    <th>Purok</th>
                                    <th>Referred by</th>
                                    <th>Date referred</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="endorseRows"></tbody>
                        </table>
                    </div>
                    <p class="empty-message" id="endorseEmpty" hidden>Nothing is waiting for your signature.</p>
                </div>
            </section>

            <!-- VIEW 4: LUPON / MEDIATION REGISTRY -->
            <section class="admin-view" id="view-lupon" hidden>
                <div class="section-heading">
                    <div>
                        <h2>Lupon / mediation registry</h2>
                        <p>Cases referred to the Lupong Tagapamayapa and their outcomes.</p>
                    </div>
                </div>
                <div class="content-panel">
                    <div class="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Case</th>
                                    <th>Parties</th>
                                    <th>Purok</th>
                                    <th>Stage</th>
                                    <th>Next hearing</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="luponRows"></tbody>
                        </table>
                    </div>
                    <p class="empty-message" id="luponEmpty" hidden>No cases are in mediation.</p>
                </div>
            </section>

            <!-- VIEW 5: GEOGRAPHIC HEATMAPS (Full Page Map) -->
            <section class="admin-view" id="view-heatmap" hidden style="display: flex; flex-direction: column; height: calc(100vh - 100px);">
                <div class="section-heading" style="margin-bottom: 12px; flex-shrink: 0;">
                    <div>
                        <h2>Geographic Heatmaps &amp; Situation Hub</h2>
                        <p>Interactive vector maps, infrastructure overlays, and live case tracking feeds.</p>
                    </div>
                </div>

                <div class="geo-container" style="flex: 1; display: block; width: 100%; height: 100%; position: relative;">
                    <!-- Map View Pane (Full Width & Height) -->
                    <div class="map-view-pane" style="position: relative; width: 100%; height: 100%;">
                        <div id="captainMap" style="width: 100%; height: 100%;"></div>

                        <!-- Left Floating Dark Vertical Toolbar with Badges -->
                        <div class="geo-toolbar">
                            <button type="button" class="geo-tool-btn" id="btnLayers" title="Toggle Overlays" style="position: relative;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                                <span class="warning-badge" style="top: -6px; right: -6px;">0</span>
                            </button>

                            <button type="button" class="geo-tool-btn" id="btnBasemap" title="Select Basemap">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                            </button>
                            <div class="geo-panel" id="panelBasemap" style="width: 260px;">
                                <h4>Basemap Gallery</h4>
                                <div class="basemap-grid-2x2">
                                    <div class="basemap-tile active" data-basemap="streets"><span>Streets</span></div>
                                    <div class="basemap-tile" data-basemap="navigation"><span>Navigation</span></div>
                                    <div class="basemap-tile" data-basemap="osm"><span>OpenStreetMap</span></div>
                                    <div class="basemap-tile" data-basemap="hybrid"><span>Hybrid</span></div>
                                </div>
                            </div>

                            <!-- Third Left Pill: Map Legend Trigger -->
                            <button type="button" class="geo-tool-btn" id="btnLegend" title="Map Legend" style="position: relative;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                <span class="warning-badge" style="top: -6px; right: -6px; background: #0275d8;">2</span>
                            </button>
                            
                            <!-- Floating Map Legend Panel -->
                            <div class="geo-panel" id="panelLegend" style="width: 280px; max-height: 420px; overflow-y: auto;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 8px; margin-bottom: 12px;">
                                    <h4 style="margin: 0; font-size: 13px; font-weight: 700; color: #fff;">Map Legend</h4>
                                    <span style="font-size: 10px; color: #8a9b99;">DUALE-GIS</span>
                                </div>

                                <div style="font-size: 11px;">
                                    <div style="margin-bottom: 14px;">
                                        <div style="display: flex; justify-content: space-between; font-weight: 800; color: #8a9b99; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
                                            <span>Case Severity Levels</span>
                                            <span>AI Evaluated</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #d9534f; display: inline-block;"></span><div><strong>Critical Severity</strong><br><span style="font-size: 10px; color: #b9c5c3;">80% – 100% Risk Score</span></div></div>
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #f0ad4e; display: inline-block;"></span><div><strong>High Severity</strong><br><span style="font-size: 10px; color: #b9c5c3;">50% – 79% Risk Score</span></div></div>
                                        <div style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 12px; border-radius: 50%; background: #5cb85c; display: inline-block;"></span><div><strong>Low Severity / Minor</strong><br><span style="font-size: 10px; color: #b9c5c3;">0% – 49% Risk Score</span></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Floating Action Pills Vertical Stack -->
                        <div class="geo-pills-right">
                            <button type="button" class="geo-pill warning-alert-pill" id="pillEarlyWarning" title="Active Case Alerts">
                                <span class="warning-icon">⚠️</span>
                                <span class="warning-badge" id="warningBadgeCount">3</span>
                            </button>
                        </div>

                        <!-- Active Case Alerts Floating Window -->
                        <div class="geo-panel" id="earlyWarningDialog" style="position: absolute; right: 70px; top: 70px; width: 480px; max-height: 580px; overflow: hidden; z-index: 50; display: none; background: #172b35; border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); flex-direction: column;">
                            <div id="ewModalHeader" style="display: flex; justify-content: space-between; align-items: center; background: #0e1a21; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: move; user-select: none;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="color: #8a9b99; font-size: 14px; letter-spacing: 1px;" title="Drag window">⋮⋮</span>
                                    <h4 id="ewModalTitle" style="margin: 0; font-size: 13px; font-weight: 700; color: #fff;">Active Case Alerts</h4>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <button type="button" id="ewMinimizeBtn" title="Minimize" style="background: none; border: none; color: #b9c5c3; font-size: 14px; cursor: pointer; padding: 2px 6px;">🗕</button>
                                    <button type="button" id="ewMaximizeBtn" title="Maximize" style="background: none; border: none; color: #b9c5c3; font-size: 14px; cursor: pointer; padding: 2px 6px;">🗖</button>
                                    <button type="button" data-close-dialog title="Close" style="background: none; border: none; color: #b9c5c3; font-size: 16px; cursor: pointer; padding: 2px 6px;">×</button>
                                </div>
                            </div>

                            <div id="ewModalBody" style="padding: 16px; overflow-y: auto; flex: 1; max-height: 500px;">
                                <div id="ewListView">
                                    <div style="display: flex; gap: 8px; margin-bottom: 16px; background: #0e1a21; padding: 4px; border-radius: 8px;">
                                        <button type="button" class="ew-tab-btn active" data-target="tabWarnings" style="flex: 1; padding: 8px; background: #19766c; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Active Case Alerts</button>
                                        <button type="button" class="ew-tab-btn" data-target="tabVulnerabilities" style="flex: 1; padding: 8px; background: transparent; color: #b9c5c3; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Purok Vulnerabilities</button>
                                        <button type="button" class="ew-tab-btn" data-target="tabLguFeeds" style="flex: 1; padding: 8px; background: transparent; color: #b9c5c3; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">LGU Feeds</button>
                                    </div>

                                    <div class="ew-tab-content" id="tabWarnings" style="display: block;">
                                        <div id="dynamicCaseAlertsContainer">
                                            <!-- Dynamically populated via captain-geo.js from database API -->
                                        </div>
                                    </div>

                                    <div class="ew-tab-content" id="tabVulnerabilities" style="display: none; text-align: center; padding: 40px 20px; color: #8a9b99;">
                                        <p style="font-size: 13px; margin: 0;">No active hazard vulnerability data currently loaded for this view.</p>
                                    </div>

                                    <div class="ew-tab-content" id="tabLguFeeds" style="display: none;">
                                        <div style="background: #223c47; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                                <span style="background: #0275d8; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: bold; color:#fff;">f</span>
                                                <div>
                                                    <strong style="font-size: 12px; display: block; color:#fff;">Barangay Duale Information Office</strong>
                                                    <span style="font-size: 10px; color: #8a9b99;">Public LGU Update</span>
                                                </div>
                                            </div>
                                            <p style="font-size: 11px; color: #cbd5d1; margin: 0 0 8px 0;">Ongoing distribution of relief packs and medical kits at the Duale Covered Court for registered families. Please bring valid IDs.</p>
                                        </div>
                                    </div>
                                </div>

                                <div id="ewDetailView" style="display: none;">
                                    <button type="button" id="backToListBtn" style="background: none; border: none; color: #58a69b; font-size: 12px; font-weight: 700; cursor: pointer; margin-bottom: 12px; display: flex; align-items: center; gap: 4px;">← Back to Active Case Alerts</button>
                                    
                                    <div style="display: flex; gap: 8px; margin-bottom: 16px; background: #0e1a21; padding: 4px; border-radius: 8px;">
                                        <button type="button" class="ew-subtab-btn active" data-subtarget="subOverview" style="flex: 1; padding: 8px; background: #19766c; color: #fff; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Overview</button>
                                        <button type="button" class="ew-subtab-btn" data-subtarget="subSituations" style="flex: 1; padding: 8px; background: transparent; color: #b9c5c3; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;">Situations</button>
                                    </div>

                                    <div class="ew-subtab-content" id="subOverview" style="display: block; font-size: 12px; color: #cbd5d1;">
                                        <h4 id="ovCaseTitle" style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">—</h4>
                                        <p id="ovCaseDate" style="color: #8a9b99; margin-bottom: 12px;">—</p>
                                        <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                                            <span id="ovSeverityBadge" style="background: #d9534f; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px;">CRITICAL</span>
                                            <span id="ovStatusBadge" style="background: #223c47; border: 1px solid rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 10px;">Unit Dispatched</span>
                                        </div>
                                        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                                            <strong style="color: #fff; display: block; margin-bottom: 4px;">CASE PARAMETERS &amp; INTAKE SUMMARY</strong>
                                            <p id="ovDescriptionText" style="margin: 0; line-height: 1.5;">—</p>
                                        </div>
                                    </div>

                                    <div class="ew-subtab-content" id="subSituations" style="display: none;"><!-- Rendered by captain-geo.js --></div>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom-Left Widgets -->
                        <div class="geo-bottom-left">
                            <div class="geo-widget-pill" id="gridPill">Duale Grid [14.550, 120.591]</div>
                            <div class="geo-widget-pill" id="scalePill">500 m</div>
                        </div>
                    </div>
                </div>
            </section>

			<!-- VIEW 6: ANALYTICS & REPORTS -->
			<section class="admin-view" id="view-analytics" hidden>
				<div class="section-heading"><div><h2>Analytics &amp; Official Reports</h2><p>Explore incident patterns and prepare clear, system-generated reports from available case records.</p></div><button type="button" class="button button-primary" data-generate-report style="background: #173d3b; border-color: #173d3b;">Generate Report</button></div>
				<form class="content-panel analytics-filters" id="analyticsFilters">
					<div class="panel-heading"><div><h2>Filter incident data</h2><p>Filters apply to analytics, incident records, and generated reports.</p></div></div>
					<div class="filter-toolbar">
						<div class="filter-toolbar-row">
							<label>Year<select id="analyticsYear" name="year"><option value="">All years</option></select></label>
							<label>Reporting period<select id="analyticsMonth" name="month"><option value="">All months</option><option value="1">January</option><option value="2">February</option><option value="3">March</option><option value="4">April</option><option value="5">May</option><option value="6">June</option><option value="7">July</option><option value="8">August</option><option value="9">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select></label>
							<label>From<input id="analyticsFrom" name="from" type="date"></label>
							<label>To<input id="analyticsTo" name="to" type="date"></label>
						</div>
						<details class="advanced-filters">
							<summary>Advanced Filters</summary>
							<div class="advanced-filter-grid">
								<label>Category<select id="analyticsCategory" name="category"><option value="">All categories</option></select></label>
								<label>Purok<select id="analyticsPurok" name="purok"><option value="">All puroks</option></select></label>
								<label>Case status<select id="analyticsStatus" name="status"><option value="">All statuses</option></select></label>
							</div>
						</details>
					</div>
					<div class="filter-actions"><button class="button button-primary" type="submit" style="background: #173d3b; border-color: #173d3b;">Apply Filters</button><button class="button button-quiet" id="resetAnalyticsFilters" type="button">Reset</button><span id="analyticsLoading" class="filter-feedback" role="status" hidden>Loading incident records…</span></div>
					<p class="coverage-note" id="coverageNote"></p>
				</form>
				<div class="analytics-tabs" role="tablist" aria-label="Analytics and reporting sections">
					<button type="button" role="tab" id="analyticsTab" aria-controls="analyticsPanel" aria-selected="true" tabindex="0" data-report-tab="analytics">Analytics</button>
					<button type="button" role="tab" id="recordsTab" aria-controls="recordsPanel" aria-selected="false" tabindex="-1" data-report-tab="records">Incident Records</button>
					<button type="button" role="tab" id="reportsTab" aria-controls="reportsPanel" aria-selected="false" tabindex="-1" data-report-tab="reports">Reports</button>
				</div>
				<div role="tabpanel" id="analyticsPanel" aria-labelledby="analyticsTab" class="analytics-tab-panel">
					<div class="summary-cards" aria-label="Filtered incident totals">
						<button class="summary-card" type="button" data-summary-filter=""><span class="summary-card-heading">Total Incidents <i aria-hidden="true">▦</i></span><strong id="analyticsTotal">—</strong><small>In the selected period</small></button>
						<button class="summary-card" type="button" data-summary-filter="pending"><span class="summary-card-heading">Pending / Open Cases <i aria-hidden="true">✎</i></span><strong id="analyticsPending">—</strong><small>Awaiting action</small></button>
						<button class="summary-card" type="button" data-summary-filter="ongoing"><span class="summary-card-heading">Ongoing Cases <i aria-hidden="true">↻</i></span><strong id="analyticsOngoing">—</strong><small>In progress or mediation</small></button>
						<button class="summary-card" type="button" data-summary-filter="resolved"><span class="summary-card-heading">Resolved Cases <i aria-hidden="true">✓</i></span><strong id="analyticsResolved">—</strong><small>Marked resolved</small></button>
						<button class="summary-card" type="button" data-summary-filter="priority"><span class="summary-card-heading">High-Priority Cases <i aria-hidden="true">!</i></span><strong id="analyticsCritical">—</strong><small>Open high-priority cases</small></button>
					</div>
					<div class="analytics-grid analytics-grid-2">
						<section class="content-panel"><div class="panel-heading"><div><h2>Incident trends over time</h2><p>Monthly counts for the selected year and filters.</p></div></div><div id="trendChart2" class="chart-box"></div><p class="empty-message chart-empty" id="trendEmpty" hidden>No incident records found for this period.</p></section>
						<section class="content-panel"><div class="panel-heading"><div><h2>Incidents by category</h2><p>Actual incident records, highest first.</p></div></div><div id="categoryBars" class="bar-list"></div><p class="empty-message chart-empty" id="categoryEmpty" hidden>No incident records found for this period.</p></section>
						<section class="content-panel"><div class="panel-heading"><div><h2>Case status distribution</h2><p>Counts follow the current system workflow.</p></div></div><div id="statusBars" class="bar-list"></div><p class="empty-message chart-empty" id="statusEmpty" hidden>No incident records found for this period.</p></section>
						<section class="content-panel"><div class="panel-heading"><div><h2>Incidents by purok</h2><p>Compare reported incidents by location.</p></div></div><div id="analyticsPurokBars" class="bar-list"></div><p class="empty-message chart-empty" id="purokEmpty" hidden>No incident records found for this period.</p></section>
						<section class="content-panel year-comparison-panel"><div class="panel-heading"><div><h2>Year-over-year comparison</h2><p>Compare similar calendar periods across available years; completeness is not tracked.</p></div></div><div id="yearComparison" class="bar-list"></div><p class="empty-message chart-empty" id="yearComparisonEmpty" hidden>No historical incident records found.</p></section>
					</div>
				</div>
				<div role="tabpanel" id="recordsPanel" aria-labelledby="recordsTab" class="analytics-tab-panel" hidden>
					<div class="content-panel">
						<div class="panel-heading"><div><h2 id="tableReportTitle">Monthly Incident Summary</h2><p>Search, sort, and page through records matching the applied filters.</p></div><label class="select-field">Report type<select id="tableReportType"><option value="monthly">Monthly Incident Summary</option><option value="yearly">Yearly Incident Summary</option><option value="purok">Purok Incident Summary</option><option value="register">Incident Case Register</option><option value="resolution">Case Resolution &amp; Endorsement Report</option></select></label></div>
						<div class="toolbar"><label class="search-field"><span class="sr-only">Search incident records</span><input type="search" id="reportTableSearch" placeholder="Search this report"></label><span class="filter-feedback" id="reportResultCount" aria-live="polite"></span></div>
						<div class="table-scroll"><table id="reportTable"><thead></thead><tbody></tbody></table></div>
						<p class="empty-message" id="reportTableEmpty" hidden>No incident records found for this period.</p>
						<div class="report-pagination"><button type="button" class="button button-quiet" id="reportPrev" aria-label="Previous report page">Previous</button><span id="reportPageLabel" aria-live="polite">Page 1 of 1</span><button type="button" class="button button-quiet" id="reportNext" aria-label="Next report page">Next</button></div>
					</div>
				</div>
				<div role="tabpanel" id="reportsPanel" aria-labelledby="reportsTab" class="analytics-tab-panel" hidden>
					<div class="content-panel report-builder">
						<div class="panel-heading"><div><h2>Generate a system report</h2><p>Select the report and reporting period. Preview and print use the same report content.</p></div></div>
						<form id="reportForm">
							<div class="filter-grid">
								<label>Report type<select id="reportType" name="type"><option value="monthly">Monthly Incident Report</option><option value="annual">Annual Incident Report</option><option value="category">Incident Summary by Category</option><option value="purok">Incident Summary by Purok</option><option value="resolution">Case Resolution Report</option><option value="endorsement">Case Endorsement Report</option><option value="custom">Custom Date Range Report</option><option value="dilg">Monthly DILG Report (system-generated data)</option></select></label>
								<label>Year<select id="reportYear" name="year"><option value="">Select year</option></select></label>
								<label>Month<select id="reportMonth" name="month"><option value="">Select month</option><option value="1">January</option><option value="2">February</option><option value="3">March</option><option value="4">April</option><option value="5">May</option><option value="6">June</option><option value="7">July</option><option value="8">August</option><option value="9">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select></label>
								<label>From date<input id="reportFrom" name="from" type="date"></label>
								<label>To date<input id="reportTo" name="to" type="date"></label>
								<label>Category<select id="reportCategory" name="category"><option value="">All categories</option></select></label>
								<label>Purok<select id="reportPurok" name="purok"><option value="">All puroks</option></select></label>
								<label>Case status<select id="reportStatus" name="status"><option value="">All statuses</option></select></label>
							</div>
							<div class="filter-actions"><button class="button button-primary" type="submit" style="background: #173d3b; border-color: #173d3b;">Preview Report</button><button class="button button-quiet" id="printReport" type="button" disabled>Print / Save as PDF</button></div>
						</form>
						<div id="reportPreview" class="report-preview" aria-live="polite" hidden></div>
					</div>
				</div>
			</section>

            <!-- VIEW 7: PROFILE & SETTINGS -->
            <section class="admin-view" id="view-settings" hidden>
                <div class="section-heading">
                    <div>
                        <h2>Profile &amp; Settings</h2>
                        <p>Review executive details and manage account security.</p>
                    </div>
                </div>

                <div class="settings-stack">
                    <div class="content-panel profile-card">
                        <form id="profileForm" enctype="multipart/form-data">
                            <div class="profile-header-group">
                                <div class="profile-avatar-wrap">
                                    <div class="profile-avatar-lg" id="settingsAvatarBadge">
                                        <span id="settingsAvatarInitials"><?= strtoupper(substr($captainName, 0, 2)) ?></span>
                                        <img id="settingsAvatarPreview" alt="Profile Preview" style="display: none;">
                                    </div>
                                    <label class="avatar-upload-trigger" for="settingsPhotoInput" title="Upload new photo" aria-label="Upload photo">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                            <circle cx="12" cy="13" r="4"/>
                                        </svg>
                                    </label>
                                    <input type="file" name="profile_picture" id="settingsPhotoInput" accept="image/png,image/jpeg,image/webp" class="sr-only">
                                </div>
                                
                                <div class="profile-title-block">
                                    <h2 id="settingsProfileName">Capt. <?= $captainName ?></h2>
                                    <span class="role-badge">Punong Barangay</span>
                                </div>

                                <div class="profile-save-action">
                                    <button class="button button-quiet" type="submit" id="saveProfileBtn">Save Profile Details</button>
                                </div>
                            </div>

                            <div class="profile-meta-grid">
                                <div class="meta-item">
                                    <label class="meta-label" for="settingsName">FULL NAME</label>
                                    <input class="meta-input" name="full_name" id="settingsName" value="<?= $captainName ?>" required>
                                </div>

                                <div class="meta-item">
                                    <span class="meta-label">USERNAME / LOGIN</span>
                                    <strong class="meta-value"><?= htmlspecialchars((string)($currentUser['username'] ?? $currentUser['email_or_phone'] ?? '—'), ENT_QUOTES, 'UTF-8') ?></strong>
                                </div>

                                <div class="meta-item">
                                    <span class="meta-label">ROLE TYPE</span>
                                    <strong class="meta-value"><?= htmlspecialchars((string)($currentUser['user_type'] ?? 'Barangay Captain'), ENT_QUOTES, 'UTF-8') ?></strong>
                                </div>

                                <div class="meta-item">
                                    <label class="meta-label" for="settingsContact">CONTACT NUMBER</label>
                                    <input class="meta-input" name="contact_number" id="settingsContact" value="<?= htmlspecialchars((string)($currentUser['contact_number'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" placeholder="e.g. 09171234567">
                                </div>
                            </div>
                        </form>
                    </div>

                    <!-- Change Password Card -->
                    <div class="content-panel password-card">
                        <div class="panel-heading">
                            <div>
                                <h2>Change Password</h2>
                                <p>Ensure your account uses a secure password.</p>
                            </div>
                        </div>

                        <form class="settings-password-form" id="passwordForm">
                            <div class="form-group">
                                <label for="current_password">Current Password</label>
                                <input name="current_password" id="current_password" type="password" autocomplete="current-password" placeholder="••••••••" required>
                            </div>

                            <div class="form-group">
                                <label for="new_password">New Password</label>
                                <input name="new_password" id="new_password" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" required>
                            </div>

                            <div class="form-group">
                                <label for="confirm_password">Confirm New Password</label>
                                <input name="confirm_password" id="confirm_password" type="password" minlength="8" autocomplete="new-password" placeholder="••••••••" required>
                            </div>

                            <div class="form-actions">
                                <button class="button button-primary" type="submit" style="background: #173d3b; border-color: #173d3b;">Update Password</button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        </main>
    </div>

    <!-- MODALS & DIALOGS -->
    <dialog class="admin-dialog" id="advisoryDialog">
        <form id="advisoryForm" method="dialog">
            <div class="dialog-heading">
                <div>
                    <p class="eyebrow">BARANGAY ADVISORY</p>
                    <h2>Issue advisory</h2>
                </div>
                <button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button>
            </div>
            <label>Title
                <input name="title" maxlength="120" required>
            </label>
            <label>Applies to
                <select name="purok_id" id="advisoryPurok">
                    <option value="">Whole barangay</option>
                </select>
            </label>
            <label>Message
                <textarea name="body" rows="5" required></textarea>
            </label>
            <div class="dialog-actions">
                <button class="button button-quiet" type="button" data-close-dialog>Cancel</button>
                <button class="button button-primary" type="submit" style="background: #173d3b; border-color: #173d3b;">Publish advisory</button>
            </div>
        </form>
    </dialog>

    <dialog class="admin-dialog" id="endorseDialog">
        <form id="endorseForm" method="dialog">
            <div class="dialog-heading">
                <div>
                    <p class="eyebrow">FORMAL ENDORSEMENT</p>
                    <h2 id="endorseTitle">Endorse case</h2>
                </div>
                <button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button>
            </div>
            <div id="endorseDetails" class="detail-content"></div>
            <input type="hidden" name="id">
            <label>Remarks (optional)
                <textarea name="remarks" rows="3"></textarea>
            </label>
            <div class="dialog-actions">
                <button class="button button-quiet" type="button" data-close-dialog>Cancel</button>
                <button class="button button-primary" type="submit" id="endorseSubmit" style="background: #173d3b; border-color: #173d3b;">Endorse / Sign</button>
            </div>
        </form>
    </dialog>

    <dialog class="admin-dialog" id="caseDialog">
        <div class="dialog-heading">
            <div>
                <p class="eyebrow">CASE RECORD (READ-ONLY)</p>
                <h2 id="caseDialogTitle">Case details</h2>
            </div>
            <button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button>
        </div>
        <div id="caseDetails" class="detail-content"></div>
        <div class="dialog-actions">
            <button class="button button-quiet" type="button" data-close-dialog>Close</button>
        </div>
    </dialog>

    <!-- MAP LAYERS MODAL -->
    <dialog class="admin-dialog" id="mapLayersDialog" style="width: 480px; max-width: 95vw; background: #172b35; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px;">
        <div class="dialog-heading" style="border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">Map Layers</h3>
            <button class="icon-button" type="button" data-close-layers aria-label="Close" style="background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;">×</button>
        </div>
        <div style="min-height: 180px; display: grid; place-items: center; color: #8a9b99; font-size: 13px;">
            <p>No map layers configured yet.</p>
        </div>
        <div class="dialog-actions" style="margin-top: 16px; text-align: right;">
            <button class="button button-quiet" type="button" data-close-layers style="background: #223c47; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Done</button>
        </div>
    </dialog>

	<script src="sidebar.js?v=<?= time() ?>" defer></script>
	<script src="captain-dashboard.js?v=<?= time() ?>" defer></script>
</body>
</html>