<?php
/**
 * Location + heatmap helpers.
 * Used by lib/case_intake.php (to decide where a new case is plotted) and
 * api/get_heatmap_data.php (to turn case rows into map points).
 * Never prints anything and never touches the session.
 *
 * Optional setting (put in config/secrets.php): define('MAPBOX_GEOCODE_TOKEN', 'pk.xxxxx');
 * Without it, street lookups are skipped and cases are plotted at their purok center.
 */

if (!defined('BARANGAY_CENTER_LAT')) define('BARANGAY_CENTER_LAT', 14.5505);
if (!defined('BARANGAY_CENTER_LNG')) define('BARANGAY_CENTER_LNG', 120.5912);
// Search box around Barangay Duale: min lng, min lat, max lng, max lat (same box the old browser code used).
if (!defined('BARANGAY_BBOX')) define('BARANGAY_BBOX', [120.57, 14.53, 120.61, 14.57]);

/** True when both values are numbers inside a Bataan-wide sanity range. */
function loc_valid_point($lat, $lng): bool {
    if (!is_numeric($lat) || !is_numeric($lng)) return false;
    $lat = (float) $lat;
    $lng = (float) $lng;
    return $lat >= 14.2 && $lat <= 14.8 && $lng >= 120.3 && $lng <= 121.0;
}

/** True when the point lies inside the barangay search box (padded by about 2 km). */
function loc_in_barangay($lat, $lng): bool {
    if (!loc_valid_point($lat, $lng)) return false;
    [$minLng, $minLat, $maxLng, $maxLat] = BARANGAY_BBOX;
    $pad = 0.02;
    return (float) $lat >= $minLat - $pad && (float) $lat <= $maxLat + $pad
        && (float) $lng >= $minLng - $pad && (float) $lng <= $maxLng + $pad;
}

/** The old browser code sent this exact pair whenever geocoding did not run. It is not a real location. */
function loc_is_legacy_fallback($lat, $lng): bool {
    return is_numeric($lat) && is_numeric($lng)
        && abs((float) $lat - BARANGAY_CENTER_LAT) < 0.000001
        && abs((float) $lng - BARANGAY_CENTER_LNG) < 0.000001;
}

/**
 * Reads a Mapbox geocoding response and returns ['lat' =>, 'lng' =>] only for a precise match
 * (an address or a point of interest, good relevance, inside the barangay). Anything vaguer returns null.
 */
function loc_pick_feature(array $json): ?array {
    $f = $json['features'][0] ?? null;
    if (!is_array($f)) return null;
    if ((float) ($f['relevance'] ?? 0) < 0.7) return null;
    $types = (array) ($f['place_type'] ?? []);
    if (!array_intersect($types, ['address', 'poi'])) return null;
    $c = $f['geometry']['coordinates'] ?? ($f['center'] ?? null);
    if (!is_array($c) || count($c) < 2) return null;
    $lng = (float) $c[0];
    $lat = (float) $c[1];
    return loc_in_barangay($lat, $lng) ? ['lat' => $lat, 'lng' => $lng] : null;
}

/** Small HTTP GET with short timeouts. Returns the body or null. */
function loc_http_get(string $url, int $timeoutSec = 3): ?string {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 2,
            CURLOPT_TIMEOUT        => $timeoutSec,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        $body = curl_exec($ch);
        if ($body === false) {
            error_log('[geo] lookup failed: ' . curl_error($ch));
            curl_close($ch);
            return null;
        }
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($code >= 200 && $code < 300) ? (string) $body : null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => $timeoutSec, 'ignore_errors' => true]]);
    $body = @file_get_contents($url, false, $ctx);
    return $body === false ? null : $body;
}

/** Looks the street up with Mapbox. Returns null when there is no token, no street, no precise match, or any error. */
function loc_geocode_street(string $street): ?array {
    $street = trim($street);
    $token  = defined('MAPBOX_GEOCODE_TOKEN') ? (string) MAPBOX_GEOCODE_TOKEN : (string) getenv('MAPBOX_GEOCODE_TOKEN');
    if ($street === '' || $token === '') return null;
    $query = $street . ', Duale, Limay, Bataan, Philippines';
    $url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' . rawurlencode($query) . '.json'
         . '?access_token=' . rawurlencode($token)
         . '&bbox=' . implode(',', BARANGAY_BBOX)
         . '&country=ph&types=address,poi&limit=1';
    $body = loc_http_get($url);
    if ($body === null) return null;
    $json = json_decode($body, true);
    return is_array($json) ? loc_pick_feature($json) : null;
}

