#!/bin/bash

# Автоперезапуск бота при падении

BOT_DIR="/Users/grizzly80/Documents/vkusno_polezno_astana продажи/telegram_bot"
LOG_FILE="$BOT_DIR/bot.log"

echo "$(date): Запуск бота..." >> "$LOG_FILE"

cd "$BOT_DIR"

while true; do
    echo "$(date): Старт..." >> "$LOG_FILE"
    ./venv/bin/python3 bot_v2_fixed.py >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    echo "$(date): Бот остановился с кодом $EXIT_CODE, перезапуск через 5 сек..." >> "$LOG_FILE"
    sleep 5
done
