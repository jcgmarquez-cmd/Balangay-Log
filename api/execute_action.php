<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

$conn = new mysqli("localhost", "root", "", "balangaylog_db");

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

$refNumber = trim($input['reference_number'] ?? '');
$actionType = trim($input['action_type'] ?? 'DISPATCH');

if (empty($refNumber)) {
    echo json_encode(['success' => false, 'message' => 'Reference number is required.']);
    exit();
}

// 1. Determine new status based on protocol action
$newStatus = ($actionType === 'LUPON') ? 'FOR_RESOLUTION' : 'IN_PROGRESS';

// 2. Update status in incident_reports
$stmt = $conn->prepare("UPDATE incident_reports SET status = ? WHERE reference_number = ?");
$stmt->bind_param("ss", $newStatus, $refNumber);

if ($stmt->execute() && $stmt->affected_rows > 0) {
    echo json_encode([
        'success' => true,
        'message' => "Action executed successfully.",
        'new_status' => $newStatus,
        'reference_number' => $refNumber,
        'timestamp' => date('g:i A')
    ]);
} else {
    echo json_encode([
        'success' => false, 
        'message' => 'Case not found or status was already updated.'
    ]);
}

$stmt->close();
$conn->close();