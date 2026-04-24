#!/usr/bin/env python3
"""
Telegram Bot для vkusno_polezno_astana
ПП торты и десерты без сахара и глютена
"""

import json
import logging
import os
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters, ConversationHandler

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Константы
CART = {}
USER_DATA = {}
OPERATOR_CHAT_ID = 373825397  # ID чата кондитера

# Загрузка данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), 'data')
ORDERS_FILE = os.path.join(DATA_DIR, 'orders.json')

# Загрузка/создание файла заказов
def load_orders():
    """Загрузить заказы из файла"""
    if os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"orders": [], "next_order_id": 1}

def save_orders(orders_data):
    """Сохранить заказы в файл"""
    with open(ORDERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(orders_data, f, ensure_ascii=False, indent=2)

def create_order(user_id, items, total, phone, address, username, first_name):
    """Создать новый заказ"""
    orders_data = load_orders()
    order_id = orders_data['next_order_id']
    
    current_hour = datetime.now().hour
    delivery_day = "сегодня" if 0 <= current_hour < 19 else "завтра"
    
    order = {
        "id": order_id,
        "user_id": user_id,
        "username": username,
        "first_name": first_name,
        "phone": phone,
        "address": address,
        "items": items,
        "total": total,
        "delivery_day": delivery_day,
        "status": "new",  # new, confirmed, paid, preparing, delivering, completed, cancelled
        "payment_status": "pending",  # pending, partial (50%), paid
        "created_at": datetime.now().strftime('%d.%m.%Y %H:%M'),
        "updated_at": datetime.now().strftime('%d.%m.%Y %H:%M'),
        "notes": ""
    }
    
    orders_data['orders'].append(order)
    orders_data['next_order_id'] = order_id + 1
    save_orders(orders_data)
    
    return order

with open(os.path.join(DATA_DIR, 'products.json'), 'r', encoding='utf-8') as f:
    PRODUCTS_DATA = json.load(f)

with open(os.path.join(DATA_DIR, 'bot_config.json'), 'r', encoding='utf-8') as f:
    CONFIG = json.load(f)

with open(os.path.join(DATA_DIR, 'config.json'), 'r', encoding='utf-8') as f:
    ROLES_CONFIG = json.load(f)

# Состояния для ConversationHandler
SELECTING_CATEGORY, SELECTING_PRODUCT, SELECTING_QUANTITY, IN_CART, CHECKOUT, ADDRESS, PHONE, PAYMENT_METHOD, CONFIRM = range(9)

def get_greeting():
    """Приветствие с учётом времени"""
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "Доброе утро"
    elif 12 <= hour < 18:
        return "Добрый день"
    else:
        return "Добрый вечер"

def get_delivery_info():
    """Информация о доставке"""
    return f"""
🚚 <b>Доставка:</b>
• Самовывоз: {CONFIG['delivery']['pickup']}
• Астана: {CONFIG['delivery']['astana']}
• Пригород: {CONFIG['delivery']['suburbs']}
• Другие города (до 500 км): {CONFIG['delivery']['other_cities']}

⏰ <b>Время заказа:</b>
• Сейчас ({datetime.now().strftime('%H:%M')}) - {'текущий день' if 0 <= datetime.now().hour < 19 else 'следующий день'}
• 00:00-19:00 → заказ на сегодня
• 19:01-23:59 → заказ на завтра

💰 <b>Оплата:</b>
• Текущие заказы: {CONFIG['payment']['current_orders']}
• Предзаказы: {CONFIG['payment']['preorders']}
"""

def get_main_keyboard():
    """Главное меню"""
    keyboard = [
        [InlineKeyboardButton("🍰 Каталог тортов", callback_data='category_cakes')],
        [InlineKeyboardButton("🧁 Каталог десертов", callback_data='category_desserts')],
        [InlineKeyboardButton("🛒 Корзина", callback_data='cart')],
        [InlineKeyboardButton("📞 Контакты", callback_data='contacts')],
        [InlineKeyboardButton("❓ Помощь", callback_data='help')]
    ]
    return InlineKeyboardMarkup(keyboard)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    user = update.effective_user
    user_id = user.id
    
    # Инициализация корзины
    if user_id not in CART:
        CART[user_id] = []
    
    greeting = get_greeting()
    
    welcome_text = f"""
{greeting}, {user.first_name}! 👋

Добро пожаловать в <b>vkusno_polezno_astana</b>!

🍰 Мы готовим <b>ПП торты и десерты</b>:
• Без сахара
• Без глютена  
• С натуральными ингредиентами

{get_delivery_info()}

Выберите раздел ниже 👇
"""
    
    await update.message.reply_text(
        welcome_text,
        reply_markup=get_main_keyboard(),
        parse_mode='HTML'
    )

async def show_categories(update: Update, context: ContextTypes.DEFAULT_TYPE, category_type: str):
    """Показать категории товаров"""
    query = update.callback_query
    try:
        await query.answer()
    except:
        pass
    
    if category_type == 'cake':
        category = PRODUCTS_DATA['categories'][0]  # Торты
        emoji = "🍰"
    else:
        category = PRODUCTS_DATA['categories'][1]  # Десерты
        emoji = "🧁"
    
    keyboard = []
    for item in category['items']:
        price_str = f"{item['price']:,} тнг".replace(',', ' ')
        if 'weight_kg' in item:
            weight_str = f"{item['weight_kg']*1000:.0f}г"
        elif 'base_weight_kg' in item:
            weight_str = f"{item['base_weight_kg']:.1f}кг"
        else:
            weight_str = ""
        
        button_text = f"{emoji} {item['name']} - {price_str}"
        if weight_str:
            button_text += f" ({weight_str})"
        
        keyboard.append([InlineKeyboardButton(
            button_text,
            callback_data=f'product_{category_type}_{item["id"]}'
        )])
    
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data='back_main')])
    
    await query.edit_message_text(
        f"<b>{emoji} {category['name']}</b>\n\nВыберите товар:",
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def show_product_details(update: Update, context: ContextTypes.DEFAULT_TYPE, category_type: str, product_id: str):
    """Показать детали товара"""
    query = update.callback_query
    try:
        await query.answer()
    except:
        pass  # Игнорируем старые запросы
    
    # Найти товар
    category_idx = 0 if category_type == 'cake' else 1
    product = None
    for item in PRODUCTS_DATA['categories'][category_idx]['items']:
        if item['id'] == product_id:
            product = item
            break
    
    if not product:
        await query.edit_message_text("Товар не найден")
        return
    
    # Формируем текст с составом
    composition_text = ""
    if isinstance(product['composition'], dict):
        for part, ingredients in product['composition'].items():
            composition_text += f"\n<b>{part.capitalize()}:</b> {', '.join(ingredients)}"
    else:
        composition_text = ', '.join(product['composition'])
    
    # КБЖУ
    nutrition = product.get('nutrition_per_100g', {})
    nutrition_text = f"""
<b>Пищевая ценность на 100г:</b>
• Калории: {nutrition.get('ккал', 'N/A')} ккал
• Белки: {nutrition.get('белки', 'N/A')}г
• Жиры: {nutrition.get('жиры', 'N/A')}г  
• Углеводы: {nutrition.get('углеводы', 'N/A')}г
"""
    
    # Аллергены
    allergens_text = f"<b>⚠️ Аллергены:</b> {', '.join(product['allergens'])}" if product['allergens'] else ""
    
    text = f"""
<b>{product['name']}</b>

<b>Цена:</b> {product['price']:,} тнг

<b>Состав:</b>{composition_text}
{nutrition_text}
{allergens_text}
"""
    
    keyboard = [
        [InlineKeyboardButton("➕ Добавить в корзину", callback_data=f'add_{category_type}_{product_id}')],
        [InlineKeyboardButton("🔙 Назад к каталогу", callback_data=f'category_{category_type}s')],
        [InlineKeyboardButton("🏠 Главное меню", callback_data='back_main')]
    ]
    
    await query.edit_message_text(
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def add_to_cart(update: Update, context: ContextTypes.DEFAULT_TYPE, category_type: str, product_id: str):
    """Добавить в корзину"""
    query = update.callback_query
    user_id = query.from_user.id
    
    try:
        await query.answer()
    except:
        pass
    
    # Найти товар
    category_idx = 0 if category_type == 'cake' else 1
    product = None
    for item in PRODUCTS_DATA['categories'][category_idx]['items']:
        if item['id'] == product_id:
            product = item
            break
    
    if not product:
        logger.error(f"Товар не найден: category={category_type}, id={product_id}")
        try:
            await query.edit_message_text(f"❌ Ошибка: товар {product_id} не найден")
        except:
            pass
        return
    
    if user_id not in CART:
        CART[user_id] = []
    
    # Добавляем товар в корзину
    CART[user_id].append({
        'id': product['id'],
        'name': product['name'],
        'price': product['price'],
        'category': category_type
    })
    
    total = sum(item['price'] for item in CART[user_id])
    count = len(CART[user_id])
    
    keyboard = [
        [InlineKeyboardButton("🛒 Перейти в корзину", callback_data='cart')],
        [InlineKeyboardButton("🍰 Добавить ещё торты", callback_data='category_cakes')],
        [InlineKeyboardButton("🧁 Добавить ещё десерты", callback_data='category_desserts')],
        [InlineKeyboardButton("🏠 Главное меню", callback_data='back_main')]
    ]
    
    await query.answer(f"✅ Добавлено! В корзине {count} товар(ов)")
    await query.edit_message_text(
        f"✅ <b>{product['name']}</b> добавлен в корзину!\n\n"
        f"🛒 В корзине: {count} товар(ов)\n"
        f"💰 Итого: {total:,} тнг".replace(',', ' '),
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def show_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать корзину"""
    query = update.callback_query
    user_id = query.from_user.id
    
    try:
        await query.answer()
    except:
        pass
    
    if user_id not in CART or not CART[user_id]:
        keyboard = [
            [InlineKeyboardButton("🍰 Каталог тортов", callback_data='category_cakes')],
            [InlineKeyboardButton("🧁 Каталог десертов", callback_data='category_desserts')],
            [InlineKeyboardButton("🔙 Назад", callback_data='back_main')]
        ]
        await query.edit_message_text(
            "🛒 <b>Ваша корзина пуста</b>\n\nДобавьте товары из каталога 👇",
            reply_markup=InlineKeyboardMarkup(keyboard),
            parse_mode='HTML'
        )
        return
    
    cart_items = CART[user_id]
    total = sum(item['price'] for item in cart_items)
    
    text = "🛒 <b>Ваша корзина:</b>\n\n"
    for i, item in enumerate(cart_items, 1):
        text += f"{i}. {item['name']} - {item['price']:,} тнг\n".replace(',', ' ')
    
    text += f"\n<b>Итого: {total:,} тнг</b>".replace(',', ' ')
    
    keyboard = [
        [InlineKeyboardButton("✅ Оформить заказ", callback_data='checkout')],
        [InlineKeyboardButton("🗑 Очистить корзину", callback_data='clear_cart')],
        [InlineKeyboardButton("🍰 Добавить ещё", callback_data='category_cakes')],
        [InlineKeyboardButton("🔙 Назад", callback_data='back_main')]
    ]
    
    await query.edit_message_text(
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def clear_cart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Очистить корзину"""
    query = update.callback_query
    user_id = query.from_user.id
    
    try:
        await query.answer("Корзина очищена")
    except:
        pass
    
    if user_id in CART:
        CART[user_id] = []
    
    await show_cart(update, context)

async def show_contacts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать контакты"""
    query = update.callback_query
    try:
        await query.answer()
    except:
        pass
    
    text = f"""
📞 <b>Контакты</b>

<b>Телефон:</b> {CONFIG['business']['phone']}
<b>Адрес:</b> {CONFIG['business']['address']}

{get_delivery_info()}

<b>WhatsApp:</b> {CONFIG['business']['phone']}
"""
    
    keyboard = [
        [InlineKeyboardButton("📱 Написать в WhatsApp", url=f"https://wa.me/{CONFIG['business']['phone'].replace('+', '')}")],
        [InlineKeyboardButton("🔙 Назад", callback_data='back_main')]
    ]
    
    await query.edit_message_text(
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def show_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать помощь"""
    query = update.callback_query
    try:
        await query.answer()
    except:
        pass
    
    text = f"""
❓ <b>Помощь</b>

<b>Как сделать заказ:</b>
1. Выберите категорию (торты или десерты)
2. Выберите товар и ознакомьтесь с составом
3. Нажмите "Добавить в корзину"
4. Перейдите в корзину и нажмите "Оформить заказ"
5. Укажите адрес и телефон

<b>Время доставки:</b>
• Заказ с 00:00 до 19:00 — доставка сегодня
• Заказ с 19:01 до 23:59 — доставка завтра

<b>Способы получения:</b>
• Самовывоз (бесплатно)
• Доставка (платно, оплачивается при получении)

<b>Оплата:</b>
• При получении — для текущих заказов
• Предоплата 50% — для заказов на будущее

<b>По вопросам:</b> {CONFIG['business']['phone']}
"""
    
    keyboard = [
        [InlineKeyboardButton("🔙 Назад", callback_data='back_main')]
    ]
    
    await query.edit_message_text(
        text,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='HTML'
    )

async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик кнопок"""
    query = update.callback_query
    data = query.data
    
    try:
        await query.answer()
    except:
        pass
    
    if data == 'back_main':
        try:
            await query.answer()
        except:
            pass
        # Возвращаем главное меню вместо вызова start
        user = update.effective_user
        greeting = get_greeting()
        welcome_text = f"""
{greeting}, {user.first_name}! 👋

Добро пожаловать в <b>vkusno_polezno_astana</b>!

🍰 Мы готовим <b>ПП торты и десерты</b>:
• Без сахара
• Без глютена  
• С натуральными ингредиентами

{get_delivery_info()}

Выберите раздел ниже 👇
"""
        try:
            await query.edit_message_text(
                welcome_text,
                reply_markup=get_main_keyboard(),
                parse_mode='HTML'
            )
        except Exception as e:
            # Если сообщение не изменилось, отправляем новое
            logger.error(f"Error editing message: {e}")
            await query.message.reply_text(
                welcome_text,
                reply_markup=get_main_keyboard(),
                parse_mode='HTML'
            )
    elif data == 'category_cakes':
        await show_categories(update, context, 'cake')
    elif data == 'category_desserts':
        await show_categories(update, context, 'dessert')
    elif data == 'cart':
        await show_cart(update, context)
    elif data == 'clear_cart':
        await clear_cart(update, context)
    elif data == 'contacts':
        await show_contacts(update, context)
    elif data == 'help':
        await show_help(update, context)
    elif data.startswith('product_cake_'):
        product_id = data.replace('product_cake_', '')
        await show_product_details(update, context, 'cake', product_id)
    elif data.startswith('product_dessert_'):
        product_id = data.replace('product_dessert_', '')
        await show_product_details(update, context, 'dessert', product_id)
    elif data.startswith('add_cake_'):
        product_id = data.replace('add_cake_', '')
        await add_to_cart(update, context, 'cake', product_id)
    elif data.startswith('add_dessert_'):
        product_id = data.replace('add_dessert_', '')
        await add_to_cart(update, context, 'dessert', product_id)
    elif data.startswith('admin_'):
        await handle_admin_action(update, context, data)
    elif data == 'checkout':
        await checkout_start(update, context)

async def checkout_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начало оформления заказа"""
    query = update.callback_query
    user_id = query.from_user.id
    
    if user_id not in CART or not CART[user_id]:
        await query.answer("Корзина пуста!")
        return
    
    await query.answer()
    
    cart_items = CART[user_id]
    total = sum(item['price'] for item in cart_items)
    
    text = f"""
📝 <b>Оформление заказа</b>

<b>Товары:</b>
"""
    for i, item in enumerate(cart_items, 1):
        text += f"{i}. {item['name']} - {item['price']:,} тнг\n".replace(',', ' ')
    
    text += f"\n<b>Итого: {total:,} тнг</b>\n\n".replace(',', ' ')
    text += "Укажите адрес доставки или напишите 'самовывоз':"
    
    USER_DATA[user_id] = {'step': 'address', 'items': cart_items, 'total': total}
    
    await query.edit_message_text(text, parse_mode='HTML')
    
    return ADDRESS

async def get_address(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Получить адрес"""
    user_id = update.effective_user.id
    address = update.message.text
    
    USER_DATA[user_id]['address'] = address
    
    await update.message.reply_text(
        "📱 Укажите номер телефона для связи:",
        reply_markup=InlineKeyboardMarkup([[]])
    )
    
    return PHONE

async def get_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Получить телефон и перейти к выбору оплаты"""
    user_id = update.effective_user.id
    phone = update.message.text
    
    USER_DATA[user_id]['phone'] = phone
    
    # Предлагаем способы оплаты
    keyboard = []
    for method in ROLES_CONFIG['payment']['methods']:
        keyboard.append([InlineKeyboardButton(
            method['name'],
            callback_data=f'payment_{method["id"]}'
        )])
    
    await update.message.reply_text(
        "💳 Выберите способ оплаты:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    
    return PAYMENT_METHOD
    )
    
    # Формируем сообщение для оператора с кнопками управления
    operator_text = f"""
🆕 <b>НОВЫЙ ЗАКАЗ #{order['id']}!</b>

<b>Клиент:</b> {order['first_name']} (@{order['username'] or 'нет'})
<b>Телефон:</b> {phone}
<b>Адрес:</b> {data['address']}

<b>Заказ:</b>
"""
    for i, item in enumerate(data['items'], 1):
        operator_text += f"{i}. {item['name']} - {item['price']:,} тнг\n".replace(',', ' ')
    
    operator_text += f"\n<b>Итого: {data['total']:,} тнг</b>\n".replace(',', ' ')
    operator_text += f"<b>Доставка:</b> {order['delivery_day']}\n"
    operator_text += f"<b>Создан:</b> {order['created_at']}\n"
    operator_text += f"<b>Статус:</b> 🆕 Новый"
    
    # Кнопки для оператора
    operator_keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Подтвердить", callback_data=f'admin_confirm_{order["id"]}')],
        [InlineKeyboardButton("❌ Отклонить", callback_data=f'admin_cancel_{order["id"]}')],
        [InlineKeyboardButton("💳 Отметить оплату 50%", callback_data=f'admin_paid_partial_{order["id"]}'),
         InlineKeyboardButton("💳 Оплачен полностью", callback_data=f'admin_paid_full_{order["id"]}')],
        [InlineKeyboardButton("🔄 В доставке", callback_data=f'admin_delivering_{order["id"]}'),
         InlineKeyboardButton("✓ Выполнен", callback_data=f'admin_completed_{order["id"]}')]
    ])
    
    # Отправляем заказ оператору
    try:
        await context.bot.send_message(
            chat_id=OPERATOR_CHAT_ID,
            text=operator_text,
            reply_markup=operator_keyboard,
            parse_mode='HTML'
        )
    except Exception as e:
        logger.error(f"Не удалось отправить уведомление оператору: {e}")
    
    # Подтверждение клиенту
    client_text = f"""
✅ <b>Заказ #{order['id']} оформлен!</b>

<b>Сумма:</b> {data['total']:,} тнг
<b>Доставка:</b> {order['delivery_day']}
<b>Адрес:</b> {data['address']}
<b>Телефон:</b> {phone}

⏳ Ожидайте подтверждения от кондитера.

📞 {CONFIG['business']['phone']}
"""
    
    await update.message.reply_text(client_text, parse_mode='HTML')
    
    # Очищаем корзину
    CART[user_id] = []
    
    return ConversationHandler.END

async def handle_admin_action(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
    """Обработка админских действий"""
    query = update.callback_query
    user_id = query.from_user.id
    
    # Проверяем, что это оператор
    if user_id != OPERATOR_CHAT_ID:
        await query.answer("❌ У вас нет прав!")
        return
    
    try:
        await query.answer()
    except:
        pass
    
    # Разбираем callback_data: admin_action_orderId
    parts = data.split('_')
    action = parts[1]
    order_id = int(parts[2])
    
    # Загружаем заказы
    orders_data = load_orders()
    order = None
    for o in orders_data['orders']:
        if o['id'] == order_id:
            order = o
            break
    
    if not order:
        await query.edit_message_text(f"❌ Заказ #{order_id} не найден")
        return
    
    # Обрабатываем действие
    if action == 'confirm':
        order['status'] = 'confirmed'
        order['updated_at'] = datetime.now().strftime('%d.%m.%Y %H:%M')
        save_orders(orders_data)
        
        # Уведомляем клиента
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=f"✅ <b>Ваш заказ #{order_id} подтверждён!</b>\n\nКондитер свяжется с вами для уточнения деталей.",
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить клиента: {e}")
        
        await query.edit_message_text(
            f"✅ Заказ #{order_id} подтверждён\n\n📱 Клиент уведомлён",
            parse_mode='HTML'
        )
    
    elif action == 'cancel':
        order['status'] = 'cancelled'
        order['updated_at'] = datetime.now().strftime('%d.%m.%Y %H:%M')
        save_orders(orders_data)
        
        # Уведомляем клиента
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=f"❌ <b>Заказ #{order_id} отклонён.</b>\n\nПожалуйста, свяжитесь с нами: {CONFIG['business']['phone']}",
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить клиента: {e}")
        
        await query.edit_message_text(
            f"❌ Заказ #{order_id} отклонён\n\n📱 Клиент уведомлён",
            parse_mode='HTML'
        )
    
    elif action == 'paid':
        payment_type = parts[2] if len(parts) > 2 else 'full'
        if payment_type == 'partial':
            order['payment_status'] = 'partial'
        else:
            order['payment_status'] = 'paid'
        order['updated_at'] = datetime.now().strftime('%d.%m.%Y %H:%M')
        save_orders(orders_data)
        
        await query.edit_message_text(
            f"💳 Заказ #{order_id}: оплата отмечена ({'50%' if payment_type == 'partial' else '100%'})\n\n✅ Сохранено",
            parse_mode='HTML'
        )
    
    elif action == 'delivering':
        order['status'] = 'delivering'
        order['updated_at'] = datetime.now().strftime('%d.%m.%Y %H:%M')
        save_orders(orders_data)
        
        # Уведомляем клиента
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=f"🚚 <b>Заказ #{order_id} в пути!</b>\n\nОжидайте доставку.",
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить клиента: {e}")
        
        await query.edit_message_text(
            f"🚚 Заказ #{order_id}: в доставке\n\n📱 Клиент уведомлён",
            parse_mode='HTML'
        )
    
    elif action == 'completed':
        order['status'] = 'completed'
        order['updated_at'] = datetime.now().strftime('%d.%m.%Y %H:%M')
        save_orders(orders_data)
        
        # Уведомляем клиента
        try:
            await context.bot.send_message(
                chat_id=order['user_id'],
                text=f"✅ <b>Заказ #{order_id} выполнен!</b>\n\nСпасибо за заказ! Приятного аппетита 🎂",
                parse_mode='HTML'
            )
        except Exception as e:
            logger.error(f"Не удалось уведомить клиента: {e}")
        
        await query.edit_message_text(
            f"✅ Заказ #{order_id} выполнен\n\n📱 Клиент уведомлён",
            parse_mode='HTML'
        )


async def show_orders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать все заказы (только для оператора)"""
    user_id = update.effective_user.id
    
    if user_id != OPERATOR_CHAT_ID:
        await update.message.reply_text("❌ У вас нет прав!")
        return
    
    orders_data = load_orders()
    
    if not orders_data['orders']:
        await update.message.reply_text("📭 Заказов пока нет")
        return
    
    # Фильтруем активные заказы
    active_orders = [o for o in orders_data['orders'] if o['status'] not in ['completed', 'cancelled']]
    
    if not active_orders:
        await update.message.reply_text("✅ Все заказы выполнены")
        return
    
    text = "📋 <b>Активные заказы:</b>\n\n"
    
    for order in active_orders[-10:]:  # Последние 10
        status_emoji = {
            'new': '🆕',
            'confirmed': '✅',
            'paid': '💳',
            'preparing': '👨‍🍳',
            'delivering': '🚚',
            'completed': '✓',
            'cancelled': '❌'
        }.get(order['status'], '❓')
        
        text += f"{status_emoji} <b>#{order['id']}</b> - {order['first_name']}\n"
        text += f"   💰 {order['total']:,} тнг | 📱 {order['phone']}\n".replace(',', ' ')
        text += f"   📍 {order['address'][:30]}...\n\n"
    
    await update.message.reply_text(text, parse_mode='HTML')


def main():
    """Запуск бота"""
    TOKEN = "8712401072:AAE9oXvTxixZObKfJfyu-G-Ls1x5Bp5nMoI"
    
    application = Application.builder().token(TOKEN).build()
    
    # Обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("orders", show_orders))
    
    # Conversation handler для оформления заказа
    checkout_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(checkout_start, pattern='^checkout$')],
        states={
            ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_address)],
            PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_phone)],
        },
        fallbacks=[CommandHandler("start", start)],
    )
    application.add_handler(checkout_handler)
    
    # Обработчик кнопок
    application.add_handler(CallbackQueryHandler(button_handler))
    
    # Запуск
    application.run_polling()

if __name__ == '__main__':
    main()
