<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli("127.0.0.1", "root", "", "balangaylog_db", 3306);

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]);
    exit();
}

// Disable foreign key checks, wipe tables, reset auto-increment, re-enable checks
$conn->query("SET FOREIGN_KEY_CHECKS = 0");
$conn->query("TRUNCATE TABLE case_milestones");
$conn->query("TRUNCATE TABLE incident_reports");
$conn->query("SET FOREIGN_KEY_CHECKS = 1");

$conn->close();

echo json_encode([
    'success' => true,
    'message' => 'All test cases and milestones cleared successfully. IDs reset to 1.'
]);