/** Center point saved for a purok (system_puroks.center_lat / center_lng), or null if not set yet. */
function loc_purok_center(?PDO $pdo, string $purok): ?array {
    if ($pdo === null || trim($purok) === '') return null;
    try {
        $st = $pdo->prepare('SELECT center_lat, center_lng FROM system_puroks WHERE name = ? LIMIT 1');
        $st->execute([$purok]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if ($row && loc_valid_point($row['center_lat'] ?? null, $row['center_lng'] ?? null)) {
            return ['lat' => (float) $row['center_lat'], 'lng' => (float) $row['center_lng']];
        }
    } catch (Throwable $e) {
        error_log('[geo] purok center lookup failed: ' . $e->getMessage());
    }
    return null;
}

/**
 * Decides where a case is plotted. Order:
 *   SUPPLIED  - valid coordinates sent by the caller (and not the old fixed fallback)
 *   GEOCODED  - precise Mapbox match for the street
 *   PUROK     - the purok's saved center
 *   BARANGAY  - the barangay center (last resort)
 * Returns ['lat' => float, 'lng' => float, 'accuracy' => string]. Never fails.
 */
function resolve_incident_location(?PDO $pdo, string $street, string $purok, $suppliedLat = null, $suppliedLng = null): array {
    if (loc_in_barangay($suppliedLat, $suppliedLng) && !loc_is_legacy_fallback($suppliedLat, $suppliedLng)) {
        return ['lat' => (float) $suppliedLat, 'lng' => (float) $suppliedLng, 'accuracy' => 'SUPPLIED'];
    }
    $g = loc_geocode_street($street);
    if ($g !== null) return $g + ['accuracy' => 'GEOCODED'];
    $p = loc_purok_center($pdo, $purok);
    if ($p !== null) return $p + ['accuracy' => 'PUROK'];
    return ['lat' => BARANGAY_CENTER_LAT, 'lng' => BARANGAY_CENTER_LNG, 'accuracy' => 'BARANGAY'];
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

/** Priority label the map understands: critical, high, moderate or low. Uses priority_level first (it is the authoritative field). */
function heatmap_severity_label(array $row): string {
    $raw = '';
    foreach (['priority_level', 'severity'] as $k) {
        if (isset($row[$k]) && trim((string) $row[$k]) !== '') { $raw = strtolower(trim((string) $row[$k])); break; }
    }
    if ($raw === '') return 'low';
    if (strpos($raw, 'crit') !== false || strpos($raw, 'urgent') !== false || $raw === '4') return 'critical';
    if (strpos($raw, 'high') !== false || $raw === '3') return 'high';
    if (strpos($raw, 'mod') !== false || strpos($raw, 'med') !== false || $raw === '2') return 'moderate';
    return 'low';
}

function heatmap_weight(string $label): float {
    return ['critical' => 1.0, 'high' => 0.8, 'moderate' => 0.5, 'low' => 0.25][$label] ?? 0.25;
}

/** Turns one incident_reports row into a map point, or null when the row has no usable location. Never invents a location. */
function heatmap_row_to_point(array $row): ?array {
    if (!loc_valid_point($row['latitude'] ?? null, $row['longitude'] ?? null)) return null;
    $label = heatmap_severity_label($row);
    $title = trim((string) ($row['incident_type'] ?? '')) ?: 'Incident Report';
    $when  = (string) ($row['created_at'] ?? $row['incident_datetime'] ?? '');
    $narr  = trim((string) ($row['narrative_description'] ?? ''));
    if ($narr === '') $narr = 'Logged in system.';
    $narr  = function_exists('mb_substr') ? mb_substr($narr, 0, 500) : substr($narr, 0, 500);
    $officer = trim((string) ($row['assigned_officer_name'] ?? ''));
    return [
        'id'           => (int) ($row['id'] ?? 0),
        'case_no'      => (string) ($row['reference_number'] ?? ''),
        'lat'          => (float) $row['latitude'],
        'lng'          => (float) $row['longitude'],
        'intensity'    => heatmap_weight($label),
        'weight'       => heatmap_weight($label),
        'severity'     => $label,
        'title'        => $title,
        'purok'        => trim((string) ($row['purok'] ?? '')) ?: 'Unspecified',
        'date'         => substr($when, 0, 19),
        'category'     => $title,
        'officer'      => $officer !== '' ? $officer : 'Desk Officer',
        'observations' => $narr,
        'status'       => (string) ($row['status'] ?? ''),
        'accuracy'     => (string) ($row['location_accuracy'] ?? 'UNKNOWN'),
    ];
}