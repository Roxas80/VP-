#!/usr/bin/env python3
"""
Telegram Bot для vkusno_polezno_astana v2
ПП торты и десерты с полным процессом
"""

import json
import logging
import os
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters, ConversationHandler

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# Константы
CART = {}
USER_DATA = {}
OPERATOR_CHAT_ID = 373825397

# Загрузка данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), 'data')
ORDERS_FILE = os.path.join(DATA_DIR, 'orders.json')

with open(os.path.join(DATA_DIR, 'products.json'), 'r', encoding='utf-8') as f:
    PRODUCTS_DATA = json.load(f)

with open(os.path.join(DATA_DIR, 'bot_config.json'), 'r', encoding='utf-8') as f:
    CONFIG = json.load(f)

with open(os.path.join(DATA_DIR, 'config.json'), 'r', encoding='utf-8') as f:
    ROLES_CONFIG = json.load(f)

# Состояния
ADDRESS, PHONE, PAYMENT = range(3)

def get_greeting():
    hour = datetime.now().hour
    if 5 <= hour < 12: return "Доброе утро"
    elif 12 <= hour < 18: return "Добрый день"
    return "Добрый вечер"

def get_main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🍰 Каталог тортов", callback_data='cat_cakes')],
        [InlineKeyboardButton("🧁 Каталог десертов", callback_data='cat_desserts')],
        [InlineKeyboardButton("🛒 Корзина", callback_data='cart')],
        [InlineKeyboardButton("📞 Контакты", callback_data='contacts')],
        [InlineKeyboardButton("❓ Помощь", callback_data='help')]
    ])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    greeting = get_greeting()
    welcome = f"""{greeting}, {user.first_name}!

Добро пожаловать в vkusno_polezno_astana! 🍰

ПП торты и десерты без сахара и глютена"""
    await update.message.reply_text(welcome, reply_markup=get_main_keyboard(), parse_mode='HTML')

