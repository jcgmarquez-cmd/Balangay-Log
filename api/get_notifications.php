<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli("127.0.0.1", "root", "", "balangaylog_db", 3306);

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

// 1. Critical Emergencies (Immediate action required)
$criticalRes = $conn->query("SELECT id, reference_number, incident_type, purok, created_at 
    FROM incident_reports 
    WHERE (priority_level = 'Critical' OR status = 'CRITICAL') AND status != 'RESOLVED' 
    ORDER BY id DESC LIMIT 10");

$criticalCases = [];
if ($criticalRes) {
    while ($row = $criticalRes->fetch_assoc()) {
        $criticalCases[] = [
            'id' => $row['id'],
            'category_label' => 'CRITICAL EMERGENCY',
            'type' => 'critical',
            'title' => $row['incident_type'],
            'subtext' => $row['reference_number'] . ' · ' . $row['purok'],
            'badge_color' => '#dc2626',
            'border_color' => '#ef4444',
            'target_url' => 'dashboard.html#urgentBanner'
        ];
    }
}

// 2. High Priority Peace & Order Incidents
$highRes = $conn->query("SELECT id, reference_number, incident_type, purok, created_at 
    FROM incident_reports 
    WHERE priority_level = 'High' AND status != 'CRITICAL' AND status != 'RESOLVED' 
    ORDER BY id DESC LIMIT 10");

$highCases = [];
if ($highRes) {
    while ($row = $highRes->fetch_assoc()) {
        $highCases[] = [
            'id' => $row['id'],
            'category_label' => 'HIGH PRIORITY',
            'type' => 'high',
            'title' => $row['incident_type'],
            'subtext' => $row['reference_number'] . ' · ' . $row['purok'],
            'badge_color' => '#d97706',
            'border_color' => '#f97316',
            'target_url' => 'dashboard.html#caseListPanel'
        ];
    }
}

// 3. Unverified Citizen Reports (Spam / Fake Check Queue)
$spamRes = $conn->query("SELECT id, reference_number, incident_type, purok, created_at 
    FROM incident_reports 
    WHERE verification_level = 'UNVERIFIED' AND status != 'RESOLVED' 
    ORDER BY id DESC LIMIT 10");

$spamCases = [];
if ($spamRes) {
    while ($row = $spamRes->fetch_assoc()) {
        $spamCases[] = [
            'id' => $row['id'],
            'category_label' => 'UNVERIFIED / SPAM',
            'type' => 'spam',
            'title' => $row['incident_type'],
            'subtext' => $row['reference_number'] . ' · Pending Review',
            'badge_color' => '#475569',
            'border_color' => '#64748b',
            'target_url' => 'dashboard.html#caseListPanel'
        ];
    }
}

$countCritical = count($criticalCases);
$countHigh     = count($highCases);
$countSpam     = count($spamCases);
$totalCombined = $countCritical + $countHigh + $countSpam;

$allNotifications = array_merge($criticalCases, $highCases, $spamCases);

echo json_encode([
    'success' => true,
    'counts' => [
        'total' => $totalCombined,
        'critical' => $countCritical,
        'high' => $countHigh,
        'spam' => $countSpam
    ],
    'notifications' => $allNotifications
]);

$conn->close();