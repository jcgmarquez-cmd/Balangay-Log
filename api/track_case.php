<?php
header('Content-Type: application/json');
$conn = new mysqli("localhost", "root", "", "balangaylog_db");

$trackingId = trim($_GET['tracking_id'] ?? '');

if (empty($trackingId)) {
    echo json_encode(['success' => false, 'message' => 'Tracking ID is required.']);
    exit();
}

$stmt = $conn->prepare("SELECT * FROM incident_reports WHERE reference_number = ?");
$stmt->bind_param("s", $trackingId);
$stmt->execute();
$case = $stmt->get_result()->fetch_assoc();

if (!$case) {
    echo json_encode(['success' => false, 'message' => 'No matching case found.']);
    exit();
}

// Fetch Milestone Array
$mStmt = $conn->prepare("SELECT status_snapshot, officer_in_charge, deployed_unit, action_note, created_at FROM case_milestones WHERE tracking_id = ? ORDER BY id ASC");
$mStmt->bind_param("s", $trackingId);
$mStmt->execute();
$milestones = $mStmt->get_result()->fetch_all(MYSQLI_ASSOC);

echo json_encode([
    'success' => true,
    'case' => $case,
    'milestones' => $milestones
]);
$conn->close();