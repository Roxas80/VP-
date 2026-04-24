#!/bin/bash

# Мониторинг бота vkusno_polezno_astana
# Запуск: ./monitor.sh

BOT_DIR="/Users/grizzly80/Documents/vkusno_polezno_astana продажи/telegram_bot"
LOG_DIR="$BOT_DIR/logs"
PID_FILE="$BOT_DIR/bot.pid"
RESTART_COUNT_FILE="$BOT_DIR/restart_count"

mkdir -p "$LOG_DIR"

# Функция логирования
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_DIR/monitor.log"
}

# Проверка запущен ли бот
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0  # Запущен
        fi
    fi
    return 1  # Не запущен
}

# Запуск бота
start_bot() {
    log "Запуск бота..."
    cd "$BOT_DIR"
    
    # Убиваем старые процессы
    pkill -f "bot.py" 2>/dev/null
    sleep 1
    
    # Запускаем в screen
    screen -dmS vkusno_bot bash -c "
        echo \$\$ > '$PID_FILE'
        ./venv/bin/python3 bot.py > '$LOG_DIR/bot.log' 2>&1
    "
    
    sleep 3
    
    if is_running; then
        log "✅ Бот запущен (PID: $(cat $PID_FILE))"
        
        # Счётчик перезапусков
        if [ -f "$RESTART_COUNT_FILE" ]; then
            count=$(cat "$RESTART_COUNT_FILE")
            echo $((count + 1)) > "$RESTART_COUNT_FILE"
        else
            echo 1 > "$RESTART_COUNT_FILE"
        fi
    else
        log "❌ Ошибка запуска бота"
    fi
}

# Проверка последних ошибок
check_errors() {
    if [ -f "$LOG_DIR/bot.log" ]; then
        # Проверяем последние 10 строк на критические ошибки
        tail -10 "$LOG_DIR/bot.log" | grep -E "(Error|Exception|CRITICAL|FATAL)" > /dev/null
        if [ $? -eq 0 ]; then
            log "⚠️ Обнаружены ошибки в логах"
            echo "--- Последние ошибки ---" >> "$LOG_DIR/monitor.log"
            tail -20 "$LOG_DIR/bot.log" | grep -E "(Error|Exception|CRITICAL|FATAL)" >> "$LOG_DIR/monitor.log"
            return 1
        fi
    fi
    return 0
}

# Главный цикл
log "=== Мониторинг запущен ==="

while true; do
    if ! is_running; then
        log "⚠️ Бот не запущен, перезапуск..."
        start_bot
    elif ! check_errors; then
        log "⚠️ Обнаружены ошибки, перезапуск..."
        start_bot
    else
        # Проверка раз в 10 секунд
        sleep 10
    fi
done
