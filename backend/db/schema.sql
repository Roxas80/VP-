-- Таблица заказов (сохраняем все заявки с сайта)
CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(50)  NOT NULL,
  product    VARCHAR(100),           -- категория: торты, десерты, хлеб, пироги
  comment    TEXT,
  source     VARCHAR(20)  NOT NULL DEFAULT 'site',  -- site | whatsapp
  crm_id     VARCHAR(100),          -- id записи в Twenty (если синхронизировано)
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders (phone);

COMMENT ON TABLE orders IS 'Заказы с сайта Vkusno Polezno Astana';
