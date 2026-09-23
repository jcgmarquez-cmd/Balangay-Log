<?php
// Suppress raw HTML error display so JSON won't break
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli("127.0.0.1", "root", "", "balangaylog_db", 3306);

if ($conn->connect_error) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $conn->connect_error,
        'counts' => [
            'pending' => 0,
            'in_progress' => 0,
            'for_resolution' => 0,
            'resolved' => 0,
            'critical' => 0,
            'total' => 0
        ],
        'recent_cases' => []
    ]);
    exit();
}

$counts = [
    'pending' => 0,
    'in_progress' => 0,
    'for_resolution' => 0,
    'resolved' => 0,
    'critical' => 0,
    'total' => 0
];

// 1. Tally active statuses
$sql = "SELECT status, COUNT(*) as cnt FROM incident_reports GROUP BY status";
$res = $conn->query($sql);

if ($res) {
    while ($row = $res->fetch_assoc()) {
        $statusKey = strtolower($row['status']);
        if (array_key_exists($statusKey, $counts)) {
            $counts[$statusKey] = (int)$row['cnt'];
        }
        $counts['total'] += (int)$row['cnt'];
    }
}

// 2. Fetch Recent Cases
$recent = [];
$recRes = $conn->query("SELECT reference_number, incident_type, purok, status, priority_level, created_at FROM incident_reports ORDER BY id DESC LIMIT 6");

if ($recRes) {
    while ($row = $recRes->fetch_assoc()) {
        $recent[] = $row;
    }
}

echo json_encode([
    'success' => true,
    'counts' => $counts,
    'recent_cases' => $recent
]);

$conn->close();