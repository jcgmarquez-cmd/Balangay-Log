<?php
session_start();
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

// Database configuration
$host = "127.0.0.1";
$db   = "balangaylog_db";
$user = "root";
$pass = "";
$charset = "utf8mb4";

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false, // True SQL-injection proof prepared statements
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
    exit();
}

// 1. Brute-force protection: Max 5 attempts within a 5-minute cooldown window
$max_attempts = 5;
$lockout_seconds = 300;

if (!isset($_SESSION['login_attempts'])) {
    $_SESSION['login_attempts'] = 0;
    $_SESSION['first_failed_time'] = time();
}

if ($_SESSION['login_attempts'] >= $max_attempts) {
    $time_elapsed = time() - $_SESSION['first_failed_time'];
    if ($time_elapsed < $lockout_seconds) {
        $remaining = ceil(($lockout_seconds - $time_elapsed) / 60);
        echo json_encode([
            'success' => false,
            'message' => "Too many failed attempts. Access temporarily locked. Try again in $remaining minute(s)."
        ]);
        exit();
    } else {
        // Cooldown period passed
        $_SESSION['login_attempts'] = 0;
        $_SESSION['first_failed_time'] = time();
    }
}

// 2. Parse incoming JSON input
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$identifier = trim($data['username'] ?? '');
$password   = $data['password'] ?? '';

if (empty($identifier) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please enter both username/email and password.']);
    exit();
}

// 3. SQL Injection Proof: Parameterized query checking exact columns: email_or_phone or full_name
try {
    $stmt = $pdo->prepare("SELECT id, full_name, email_or_phone, password_hash, user_type, authorization_status 
                           FROM users 
                           WHERE email_or_phone = :id1 OR full_name = :id2 
                           LIMIT 1");
    $stmt->execute([
        'id1' => $identifier,
        'id2' => $identifier
    ]);
    $userRecord = $stmt->fetch();

    $isValid = false;

    if ($userRecord) {
        // Check account authorization
        if (isset($userRecord['authorization_status']) && $userRecord['authorization_status'] === 'DEACTIVATED') {
            echo json_encode(['success' => false, 'message' => 'This account has been deactivated. Contact your administrator.']);
            exit();
        }

        // Verify password against password_hash (supports hash and plain text fallback)
        if (password_verify($password, $userRecord['password_hash']) || $password === $userRecord['password_hash']) {
            $isValid = true;
        }
    }

    if ($isValid) {
        // Reset brute-force counter on success
        $_SESSION['login_attempts'] = 0;

        // Session identity
        $_SESSION['user_id']   = $userRecord['id'];
        $_SESSION['full_name'] = $userRecord['full_name'];
        $_SESSION['user_type'] = $userRecord['user_type'];

        $token = bin2hex(random_bytes(32));

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => [
                'id'        => $userRecord['id'],
                'full_name' => $userRecord['full_name'],
                'email'     => $userRecord['email_or_phone'],
                'role'      => strtoupper($userRecord['user_type'])
            ]
        ]);
    } else {
        $_SESSION['login_attempts']++;
        $remainingAttempts = max(0, $max_attempts - $_SESSION['login_attempts']);

        $message = 'Invalid username/email or password.';
        if ($remainingAttempts > 0) {
            $message .= " ($remainingAttempts attempt(s) remaining before lockout)";
        } else {
            $message = "Too many failed attempts. Temporary lockout activated for 5 minutes.";
        }

        echo json_encode(['success' => false, 'message' => $message]);
    }
} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database query error: ' . $e->getMessage()]);
}
exit();