<?php
error_reporting(0);
ini_set('display_errors', 0);

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$host = "127.0.0.1";
$db   = "balangaylog_db";
$user = "root";
$pass = "";
$charset = "utf8mb4";

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection error.']);
    exit();
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$identifier = trim($data['username'] ?? '');

if (empty($identifier)) {
    echo json_encode(['success' => false, 'exists' => false, 'message' => 'Please enter your username or email first.']);
    exit();
}

// SQL-Injection Proof lookup in users table
$stmt = $pdo->prepare("SELECT full_name, email_or_phone FROM users WHERE email_or_phone = :id1 OR full_name = :id2 LIMIT 1");
$stmt->execute([
    'id1' => $identifier,
    'id2' => $identifier
]);
$found = $stmt->fetch();

if ($found) {
    echo json_encode([
        'success' => true,
        'exists'  => true,
        'name'    => $found['full_name']
    ]);
} else {
    echo json_encode([
        'success' => true,
        'exists'  => false,
        'message' => 'No registered account found with that username or email. Please enter an existing account.'
    ]);
}
exit();