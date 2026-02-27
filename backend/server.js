'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;
const STATIC_DIR = path.resolve(__dirname, process.env.STATIC_DIR || '..');
const DATABASE_URL = process.env.DATABASE_URL;
const TWENTY_API_URL = process.env.TWENTY_API_URL?.replace(/\/$/, '');
const TWENTY_API_KEY = process.env.TWENTY_API_KEY;

if (!DATABASE_URL) {
  console.error('Set DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/vpa)');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(cors());
app.use(express.json());

// Статика сайта (index.html, order.html, styles.css, script.js)
app.use(express.static(STATIC_DIR));

// Здоровье и проверка БД
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'ok' });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// Создание заказа: сохранение в PostgreSQL + опционально синхрон в Twenty CRM
app.post('/api/orders', async (req, res) => {
  const { name, phone, product, comment } = req.body || {};
  const nameStr = String(name ?? '').trim();
  const phoneStr = String(phone ?? '').trim();

  if (!nameStr || !phoneStr) {
    return res.status(400).json({ error: 'Укажите имя и телефон' });
  }

  let crmId = null;
  if (TWENTY_API_URL && TWENTY_API_KEY) {
    try {
      crmId = await syncOrderToTwenty({ name: nameStr, phone: phoneStr, product, comment });
    } catch (e) {
      console.error('Twenty CRM sync error:', e.message);
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO orders (name, phone, product, comment, source, crm_id)
       VALUES ($1, $2, $3, $4, 'site', $5)
       RETURNING id, created_at`,
      [nameStr, phoneStr, product || null, comment || null, crmId]
    );
    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      created_at: row.created_at,
      crm_synced: !!crmId,
    });
  } catch (e) {
    console.error('DB error:', e);
    res.status(500).json({ error: 'Не удалось сохранить заказ. Попробуйте позже или закажите через WhatsApp.' });
  }
});

/**
 * Синхронизация заявки с Twenty CRM по постановке (docs/TWENTY_CRM_SETUP.md):
 * 1) Создаёт клиента (Person).
 * 2) Опционально создаёт сделку (Opportunity) в стадии «Новый заказ», если задан TWENTY_PIPELINE_STAGE_ID.
 * Имена полей и endpoint'ы уточняйте в Twenty: Settings → APIs & Webhooks.
 */
async function syncOrderToTwenty({ name, phone, product, comment }) {
  const parts = name.split(/\s+/);
  const firstName = parts[0] || name;
  const lastName = parts.slice(1).join(' ') || '';

  const personBody = {
    name: { firstName, lastName },
    phone: phone,
  };
  if (comment) personBody.orderComment = comment;
  if (product) personBody.orderProduct = product;

  const peopleUrl = `${TWENTY_API_URL}/rest/people`;
  const peopleRes = await fetch(peopleUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TWENTY_API_KEY}`,
    },
    body: JSON.stringify(personBody),
  });

  if (!peopleRes.ok) {
    const text = await peopleRes.text();
    throw new Error(`Twenty People API ${peopleRes.status}: ${text}`);
  }

  const peopleData = await peopleRes.json();
  const personId = peopleData?.data?.createPerson?.id ?? peopleData?.id ?? peopleData?.data?.id ?? null;

  const pipelineStageId = process.env.TWENTY_PIPELINE_STAGE_ID;
  if (personId && pipelineStageId) {
    try {
      const oppBody = {
        personId,
        pipelineStageId,
        name: comment || product ? [product, comment].filter(Boolean).join(' — ') : 'Заказ с сайта',
      };
      const oppUrl = `${TWENTY_API_URL}/rest/opportunities`;
      const oppRes = await fetch(oppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TWENTY_API_KEY}`,
        },
        body: JSON.stringify(oppBody),
      });
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        const oppId = oppData?.data?.createOpportunity?.id ?? oppData?.id ?? oppData?.data?.id;
        if (oppId) return oppId;
      }
    } catch (e) {
      console.error('Twenty Opportunity create failed:', e.message);
    }
  }

  return personId;
}

// SPA-style: для order.html при прямом заходе по /order
app.get('/order', (req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'order.html'));
});

app.listen(PORT, () => {
  console.log(`VPA API: http://localhost:${PORT}`);
  console.log(`Static:  ${STATIC_DIR}`);
  if (TWENTY_API_URL) console.log('Twenty CRM: enabled');
});
