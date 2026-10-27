<?php
/**
 * BalangayLog - Captain heatmap feed.
 * Returns one point per case (walk-in AND resident reports) that has a real location.
 * Captain only. Contract expected by captain-geo.js:
 *   { success, status, count, data: [ {id, lat, lng, intensity, severity, title, purok, date, category, officer, observations, photos: [paths], ...} ] }
 */
ob_start();
error_reporting(E_ALL);
ini_set('display_errors', '0');

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../lib/geo_helpers.php';
require_once __DIR__ . '/../lib/case_photos.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function heatmapRespond(array $payload, int $code = 200): void
{
    if (ob_get_length()) {
        ob_clean();
    }
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (!isLoggedIn()) {
    heatmapRespond(['success' => false, 'status' => 'error', 'message' => 'Your session has ended. Please sign in again.', 'data' => []], 401);
}
if (strtoupper(trim((string) getUserRole())) !== 'CAPTAIN') {
    heatmapRespond(['success' => false, 'status' => 'error', 'message' => 'Access restricted to the Barangay Captain.', 'data' => []], 403);
}
session_write_close();

try {
    $db = getDatabaseConnection();

    // Only select columns that exist, so a missing optional column never breaks the map.
    $existing = array_column($db->query('SHOW COLUMNS FROM incident_reports')->fetchAll(PDO::FETCH_ASSOC), 'Field');
    $wanted = ['id', 'reference_number', 'incident_type', 'narrative_description', 'purok', 'latitude', 'longitude',
               'priority_level', 'severity', 'status', 'created_at', 'incident_datetime',
               'assigned_officer_name', 'location_accuracy'];
    $select = array_values(array_intersect($wanted, $existing));
    foreach (['id', 'latitude', 'longitude'] as $must) {
        if (!in_array($must, $select, true)) {
            throw new RuntimeException("incident_reports is missing the {$must} column.");
        }
    }

    $where = in_array('status', $existing, true)
        ? "WHERE UPPER(COALESCE(status, '')) NOT LIKE '%SPAM%' AND UPPER(COALESCE(status, '')) NOT LIKE '%REJECT%'"
        : '';
    $order = in_array('created_at', $existing, true) ? 'created_at DESC' : 'id DESC';

    $sql  = 'SELECT ' . implode(', ', array_map(fn($c) => "`{$c}`", $select)) . " FROM incident_reports {$where} ORDER BY {$order} LIMIT 2000";
    $rows = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $points = [];
    $skipped = 0;
    foreach ($rows as $row) {
        $p = heatmap_row_to_point($row);
        if ($p === null) { $skipped++; continue; }
        $points[] = $p;
    }

    // Attach each case's photos (empty list when there are none or the photo table is not installed yet).
    $photoMap = case_photos_for_incidents($db, array_column($points, 'id'));
    foreach ($points as &$point) {
        $point['photos'] = $photoMap[(int) $point['id']] ?? [];
    }
    unset($point);

    heatmapRespond([
        'success'             => true,
        'status'              => 'success',
        'count'               => count($points),
        'skipped_no_location' => $skipped,
        'data'                => $points,
    ]);
} catch (Throwable $e) {
    error_log('[get_heatmap_data] ' . $e->getMessage());
    heatmapRespond(['success' => false, 'status' => 'error', 'message' => 'The heatmap data could not be loaded.', 'data' => []], 500);
}