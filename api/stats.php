<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$liveStats = [
    "activeCases"     => 0,
    "resolvedMonth"   => 0,
    "residentsServed" => 0,
    "avgResolution"   => 0
];

http_response_code(200);
echo json_encode($liveStats);