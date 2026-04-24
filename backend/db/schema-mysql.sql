-- Таблица заказов для MySQL (вариант развёртывания на Plesk без PostgreSQL)
-- Выполнить в phpMyAdmin или в Plesk → Базы данных → MySQL

CREATE TABLE IF NOT EXISTS orders (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(50)  NOT NULL,
  product    VARCHAR(100)  DEFAULT NULL,
  comment    TEXT          DEFAULT NULL,
  source     VARCHAR(20)   NOT NULL DEFAULT 'site',
  crm_id     VARCHAR(100)  DEFAULT NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_created_at (created_at DESC),
  INDEX idx_orders_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
