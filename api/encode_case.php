<?php
// Suppress raw HTML errors to keep JSON output valid
error_reporting(E_ALL);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$conn = new mysqli("127.0.0.1", "root", "", "balangaylog_db", 3306);

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Direct assignment with safe defaults
$name        = !empty(trim($input['complainantName'] ?? '')) ? trim($input['complainantName']) : 'Walk-In Resident';
$phone       = !empty(trim($input['complainantPhone'] ?? '')) ? trim($input['complainantPhone']) : '09000000000';
$purok       = !empty(trim($input['purok'] ?? '')) ? trim($input['purok']) : 'Sitio Masaya';
$street      = trim($input['streetAddress'] ?? '');
$type        = !empty(trim($input['incidentCategory'] ?? ($input['category'] ?? ''))) ? trim($input['incidentCategory'] ?? $input['category']) : 'General Incident';
$title       = !empty(trim($input['incidentTitle'] ?? '')) ? trim($input['incidentTitle']) : 'Incident Blotter Entry';
$narrative   = !empty(trim($input['incidentNarrative'] ?? ($input['narrative'] ?? ''))) ? trim($input['incidentNarrative'] ?? $input['narrative']) : 'No blotter notes provided.';
$userPriority= trim($input['priorityLevel'] ?? ($input['priority'] ?? 'Medium'));

$lat         = floatval($input['lat'] ?? 14.545300);
$lng         = floatval($input['lng'] ?? 120.573900);
if ($lat == 0.0) $lat = 14.545300;
if ($lng == 0.0) $lng = 120.573900;

// Base priority set from user input
$priority = in_array($userPriority, ['Low', 'Moderate', 'Medium', 'High', 'Critical']) ? $userPriority : 'Medium';
if ($priority === 'Medium') $priority = 'Moderate'; // Normalize to enum if needed

// Heuristic keyword analysis
$criticalKeywords = ['weapon', 'gun', 'baril', 'knife', 'patalim', 'dugo', 'bleeding', 'stab', 'sinaksak', 'hostage', 'sunog', 'fire', 'holdap'];
$highKeywords     = ['sapakan', 'suntukan', 'altercation', 'nakawan', 'theft', 'nakaw'];

$textToAnalyze = strtolower($title . ' ' . $narrative);

$urgencyScore = 20.00;
$recommendation = 'Standard administrative intake. Log for regular review.';

// Escalate ONLY if explicit life-safety keywords are detected in the actual narrative/title
$hasCriticalWord = false;
foreach ($criticalKeywords as $kw) {
    if (strpos($textToAnalyze, $kw) !== false) {
        $hasCriticalWord = true;
        break;
    }
}

if ($hasCriticalWord || $userPriority === 'Critical') {
    $urgencyScore = 85.00;
    $priority = 'Critical';
    $recommendation = 'Critical threat detected. Dispatch Immediate Response Unit and alert PNP.';
} elseif ($userPriority === 'High') {
    $urgencyScore = 65.00;
    $priority = 'High';
    $recommendation = 'Active altercation. Deploy 2 field Tanods for on-site pacification.';
} elseif ($userPriority === 'Low') {
    $urgencyScore = 20.00;
    $priority = 'Low';
    $recommendation = 'Standard administrative intake. Log for regular review.';
} else {
    $urgencyScore = 40.00;
    $priority = 'Moderate';
    $recommendation = 'Eligible for Katarungang Pambarangay. Issue notice to summon for Lupon mediation.';
}

// Generate Reference ID
$year = date('Y');
$countRes = $conn->query("SELECT COUNT(*) as total FROM incident_reports");
$rowCount = ($countRes) ? ($countRes->fetch_assoc()['total'] + 1) : 1;
$trackingId = sprintf("TRK-%s-%03d", $year, $rowCount);

// Set Status based on the real priority
$initialStatus = ($priority === 'Critical') ? 'CRITICAL' : 'PENDING';
$dt = date('Y-m-d H:i:s');

$stmt = $conn->prepare("INSERT INTO incident_reports 
    (reference_number, complainant_name, complainant_phone, incident_type, narrative_description, incident_datetime, purok, latitude, longitude, verification_level, ai_urgency_score, priority_level, ai_recommendation, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?, ?)");

$stmt->bind_param("sssssssdddsss", $trackingId, $name, $phone, $type, $narrative, $dt, $purok, $lat, $lng, $urgencyScore, $priority, $recommendation, $initialStatus);

if ($stmt->execute()) {
    $newIncidentId = $stmt->insert_id;

    $actionNote = "Initial report logged as {$type}. Priority: {$priority} (Score: {$urgencyScore}).";
    $stmtM = $conn->prepare("INSERT INTO case_milestones (incident_id, tracking_id, status_snapshot, action_note) VALUES (?, ?, ?, ?)");
    $stmtM->bind_param("isss", $newIncidentId, $trackingId, $initialStatus, $actionNote);
    $stmtM->execute();
    $stmtM->close();

    echo json_encode([
        'success' => true,
        'message' => 'Incident filed successfully.',
        'data' => [
            'reference_number' => $trackingId,
            'title'            => $title,
            'complainant'      => $name,
            'category'         => $type,
            'priority'         => $priority,
            'status'           => $initialStatus,
            'urgency_score'    => $urgencyScore,
            'recommendation'   => $recommendation
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Database insert error: ' . $stmt->error]);
}

$stmt->close();
$conn->close();