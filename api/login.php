<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed."]);
    exit();
}

$rawInput = file_get_contents("php://input");
$data = json_decode($rawInput, true);

// Accept either 'username' or 'email' from the frontend
$loginId = trim($data['username'] ?? ($data['email'] ?? ''));
$password = trim($data['password'] ?? '');

if (empty($loginId) || empty($password)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Username/Email and password are required."]);
    exit();
}

// -------------------------------------------------------------
// 1. Check Hardcoded Accounts (Legacy / Demo Access)
// -------------------------------------------------------------
$staticAccounts = [
    [
        "username" => "capitan.reyes",
        "password" => "captain123",
        "name"     => "Reyes",
        "role"     => "Barangay Captain"
    ],
    [
        "username" => "officer.santos",
        "password" => "officer123",
        "name"     => "Maria Santos",
        "role"     => "Desk Officer"
    ]
];

foreach ($staticAccounts as $acc) {
    if ($acc['username'] === $loginId && $acc['password'] === $password) {
        echo json_encode([
            "success" => true,
            "message" => "Login successful!",
            "token"   => "php-jwt-" . bin2hex(random_bytes(16)),
            "user"    => [
                "name"     => $acc['name'],
                "role"     => $acc['role'],
                "username" => $acc['username']
            ]
        ]);
        exit();
    }
}

// -------------------------------------------------------------
// 2. Query MySQL 'users' Table (User Management Module)
// -------------------------------------------------------------
$conn = new mysqli("127.0.0.1", "root", "", "balangaylog_db", 3306);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection error."]);
    exit();
}

$stmt = $conn->prepare("SELECT id, full_name, email_or_phone, password_hash, user_type, authorization_status FROM users WHERE email_or_phone = ?");
$stmt->bind_param("s", $loginId);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    // Check Authorization Status
    if ($row['authorization_status'] === 'DEACTIVATED') {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "This account has been deactivated by the administrator."]);
        $stmt->close();
        $conn->close();
        exit();
    }

    // Verify Bcrypt Password Hash
    if (password_verify($password, $row['password_hash'])) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Login successful!",
            "token"   => "php-jwt-" . bin2hex(random_bytes(16)),
            "user"    => [
                "id"       => (int)$row['id'],
                "name"     => $row['full_name'],
                "role"     => $row['user_type'],
                "username" => $row['email_or_phone']
            ]
        ]);
        $stmt->close();
        $conn->close();
        exit();
    }
}

$stmt->close();
$conn->close();

// -------------------------------------------------------------
// 3. Fallback: Invalid Credentials
// -------------------------------------------------------------
http_response_code(401);
echo json_encode(["success" => false, "message" => "Invalid username or password."]);