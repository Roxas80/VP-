#!/bin/bash

# Проверка статуса бота

echo "=== Статус бота vkusno_polezno_astana ==="
echo ""

BOT_DIR="/Users/grizzly80/Documents/vkusno_polezno_astana продажи/telegram_bot"
PID_FILE="$BOT_DIR/bot.pid"
RESTART_COUNT_FILE="$BOT_DIR/restart_count"

# Проверка процесса
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Бот ЗАПУЩЕН (PID: $PID)"
    else
        echo "❌ Бот ОСТАНОВЛЕН (PID файл устарел)"
    fi
else
    echo "❌ Бот ОСТАНОВЛЕН (PID файл не найден)"
fi

# Счётчик перезапусков
if [ -f "$RESTART_COUNT_FILE" ]; then
    echo "🔄 Перезапусков: $(cat $RESTART_COUNT_FILE)"
fi

# Проверка screen-сессии
SCREEN_STATUS=$(screen -ls 2>/dev/null | grep vkusno_bot | head -1)
if [ -n "$SCREEN_STATUS" ]; then
    echo "🖥️  Screen: $SCREEN_STATUS"
else
    echo "🖥️  Screen: не активна"
fi

# Последние логи
echo ""
echo "=== Последние 5 строк лога ==="
if [ -f "$BOT_DIR/logs/bot.log" ]; then
    tail -5 "$BOT_DIR/logs/bot.log"
else
    echo "Лог файл не найден"
fi

echo ""
echo "=== Последние 3 строки мониторинга ==="
if [ -f "$BOT_DIR/logs/monitor.log" ]; then
    tail -3 "$BOT_DIR/logs/monitor.log"
else
    echo "Лог мониторинга не найден"
fi

echo ""
echo "=== Команды ==="
echo "Запуск:    screen -dmS vkusno_bot bash -c 'cd \"$BOT_DIR\" \u0026\u0026 ./venv/bin/python3 bot.py'"
echo "Остановка: pkill -f bot.py"
echo "Логи:      tail -f \"$BOT_DIR/logs/bot.log\""
echo "Монитор:   tail -f \"$BOT_DIR/logs/monitor.log\""
