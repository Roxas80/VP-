# Дополнительные функции для bot_v2.py - добавить в конец файла перед main()

# Дополнительные состояния для ConversationHandler
COURIER = 3

async def courier_enter_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Кондитер начинает ввод курьера"""
    query = update.callback_query
    try:
        await query.answer()
    except:
        pass
    await query.edit_message_text(
        "🚚 Введите данные курьера:\n\n"
        "Формат:\n"
        "Имя курьера\n"
        "Телефон (+7700XXXXXXX)\n"
        "Ссылка на приложение доставки"
    )

async def set_courier(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Установить курьера для заказа"""
    user_id = update.effective_user.id
    
    # Парсим ввод: имя, телефон, ссылка
    lines = update.message.text.strip().split('\n')
    if len(lines) < 2:
        await update.message.reply_text("❌ Неверный формат. Нужно:\nИмя\nТелефон\nСсылка")
        return
    
    courier_name = lines[0].strip()
    courier_phone = lines[1].strip()
    courier_link = lines[2].strip() if len(lines) > 2 else ""
    
    order_id = context.user_data.get('setting_courier_order')
    if not order_id:
        await update.message.reply_text("❌ Ошибка: заказ не найден")
        return
    
    # Загружаем заказ
    orders_data = load_orders() if os.path.exists(ORDERS_FILE) else {"orders": []}
    order = None
    for o in orders_data.get('orders', []):
        if str(o.get('id')) == str(order_id):
            order = o
            break
    
    if order:
        # Уведомление клиенту
        client_text = f"""🚚 <b>Ваш заказ передан курьеру!</b>

<b>Курьер:</b> {courier_name}
<b>Телефон:</b> {courier_phone}
"""
        if courier_link:
            client_text += f"\n📱 <a href='{courier_link}'>Отследить доставку</a>"
        
        client_text += "\n\nПосле получения заказа нажмите кнопку ниже 👇"
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("✅ Получил", callback_data=f'client_received_{order_id}')],
            [InlineKeyboardButton("❌ Проблема с заказом", callback_data=f'client_issue_{order_id}')]
        ])
        
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=client_text,
                reply_markup=keyboard,
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось отправить клиенту: {e}")
        
        await update.message.reply_text(f"✅ Курьер назначен для заказа #{order_id}")
    else:
        await update.message.reply_text("❌ Заказ не найден")

async def client_confirm_received(update: Update, context: ContextTypes.DEFAULT_TYPE, order_id: str):
    """Клиент подтвердил получение"""
    query = update.callback_query
    try:
        await query.answer("✅ Спасибо за заказ!")
    except:
        pass
    
    await query.edit_message_text(
        "✅ <b>Заказ получен!</b>\n\nСпасибо за заказ! Приятного аппетита 🍰\n\n"
        "Оставьте отзыв: @vkusno_polezno_astana",
        parse_mode='HTML'
    )
    
    # Уведомляем кондитера
    try:
        await context.bot.send_message(
            chat_id=OPERATOR_CHAT_ID,
            text=f"✅ Клиент подтвердил получение заказа #{order_id}",
            parse_mode='HTML'
        )
    except Exception as e:
        logger.error(f"Не удалось уведомить кондитера: {e}")

ISSUES = {
    'wrong_item': 'Не тот товар',
    'damaged': 'Товар повреждён',
    'incomplete': 'Не полный заказ',
    'other': 'Другая проблема'
}

async def client_report_issue(update: Update, context: ContextTypes.DEFAULT_TYPE, order_id: str):
    """Клиент сообщает о проблеме"""
    query = update.callback_query
    
    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("❌ Не тот товар", callback_data=f'issue_{order_id}_wrong_item')],
        [InlineKeyboardButton("💔 Товар повреждён", callback_data=f'issue_{order_id}_damaged')],
        [InlineKeyboardButton("📦 Не полный заказ", callback_data=f'issue_{order_id}_incomplete')],
        [InlineKeyboardButton("❓ Другое", callback_data=f'issue_{order_id}_other')]
    ])
    
    await query.edit_message_text(
        "⚠️ Выберите проблему:",
        reply_markup=keyboard
    )

async def handle_issue_selection(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка выбора проблемы"""
    query = update.callback_query
    data = query.data
    
    if data.startswith('issue_'):
        parts = data.split('_')
        order_id = parts[1]
        issue_type = parts[2]
        issue_text = ISSUES.get(issue_type, 'Проблема')
        
        try:
            await query.answer()
        except:
            pass
        
        await query.edit_message_text(
            f"⚠️ <b>Проблема зафиксирована: {issue_text}</b>\n\n"
            "Кондитер свяжется с вами в ближайшее время.",
            parse_mode='HTML'
        )
        
        # Уведомляем кондитера
        try:
            await context.bot.send_message(
                chat_id=OPERATOR_CHAT_ID,
                text=f"🚨 <b>ПРОБЛЕМА С ЗАКАЗОМ #{order_id}!</b>\n\n"
                     f"Тип: {issue_text}\n"
                     f"Клиент: {update.effective_user.first_name}",
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить кондитера: {e}")
