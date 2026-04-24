<?php
/**
 * Проверка окружения хостинга для выбора варианта развёртывания (docs/DEPLOY_PLESK.md).
 * Загрузите этот файл в корень сайта на Plesk (например в httpdocs), откройте в браузере,
 * скопируйте вывод и отправьте разработчику. После проверки удалите файл с сервера.
 */
header('Content-Type: text/plain; charset=utf-8');
echo "=== Проверка хостинга VPA ===\n\n";

echo "PHP: " . (defined('PHP_VERSION') ? PHP_VERSION : '?') . "\n";
echo "PHP extensions: " . implode(', ', array_slice(get_loaded_extensions(), 0, 30)) . "\n";
$hasPdoMysql = extension_loaded('pdo_mysql');
echo "PDO MySQL: " . ($hasPdoMysql ? 'да' : 'нет') . "\n\n";

echo "--- Проверка записи в каталог ---\n";
$testDir = __DIR__ . '/vpa_test_' . time();
$writable = @mkdir($testDir, 0755);
if ($writable) {
    @rmdir($testDir);
    echo "Создание каталогов: да\n";
} else {
    echo "Создание каталогов: нет (или нет прав)\n";
}
$testFile = __DIR__ . '/vpa_write_test_' . time() . '.txt';
$writeOk = @file_put_contents($testFile, 'test') !== false;
if ($writeOk) {
    @unlink($testFile);
    echo "Запись файлов: да\n";
} else {
    echo "Запись файлов: нет\n";
}

echo "\n--- Рекомендация ---\n";
if ($hasPdoMysql) {
    echo "Подходит вариант B: статика + api/order.php + MySQL.\n";
} else {
    echo "MySQL через PHP недоступен. Вариант A: только статика + форма во внешний сервис (Formspree/Telegram) или WhatsApp.\n";
}

echo "\n--- Инфо о сервере (для отладки) ---\n";
echo "DOCUMENT_ROOT: " . (isset($_SERVER['DOCUMENT_ROOT']) ? $_SERVER['DOCUMENT_ROOT'] : '-') . "\n";
echo "SERVER_SOFTWARE: " . (isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : '-') . "\n";
echo "\nКонец отчёта. Удалите этот файл с сервера после проверки.\n";
