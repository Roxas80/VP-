<?php
/**
 * Приём заказов с сайта для хостинга с PHP (Plesk без Node.js).
 * Сохраняет в MySQL. Опционально: отправка в Twenty CRM (настройте константы ниже).
 *
 * Настройка:
 * 1. Создайте БД и таблицу (см. backend/db/schema-mysql.sql).
 * 2. Скопируйте этот файл в каталог api/ на сайте (или переименуйте в order.php и настройте путь).
 * 3. Задайте константы DB_* ниже (или вынесите в отдельный config.php вне репозитория).
 * 4. В order.js укажите отправку на этот скрипт: fetch('/api/order.php', ...) вместо fetch('/api/orders', ...).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не разрешён']);
    exit;
}

// ——— Настройки (замените на данные из Plesk → Базы данных) ———
define('DB_HOST', 'localhost');
define('DB_NAME', 'vpa');
define('DB_USER', 'vpa_user');
define('DB_PASS', 'your_password');
define('DB_CHARSET', 'utf8mb4');

// Опционально: Twenty CRM (оставьте пустыми, если не используете)
define('TWENTY_API_URL', '');  // например https://crm.example.com
define('TWENTY_API_KEY', '');

// ——— Разбор тела запроса ———
$raw = file_get_contents('php://input');
$input = json_decode($raw, true) ?: [];
$name = trim((string)($input['name'] ?? ''));
$phone = trim((string)($input['phone'] ?? ''));
$product = isset($input['product']) ? trim((string)$input['product']) : null;
$comment = isset($input['comment']) ? trim((string)$input['comment']) : null;

if ($name === '' || $phone === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Укажите имя и телефон']);
    exit;
}

$crmId = null;
if (TWENTY_API_URL !== '' && TWENTY_API_KEY !== '') {
    $crmId = syncToTwenty($name, $phone, $product, $comment);
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET,
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    error_log('VPA order.php DB: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Не удалось сохранить заказ. Попробуйте позже или закажите через WhatsApp.']);
    exit;
}

$sql = 'INSERT INTO orders (name, phone, product, comment, source, crm_id) VALUES (?, ?, ?, ?, ?, ?)';
$stmt = $pdo->prepare($sql);
$stmt->execute([$name, $phone, $product ?: null, $comment ?: null, 'site', $crmId]);
$id = (int) $pdo->lastInsertId();

http_response_code(201);
echo json_encode([
    'id' => $id,
    'created_at' => date('c'),
    'crm_synced' => $crmId !== null,
]);

function syncToTwenty($name, $phone, $product, $comment) {
    $parts = preg_split('/\s+/u', $name, 2);
    $firstName = $parts[0] ?? $name;
    $lastName = $parts[1] ?? '';

    $body = [
        'name' => ['firstName' => $firstName, 'lastName' => $lastName],
        'phone' => $phone,
    ];
    if ($comment !== null && $comment !== '') $body['orderComment'] = $comment;
    if ($product !== null && $product !== '') $body['orderProduct'] = $product;

    $url = rtrim(TWENTY_API_URL, '/') . '/rest/people';
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' =>
                "Content-Type: application/json\r\n" .
                "Authorization: Bearer " . TWENTY_API_KEY . "\r\n",
            'content' => json_encode($body),
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents($url, false, $ctx);
    if ($response === false) return null;
    $data = json_decode($response, true);
    return $data['id'] ?? $data['data']['id'] ?? null;
}