async def show_catalog(update: Update, context: ContextTypes.DEFAULT_TYPE, is_cake: bool):
    query = update.callback_query
    try: await query.answer()
    except: pass
    
    cat_idx = 0 if is_cake else 1
    cat = PRODUCTS_DATA['categories'][cat_idx]
    emoji = "🍰" if is_cake else "🧁"
    
    keyboard = []
    for item in cat['items']:
        price = f"{item['price']:,} тнг".replace(',', ' ')
        keyboard.append([InlineKeyboardButton(f"{emoji} {item['name']} - {price}", 
                                              callback_data=f'prod_{cat_idx}_{item["id"]}')])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data='main')])
    
    await query.edit_message_text(f"<b>{cat['name']}</b>\n\nВыберите товар:", 
                                    reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')

async def show_product(update: Update, context: ContextTypes.DEFAULT_TYPE, cat_idx: int, prod_id: str):
    query = update.callback_query
    try: await query.answer()
    except: pass
    
    product = None
    for item in PRODUCTS_DATA['categories'][cat_idx]['items']:
        if item['id'] == prod_id:
            product = item
            break
    
    if not product:
        await query.edit_message_text("Товар не найден")
        return
    
    text = f"<b>{product['name']}</b>\n\n💰 Цена: {product['price']:,} тнг\n\n".replace(',', ' ')
    
    keyboard = [
        [InlineKeyboardButton("➕ В корзину", callback_data=f'add_{cat_idx}_{prod_id}')],
        [InlineKeyboardButton("🔙 Назад", callback_data=f'cat_{"cakes" if cat_idx == 0 else "desserts"}')],
        [InlineKeyboardButton("🏠 Главное меню", callback_data='main')]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')

async def add_to_cart(update: Update, context: ContextTypes.DEFAULT_TYPE, cat_idx: int, prod_id: str):
    query = update.callback_query
    user_id = query.from_user.id
    try: await query.answer()
    except: pass
    
    product = None
    for item in PRODUCTS_DATA['categories'][cat_idx]['items']:
        if item['id'] == prod_id:
            product = item
            break
    
    if not product:
        await query.edit_message_text("Ошибка: товар не найден")
        return
    
    if user_id not in CART:
        CART[user_id] = []
    
    CART[user_id].append({'id': product['id'], 'name': product['name'], 'price': product['price']})
    count = len(CART[user_id])
    total = sum(item['price'] for item in CART[user_id])
    
    keyboard = [
        [InlineKeyboardButton("🛒 Перейти в корзину", callback_data='cart')],
        [InlineKeyboardButton("🍰 Добавить ещё", callback_data='cat_cakes')],
        [InlineKeyboardButton("🏠 Главное меню", callback_data='main')]
    ]
    
    await query.edit_message_text(
        f"✅ <b>{product['name']}</b> добавлен!\n\n🛒 В корзине: {count} товар(ов)\n💰 Итого: {total:,} тнг".replace(',', ' '),
        reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')

async def show_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    try: await query.answer()
    except: pass
    
    if user_id not in CART or not CART[user_id]:
        await query.edit_message_text("🛒 Корзина пуста", reply_markup=get_main_keyboard(), parse_mode='HTML')
        return
    
    items = CART[user_id]
    total = sum(item['price'] for item in items)
    
    text = "🛒 <b>Ваша корзина:</b>\n\n"
    for i, item in enumerate(items, 1):
        text += f"{i}. {item['name']} - {item['price']:,} тнг\n".replace(',', ' ')
    text += f"\n<b>Итого: {total:,} тнг</b>".replace(',', ' ')
    
    keyboard = [
        [InlineKeyboardButton("✅ Оформить заказ", callback_data='checkout')],
        [InlineKeyboardButton("🗑 Очистить", callback_data='clear_cart')],
        [InlineKeyboardButton("🔙 Назад", callback_data='main')]
    ]
    
    await query.edit_message_text(text, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode='HTML')

async def checkout_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    
    if user_id not in CART or not CART[user_id]:
        await query.answer("Корзина пуста!")
        return
    
    try: await query.answer()
    except: pass
    
    USER_DATA[user_id] = {'items': CART[user_id][:], 'total': sum(item['price'] for item in CART[user_id])}
    
    await query.edit_message_text("📍 Укажите адрес доставки или 'самовывоз':")
    return ADDRESS

async def get_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    USER_DATA[user_id]['address'] = update.message.text
    await update.message.reply_text("📱 Укажите номер телефона:")
    return PHONE

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    USER_DATA[user_id]['phone'] = update.message.text
    
    # Показываем способы оплаты
    keyboard = []
    for method in ROLES_CONFIG['payment']['methods']:
        keyboard.append([InlineKeyboardButton(method['name'], callback_data=f'pay_{method["id"]}')])
    
    await update.message.reply_text("💳 Выберите способ оплаты:", reply_markup=InlineKeyboardMarkup(keyboard))
    return PAYMENT

async def process_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user_id = query.from_user.id
    try: await query.answer()
    except: pass
    
    payment_id = query.data.replace('pay_', '')
    data = USER_DATA[user_id]
    
    # Здесь будет сохранение заказа
    payment_name = next((m['name'] for m in ROLES_CONFIG['payment']['methods'] if m['id'] == payment_id), payment_id)
    
    if payment_id == 'cash':
        text = f"✅ <b>Заказ оформлен!</b>\n\n💰 Сумма: {data['total']:,} тнг\n💳 Оплата: {payment_name}\n📍 Адрес: {data['address']}\n📱 Телефон: {data['phone']}\n\n⏳ Ожидайте подтверждения от кондитера.".replace(',', ' ')
    elif payment_id == 'partial':
        text = f"✅ <b>Заказ оформлен!</b>\n\n💰 Сумма: {data['total']:,} тнг\n💳 Оплата: {payment_name}\n📍 Адрес: {data['address']}\n📱 Телефон: {data['phone']}\n\n💳 Предоплата 50%: {data['total']//2:,} тнг\n\nРеквизиты для оплаты:\n📱 Kaspi: +77711632111\n🏦 Получатель: vkusno_polezno\n\nПосле оплаты пришлите скриншот чека.".replace(',', ' ')
    else:
        # Переводы
        text = f"✅ <b>Заказ оформлен!</b>\n\n💰 Сумма: {data['total']:,} тнг\n💳 Оплата: {payment_name}\n📍 Адрес: {data['address']}\n📱 Телефон: {data['phone']}\n\nРеквизиты для оплаты:\n📱 Kaspi: +77711632111\n🏦 Получатель: vkusno_polezno\n\nПосле оплаты пришлите скриншот чека.".replace(',', ' ')
    
    # Отправляем кондитеру
    order_info = f"""
🆕 <b>НОВЫЙ ЗАКАЗ!</b>

<b>Клиент:</b> {update.effective_user.first_name}
<b>Телефон:</b> {data['phone']}
<b>Адрес:</b> {data['address']}
<b>Оплата:</b> {payment_name}

<b>Заказ:</b>
"""
    for item in data['items']:
        order_info += f"• {item['name']} - {item['price']:,} тнг\n".replace(',', ' ')
    order_info += f"\n<b>Итого: {data['total']:,} тнг</b>".replace(',', ' ')
    
    try:
        await context.bot.send_message(chat_id=OPERATOR_CHAT_ID, text=order_info, parse_mode='HTML')
    except Exception as e:
        logger.error(f"Ошибка отправки кондитеру: {e}")
    
    await query.edit_message_text(text, parse_mode='HTML')
    
    # Очищаем корзину
    CART[user_id] = []
    
    return ConversationHandler.END

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data
    try: await query.answer()
    except: pass
    
    if data == 'main':
        await start(update, context)
    elif data == 'cat_cakes':
        await show_catalog(update, context, True)
    elif data == 'cat_desserts':
        await show_catalog(update, context, False)
    elif data.startswith('prod_'):
        _, cat_idx, prod_id = data.split('_', 2)
        await show_product(update, context, int(cat_idx), prod_id)
    elif data.startswith('add_'):
        _, cat_idx, prod_id = data.split('_', 2)
        await add_to_cart(update, context, int(cat_idx), prod_id)
    elif data == 'cart':
        await show_cart(update, context)
    elif data == 'clear_cart':
        user_id = query.from_user.id
        CART[user_id] = []
        await show_cart(update, context)
    elif data == 'checkout':
        await checkout_start(update, context)
    elif data.startswith('pay_'):
        await process_payment(update, context)
    elif data == 'courier_enter':
        await courier_enter_start(update, context)
    elif data.startswith('set_courier_'):
        order_id = data.replace('set_courier_', '')
        context.user_data['setting_courier_order'] = order_id
        await query.edit_message_text("🚚 Введите данные курьера:\n\nФормат:\nИмя курьера\nТелефон\nСсылка на доставку")
        return COURIER
    elif data.startswith('client_received_'):
        order_id = data.replace('client_received_', '')
        await client_confirm_received(update, context, order_id)
    elif data.startswith('client_issue_'):
        order_id = data.replace('client_issue_', '')
        await client_report_issue(update, context, order_id)

def main():
    TOKEN = "8712401072:AAE9oXvTxixZObKfJfyu-G-Ls1x5Bp5nMoI"
    application = Application.builder().token(TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    
    checkout_conv = ConversationHandler(
        entry_points=[CallbackQueryHandler(checkout_start, pattern='^checkout$')],
        states={
            ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_address)],
            PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_phone)],
            PAYMENT: [CallbackQueryHandler(process_payment, pattern='^pay_')],
        },
        fallbacks=[CommandHandler("start", start)],
    )
    application.add_handler(checkout_conv)
    application.add_handler(CallbackQueryHandler(button_handler))
    
    application.run_polling()

if __name__ == '__main__':
    main()
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
