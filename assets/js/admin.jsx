/* ============================================
   Vkusno Polezno — Admin panel
   ============================================ */
const { useState, useEffect, useCallback, useMemo } = React;

const LANGS = ['ru','kz','en'];
const STORAGE_KEY = 'vp_admin_auth';

// ─── Список администраторов ───────────────────────
// Чтобы добавить нового — допишите строку. Пароль хранится как SHA-256 хэш.
// Сгенерировать хэш: открыть DevTools (F12) → Console → выполнить:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('ВАШ_ПАРОЛЬ'))
//     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
const ADMIN_USERS = [
  // email, sha256(password), display name
  // Пароль по умолчанию: vkusno2026
  { email: 'admin@vkusno-polezno.kz',
    pwHash: 'ef56e7c4f74d96eb7d6536733bad8608b62a4d3902363f5e884868fda019f035',
    name: 'Администратор' }
];

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2,'0')).join('');
}

// ─────────────────────────────────────────────────
// GitHub API helpers
// ─────────────────────────────────────────────────
async function ghGet({ token, owner, repo, branch, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${path}: ${r.status}`);
  return await r.json();
}

async function ghPut({ token, owner, repo, branch, path, content, sha, message }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const body = {
    message: message || `update ${path}`,
    content: btoa(unescape(encodeURIComponent(content))),
    branch
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`GitHub PUT ${path}: ${r.status} ${err}`);
  }
  return await r.json();
}

async function loadJson(file) {
  const r = await fetch(`data/${file}.json?_=${Date.now()}`);
  if (!r.ok) throw new Error(`load ${file}.json: ${r.status}`);
  return await r.json();
}

// ─────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, kind='ok') => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);
  const node = toast ? <div className={`toast toast--${toast.kind}`}>{toast.msg}</div> : null;
  return [show, node];
}

// ─────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const user = ADMIN_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) { setErr('Пользователь не найден'); setBusy(false); return; }
      const hash = await sha256(pw);
      if (hash !== user.pwHash) { setErr('Неверный пароль'); setBusy(false); return; }
      onLogin({ email: user.email, name: user.name });
    } catch (ex) {
      setErr('Ошибка: ' + ex.message); setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <h1 className="login__title">Vkusno Polezno · Админ</h1>
        <p className="login__sub">Вход для администраторов сайта</p>

        <label className="field">
          <span className="field__label">Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required placeholder="admin@vkusno-polezno.kz" />
        </label>

        <label className="field">
          <span className="field__label">Пароль</span>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} required />
        </label>

        {err && <div style={{ color: 'var(--berry)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

        <button type="submit" className="btn btn--full" disabled={busy}>{busy ? 'Проверка…' : 'Войти'}</button>

        <div className="help" style={{ marginTop: 16, lineHeight: 1.6 }}>
          Альтернативный способ управления контентом — <a href="admin-cms/" target="_blank">Decap CMS</a> (вход через GitHub-аккаунт).
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Multi-language input
// ─────────────────────────────────────────────────
function MLInput({ value, onChange, type='text', label, hint }) {
  const [lang, setLang] = useState('ru');
  const v = value || {};
  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="lang-tabs">
        {LANGS.map(l => (
          <button type="button" key={l} className={lang === l ? 'is-active' : ''} onClick={() => setLang(l)}>{l}</button>
        ))}
      </div>
      {type === 'textarea' ? (
        <textarea value={v[lang] || ''} onChange={e => onChange({ ...v, [lang]: e.target.value })} />
      ) : (
        <input type="text" value={v[lang] || ''} onChange={e => onChange({ ...v, [lang]: e.target.value })} />
      )}
      {hint && <div className="help">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────
function SiteSection({ data, onChange }) {
  const update = (path, val) => {
    const next = JSON.parse(JSON.stringify(data));
    let cur = next;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = val;
    onChange(next);
  };
  return (
    <div>
      <div className="card">
        <h3>Бренд</h3>
        <div className="grid-2">
          <label className="field"><span className="field__label">Название</span>
            <input type="text" value={data.brand.name} onChange={e => update('brand.name', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Город</span>
            <input type="text" value={data.brand.city} onChange={e => update('brand.city', e.target.value)} />
          </label>
        </div>
        <MLInput label="Слоган" value={data.brand.tagline} onChange={v => update('brand.tagline', v)} />
        <div className="grid-2">
          <label className="field"><span className="field__label">Валюта (символ)</span>
            <input type="text" value={data.brand.currency} onChange={e => update('brand.currency', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Код валюты</span>
            <input type="text" value={data.brand.currencyCode} onChange={e => update('brand.currencyCode', e.target.value)} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Контакты</h3>
        <div className="grid-2">
          <label className="field"><span className="field__label">Телефон</span>
            <input type="text" value={data.contacts.phone} onChange={e => update('contacts.phone', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">WhatsApp (без +)</span>
            <input type="text" value={data.contacts.whatsapp} onChange={e => update('contacts.whatsapp', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Email</span>
            <input type="email" value={data.contacts.email} onChange={e => update('contacts.email', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Instagram (логин)</span>
            <input type="text" value={data.contacts.instagram} onChange={e => update('contacts.instagram', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Telegram (логин)</span>
            <input type="text" value={data.contacts.telegram} onChange={e => update('contacts.telegram', e.target.value)} />
          </label>
        </div>
        <MLInput label="Адрес" value={data.contacts.address} onChange={v => update('contacts.address', v)} />
        <MLInput label="Часы работы" value={data.contacts.hours} onChange={v => update('contacts.hours', v)} />
      </div>

      <div className="card">
        <h3>Соцсети (полные ссылки)</h3>
        <div className="grid-3">
          <label className="field"><span className="field__label">Instagram URL</span>
            <input type="url" value={data.social.instagram} onChange={e => update('social.instagram', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">WhatsApp URL</span>
            <input type="url" value={data.social.whatsapp} onChange={e => update('social.whatsapp', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Telegram URL</span>
            <input type="url" value={data.social.telegram} onChange={e => update('social.telegram', e.target.value)} />
          </label>
        </div>
      </div>
    </div>
  );
}

function ProductsSection({ data, onChange }) {
  const [editing, setEditing] = useState(null);
  const items = data.items || [];

  const save = (item) => {
    const next = { ...data };
    const idx = next.items.findIndex(i => i.id === item.id);
    if (idx >= 0) next.items[idx] = item;
    else next.items = [...next.items, item];
    onChange(next);
    setEditing(null);
  };

  const remove = (id) => {
    if (!confirm('Удалить товар?')) return;
    onChange({ ...data, items: data.items.filter(i => i.id !== id) });
  };

  const addNew = () => {
    setEditing({
      id: 'new-' + Date.now(),
      category: data.categories[0]?.id || '',
      title: { ru:'', kz:'', en:'' },
      description: { ru:'', kz:'', en:'' },
      ingredients: { ru:'', kz:'', en:'' },
      price: 0,
      unit: 'kg',
      image: '',
      badges: [],
      allergens: [],
      weights: [],
      active: true
    });
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Товары ({items.length})</h3>
          <button className="btn btn--sage" onClick={addNew}>+ Добавить</button>
        </div>
        {items.length === 0 ? (
          <div className="empty">Товаров пока нет. Нажмите «Добавить».</div>
        ) : (
          <table className="table">
            <thead><tr>
              <th>Название</th><th>Категория</th><th>Цена</th><th>Статус</th><th></th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.title?.ru || item.id}</strong></td>
                  <td>{data.categories.find(c => c.id === item.category)?.name?.ru || '—'}</td>
                  <td>{item.price?.toLocaleString('ru-RU')} ₸</td>
                  <td><span className={`badge ${item.active ? '' : 'badge--off'}`}>{item.active ? 'Активен' : 'Скрыт'}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => setEditing(item)}>Изменить</button>
                    <button className="btn btn--danger btn--sm" style={{ marginLeft: 6 }} onClick={() => remove(item.id)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Категории</h3>
        <CategoryEditor cats={data.categories} onChange={cats => onChange({ ...data, categories: cats })} />
      </div>

      {editing && <ProductModal product={editing} categories={data.categories} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CategoryEditor({ cats, onChange }) {
  const update = (i, field, val) => {
    const next = [...cats];
    if (field === 'id') next[i].id = val;
    else next[i].name = { ...next[i].name, [field]: val };
    onChange(next);
  };
  const add = () => onChange([...cats, { id: 'cat-' + Date.now(), name: { ru:'', kz:'', en:'' } }]);
  const remove = (i) => { if (confirm('Удалить категорию?')) onChange(cats.filter((_, j) => j !== i)); };

  return (
    <div>
      <table className="table">
        <thead><tr><th>ID</th><th>RU</th><th>KZ</th><th>EN</th><th></th></tr></thead>
        <tbody>
          {cats.map((c, i) => (
            <tr key={i}>
              <td><input type="text" value={c.id} onChange={e => update(i, 'id', e.target.value)} /></td>
              <td><input type="text" value={c.name.ru || ''} onChange={e => update(i, 'ru', e.target.value)} /></td>
              <td><input type="text" value={c.name.kz || ''} onChange={e => update(i, 'kz', e.target.value)} /></td>
              <td><input type="text" value={c.name.en || ''} onChange={e => update(i, 'en', e.target.value)} /></td>
              <td><button className="btn btn--danger btn--sm" onClick={() => remove(i)}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={add}>+ Добавить категорию</button>
    </div>
  );
}

function ProductModal({ product, categories, onSave, onClose }) {
  const [p, setP] = useState(product);
  const updateField = (k, v) => setP({ ...p, [k]: v });

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{product.id.startsWith('new-') ? 'Новый товар' : 'Редактирование товара'}</h2>

        <div className="grid-2">
          <label className="field"><span className="field__label">ID (slug)</span>
            <input type="text" value={p.id} onChange={e => updateField('id', e.target.value)} />
          </label>
          <label className="field"><span className="field__label">Категория</span>
            <select value={p.category} onChange={e => updateField('category', e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name?.ru || c.id}</option>)}
            </select>
          </label>
        </div>

        <MLInput label="Название" value={p.title} onChange={v => updateField('title', v)} />
        <MLInput label="Описание" type="textarea" value={p.description} onChange={v => updateField('description', v)} />
        <MLInput label="Ингредиенты" type="textarea" value={p.ingredients} onChange={v => updateField('ingredients', v)} />

        <div className="grid-3">
          <label className="field"><span className="field__label">Цена (₸)</span>
            <input type="number" value={p.price} onChange={e => updateField('price', Number(e.target.value))} />
          </label>
          <label className="field"><span className="field__label">Единица</span>
            <select value={p.unit} onChange={e => updateField('unit', e.target.value)}>
              <option value="kg">кг</option>
              <option value="pc">шт</option>
              <option value="100g">100г</option>
            </select>
          </label>
          <label className="field"><span className="field__label">Активен</span>
            <select value={p.active ? '1' : '0'} onChange={e => updateField('active', e.target.value === '1')}>
              <option value="1">Да</option>
              <option value="0">Нет</option>
            </select>
          </label>
        </div>

        <label className="field"><span className="field__label">Фото (URL)</span>
          <input type="url" value={p.image || ''} onChange={e => updateField('image', e.target.value)} placeholder="https://..." />
          <span className="field__hint">Загружайте фото на Imgur / Cloudinary / Instagram CDN и вставляйте прямую ссылку.</span>
        </label>

        <PillEditor label="Бейджи (bestseller, new, low-sugar...)" items={p.badges || []} onChange={v => updateField('badges', v)} />
        <PillEditor label="Аллергены (gluten, dairy, eggs, nuts...)" items={p.allergens || []} onChange={v => updateField('allergens', v)} />

        <WeightsEditor weights={p.weights || []} onChange={v => updateField('weights', v)} />

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn--sage" onClick={() => onSave(p)}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function PillEditor({ label, items, onChange }) {
  const [val, setVal] = useState('');
  const add = () => { if (val.trim()) { onChange([...items, val.trim()]); setVal(''); } };
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="pill-list" style={{ marginBottom: 8 }}>
        {items.map((t, i) => (
          <span className="pill" key={i}>{t}<button onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button></span>
        ))}
      </div>
      <div className="row-add">
        <input type="text" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button className="btn btn--ghost btn--sm" onClick={add}>+</button>
      </div>
    </div>
  );
}

function WeightsEditor({ weights, onChange }) {
  const update = (i, k, v) => {
    const next = [...weights];
    next[i] = { ...next[i], [k]: k === 'servings' ? v : Number(v) };
    onChange(next);
  };
  return (
    <div className="field">
      <span className="field__label">Веса и цены</span>
      <table className="table">
        <thead><tr><th>Вес (кг)</th><th>Цена (₸)</th><th>Порций</th><th></th></tr></thead>
        <tbody>
          {weights.map((w, i) => (
            <tr key={i}>
              <td><input type="number" step="0.5" value={w.kg} onChange={e => update(i, 'kg', e.target.value)} /></td>
              <td><input type="number" value={w.price} onChange={e => update(i, 'price', e.target.value)} /></td>
              <td><input type="text" value={w.servings} onChange={e => update(i, 'servings', e.target.value)} /></td>
              <td><button className="btn btn--danger btn--sm" onClick={() => onChange(weights.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn--ghost btn--sm" style={{ marginTop: 8 }} onClick={() => onChange([...weights, { kg: 1, price: 0, servings: '' }])}>+ Добавить вес</button>
    </div>
  );
}

function ReviewsSection({ data, onChange }) {
  const items = data.items || [];
  const update = (i, k, v) => {
    const next = { ...data, items: [...items] };
    if (k === 'text') next.items[i] = { ...next.items[i], text: v };
    else next.items[i] = { ...next.items[i], [k]: v };
    onChange(next);
  };
  const add = () => onChange({ ...data, items: [...items, {
    id: 'r' + (items.length + 1),
    author: '', rating: 5, date: new Date().toISOString().slice(0,10),
    text: { ru:'', kz:'', en:'' }
  }] });
  const remove = (i) => { if (confirm('Удалить отзыв?')) onChange({ ...data, items: items.filter((_, j) => j !== i) }); };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Отзывы ({items.length})</h3>
          <button className="btn btn--sage" onClick={add}>+ Добавить</button>
        </div>
        {items.length === 0 ? <div className="empty">Отзывов пока нет.</div> : items.map((r, i) => (
          <div key={i} style={{ padding: 16, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12 }}>
            <div className="grid-3">
              <label className="field"><span className="field__label">Автор</span>
                <input type="text" value={r.author} onChange={e => update(i, 'author', e.target.value)} />
              </label>
              <label className="field"><span className="field__label">Рейтинг</span>
                <select value={r.rating} onChange={e => update(i, 'rating', Number(e.target.value))}>
                  {[5,4,3,2,1].map(n => <option key={n} value={n}>{'★'.repeat(n)}</option>)}
                </select>
              </label>
              <label className="field"><span className="field__label">Дата</span>
                <input type="date" value={r.date} onChange={e => update(i, 'date', e.target.value)} />
              </label>
            </div>
            <MLInput label="Текст" type="textarea" value={r.text} onChange={v => update(i, 'text', v)} />
            <button className="btn btn--danger btn--sm" onClick={() => remove(i)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GallerySection({ data, onChange }) {
  const items = data.items || [];
  const [url, setUrl] = useState('');
  const add = () => { if (url.trim()) { onChange({ ...data, items: [...items, { url: url.trim() }] }); setUrl(''); } };
  const remove = (i) => onChange({ ...data, items: items.filter((_, j) => j !== i) });

  return (
    <div className="card">
      <h3>Галерея ({items.length})</h3>
      <div className="row-add" style={{ marginBottom: 16 }}>
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button className="btn btn--sage" onClick={add}>+ Добавить</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {items.map((it, i) => (
          <div key={i}>
            <div className="img-preview" style={{ backgroundImage: it.url ? `url(${it.url})` : 'none' }}>
              {!it.url && '—'}
            </div>
            <button className="btn btn--danger btn--sm" style={{ marginTop: 6, width: '100%' }} onClick={() => remove(i)}>Удалить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PagesSection({ data, onChange }) {
  const [sub, setSub] = useState('home');
  const update = (path, val) => {
    const next = JSON.parse(JSON.stringify(data));
    let cur = next;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
    onChange(next);
  };

  const ensure = (key, def) => { if (!data[key]) onChange({ ...data, [key]: def }); };

  const subs = [
    { id: 'seo', label: 'SEO' },
    { id: 'home', label: 'Главная' },
    { id: 'about', label: 'О нас' },
    { id: 'delivery', label: 'Доставка' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <div>
      <div className="lang-tabs" style={{ marginBottom: 16 }}>
        {subs.map(s => (
          <button key={s.id} type="button" className={sub === s.id ? 'is-active' : ''} onClick={() => setSub(s.id)}>{s.label}</button>
        ))}
      </div>

      {sub === 'seo' && <SeoBlock data={data.seo || {}} update={update} />}
      {sub === 'home' && <HomeBlock data={data.home || {}} update={update} onChange={onChange} all={data} />}
      {sub === 'about' && <AboutBlock data={data.about || {}} update={update} onChange={onChange} all={data} />}
      {sub === 'delivery' && <DeliveryBlock data={data.delivery || {}} update={update} onChange={onChange} all={data} />}
      {sub === 'faq' && <FaqBlock data={data.faq || {}} update={update} onChange={onChange} all={data} />}
    </div>
  );
}

function SeoBlock({ data, update }) {
  return (
    <div className="card">
      <h3>SEO / мета-теги</h3>
      <MLInput label="Title (вкладка браузера)" value={data.title} onChange={v => update('seo.title', v)} />
      <MLInput label="Description" type="textarea" value={data.description} onChange={v => update('seo.description', v)} />
      <MLInput label="Keywords (через запятую)" value={data.keywords} onChange={v => update('seo.keywords', v)} />
      <label className="field"><span className="field__label">OG image (URL)</span>
        <input type="url" value={data.ogImage || ''} onChange={e => update('seo.ogImage', e.target.value)} />
        <span className="field__hint">Картинка для предпросмотра в соцсетях, ~1200×630.</span>
      </label>
    </div>
  );
}

function HomeBlock({ data, update, onChange, all }) {
  const features = data.features?.items || [];
  const steps = data.howto?.steps || [];

  const updateArr = (path, arr) => {
    const next = JSON.parse(JSON.stringify(all));
    let cur = next;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = arr;
    onChange(next);
  };

  return (
    <div>
      <div className="card">
        <h3>Hero</h3>
        <MLInput label="Eyebrow" value={data.hero?.eyebrow} onChange={v => update('home.hero.eyebrow', v)} />
        <MLInput label="Заголовок (можно <em>курсив</em>)" value={data.hero?.title} onChange={v => update('home.hero.title', v)} />
        <MLInput label="Подзаголовок" type="textarea" value={data.hero?.subtitle} onChange={v => update('home.hero.subtitle', v)} />
        <div className="grid-2">
          <div><MLInput label="Кнопка 1 (главная)" value={data.hero?.ctaPrimary} onChange={v => update('home.hero.ctaPrimary', v)} /></div>
          <div><MLInput label="Кнопка 2 (вторая)"  value={data.hero?.ctaSecondary} onChange={v => update('home.hero.ctaSecondary', v)} /></div>
        </div>
      </div>

      <div className="card">
        <h3>Преимущества</h3>
        <MLInput label="Заголовок секции" value={data.features?.title} onChange={v => update('home.features.title', v)} />
        {features.map((f, i) => (
          <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12 }}>
            <div className="grid-2">
              <label className="field"><span className="field__label">Иконка (эмодзи)</span>
                <input type="text" value={f.icon || ''} onChange={e => {
                  const arr = [...features]; arr[i] = { ...arr[i], icon: e.target.value };
                  updateArr('home.features.items', arr);
                }} />
              </label>
              <div></div>
            </div>
            <MLInput label="Заголовок" value={f.title} onChange={v => { const arr = [...features]; arr[i] = { ...arr[i], title: v }; updateArr('home.features.items', arr); }} />
            <MLInput label="Текст" type="textarea" value={f.text} onChange={v => { const arr = [...features]; arr[i] = { ...arr[i], text: v }; updateArr('home.features.items', arr); }} />
            <button className="btn btn--danger btn--sm" onClick={() => updateArr('home.features.items', features.filter((_, j) => j !== i))}>Удалить</button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={() => updateArr('home.features.items', [...features, { icon: '✨', title: { ru:'', kz:'', en:'' }, text: { ru:'', kz:'', en:'' } }])}>+ Добавить преимущество</button>
      </div>

      <div className="card">
        <h3>Как заказать</h3>
        <MLInput label="Заголовок секции" value={data.howto?.title} onChange={v => update('home.howto.title', v)} />
        {steps.map((s, i) => (
          <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Шаг {i + 1}</div>
            <MLInput label="Заголовок" value={s.title} onChange={v => { const arr = [...steps]; arr[i] = { ...arr[i], title: v }; updateArr('home.howto.steps', arr); }} />
            <MLInput label="Текст" type="textarea" value={s.text} onChange={v => { const arr = [...steps]; arr[i] = { ...arr[i], text: v }; updateArr('home.howto.steps', arr); }} />
            <button className="btn btn--danger btn--sm" onClick={() => updateArr('home.howto.steps', steps.filter((_, j) => j !== i))}>Удалить</button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={() => updateArr('home.howto.steps', [...steps, { title: { ru:'', kz:'', en:'' }, text: { ru:'', kz:'', en:'' } }])}>+ Добавить шаг</button>
      </div>

      <div className="card">
        <h3>CTA-блок (внизу главной)</h3>
        <MLInput label="Заголовок" value={data.cta?.title} onChange={v => update('home.cta.title', v)} />
        <MLInput label="Текст" type="textarea" value={data.cta?.text} onChange={v => update('home.cta.text', v)} />
        <MLInput label="Кнопка" value={data.cta?.button} onChange={v => update('home.cta.button', v)} />
      </div>
    </div>
  );
}

function AboutBlock({ data, update, onChange, all }) {
  const values = data.values || [];
  const updateValues = (arr) => {
    const next = { ...all, about: { ...all.about, values: arr } };
    onChange(next);
  };

  return (
    <div>
      <div className="card">
        <h3>О нас</h3>
        <MLInput label="Заголовок" value={data.title} onChange={v => update('about.title', v)} />
        <MLInput label="Лид (первая фраза)" value={data.lead} onChange={v => update('about.lead', v)} />
        <MLInput label="История" type="textarea" value={data.story} onChange={v => update('about.story', v)} />
      </div>
      <div className="card">
        <h3>Ценности</h3>
        {values.map((val, i) => (
          <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12 }}>
            <MLInput label="Заголовок" value={val.title} onChange={v => { const arr = [...values]; arr[i] = { ...arr[i], title: v }; updateValues(arr); }} />
            <MLInput label="Текст" type="textarea" value={val.text} onChange={v => { const arr = [...values]; arr[i] = { ...arr[i], text: v }; updateValues(arr); }} />
            <button className="btn btn--danger btn--sm" onClick={() => updateValues(values.filter((_, j) => j !== i))}>Удалить</button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={() => updateValues([...values, { title: { ru:'', kz:'', en:'' }, text: { ru:'', kz:'', en:'' } }])}>+ Добавить ценность</button>
      </div>
    </div>
  );
}

function DeliveryBlock({ data, update, onChange, all }) {
  const updList = (key, arr) => {
    const next = JSON.parse(JSON.stringify(all));
    next.delivery[key].items = arr;
    onChange(next);
  };
  const dItems = data.delivery?.items || [];
  const pItems = data.payment?.items || [];

  const renderList = (key, items) => (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 8 }}>
          <MLInput label={`Пункт ${i + 1}`} value={it} onChange={v => { const arr = [...items]; arr[i] = v; updList(key, arr); }} />
          <button className="btn btn--danger btn--sm" onClick={() => updList(key, items.filter((_, j) => j !== i))}>Удалить</button>
        </div>
      ))}
      <button className="btn btn--ghost btn--sm" onClick={() => updList(key, [...items, { ru:'', kz:'', en:'' }])}>+ Добавить пункт</button>
    </div>
  );

  return (
    <div>
      <div className="card">
        <h3>Доставка и оплата</h3>
        <MLInput label="Заголовок страницы" value={data.title} onChange={v => update('delivery.title', v)} />
      </div>
      <div className="card">
        <h3>Доставка</h3>
        <MLInput label="Подзаголовок" value={data.delivery?.title} onChange={v => update('delivery.delivery.title', v)} />
        {renderList('delivery', dItems)}
      </div>
      <div className="card">
        <h3>Оплата</h3>
        <MLInput label="Подзаголовок" value={data.payment?.title} onChange={v => update('delivery.payment.title', v)} />
        {renderList('payment', pItems)}
      </div>
      <div className="card">
        <h3>Сроки</h3>
        <MLInput label="Подзаголовок" value={data.leadtime?.title} onChange={v => update('delivery.leadtime.title', v)} />
        <MLInput label="Текст" type="textarea" value={data.leadtime?.text} onChange={v => update('delivery.leadtime.text', v)} />
      </div>
    </div>
  );
}

function FaqBlock({ data, update, onChange, all }) {
  const items = data.items || [];
  const updItems = (arr) => onChange({ ...all, faq: { ...all.faq, items: arr } });

  return (
    <div>
      <div className="card">
        <h3>FAQ</h3>
        <MLInput label="Заголовок секции" value={data.title} onChange={v => update('faq.title', v)} />
      </div>
      <div className="card">
        <h3>Вопросы и ответы ({items.length})</h3>
        {items.map((it, i) => (
          <div key={i} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', marginBottom: 12 }}>
            <MLInput label="Вопрос" value={it.q} onChange={v => { const arr = [...items]; arr[i] = { ...arr[i], q: v }; updItems(arr); }} />
            <MLInput label="Ответ" type="textarea" value={it.a} onChange={v => { const arr = [...items]; arr[i] = { ...arr[i], a: v }; updItems(arr); }} />
            <button className="btn btn--danger btn--sm" onClick={() => updItems(items.filter((_, j) => j !== i))}>Удалить</button>
          </div>
        ))}
        <button className="btn btn--ghost btn--sm" onClick={() => updItems([...items, { q: { ru:'', kz:'', en:'' }, a: { ru:'', kz:'', en:'' } }])}>+ Добавить вопрос</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// App shell
// ─────────────────────────────────────────────────
function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; }
  });
  const [tab, setTab] = useState('site');
  const [data, setData] = useState({ site: null, products: null, pages: null, reviews: null, gallery: null });
  const [shas, setShas] = useState({});
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState({});
  const [showToast, toastNode] = useToast();

  useEffect(() => {
    if (!auth) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    (async () => {
      setLoading(true);
      try {
        const files = ['site','products','pages','reviews','gallery'];
        const next = {};
        for (const f of files) next[f] = await loadJson(f);
        setData(next);
      } catch (e) {
        showToast('Ошибка загрузки: ' + e.message, 'err');
      } finally { setLoading(false); }
    })();
  }, [auth]);

  const updateData = (key, val) => {
    setData(d => ({ ...d, [key]: val }));
    setDirty(d => ({ ...d, [key]: true }));
  };

  // Скачать изменённые JSON одним архивом-папкой (по очереди файлов)
  const exportChanges = () => {
    const dirtyFiles = Object.keys(dirty).filter(k => dirty[k]);
    if (dirtyFiles.length === 0) { showToast('Нет изменений', 'ok'); return; }
    dirtyFiles.forEach((f, i) => {
      setTimeout(() => {
        const content = JSON.stringify(data[f], null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${f}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, i * 200);
    });
    showToast(`Скачано файлов: ${dirtyFiles.length}. Загрузите их в data/ репозитория.`, 'ok');
  };

  // Сохранение в GitHub через временный токен (запрашивается при сохранении)
  const saveToGitHub = async () => {
    if (!data.site) return;
    const dirtyFiles = Object.keys(dirty).filter(k => dirty[k]);
    if (dirtyFiles.length === 0) { showToast('Нет изменений', 'ok'); return; }

    let token = sessionStorage.getItem('vp_gh_token');
    if (!token) {
      token = prompt(
        'Для сохранения напрямую в GitHub нужен Personal Access Token.\n\n' +
        'Создать: github.com/settings/personal-access-tokens/new\n' +
        '• Repository access: только Roxas80/VP-\n' +
        '• Permissions: Contents — Read & write\n\n' +
        'Токен сохранится только до закрытия вкладки.\n\nВведите токен:'
      );
      if (!token) return;
      if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        showToast('Неверный формат токена', 'err'); return;
      }
      sessionStorage.setItem('vp_gh_token', token);
    }

    setLoading(true);
    try {
      const { owner, repo, branch } = data.site.github;
      const newShas = { ...shas };
      for (const f of dirtyFiles) {
        // get current sha
        if (!newShas[f]) {
          const meta = await ghGet({ token, owner, repo, branch, path: `data/${f}.json` });
          if (meta) newShas[f] = meta.sha;
        }
        const content = JSON.stringify(data[f], null, 2);
        const res = await ghPut({
          token, owner, repo, branch,
          path: `data/${f}.json`, content,
          sha: newShas[f],
          message: `admin: update ${f} (by ${auth.email})`
        });
        newShas[f] = res.content.sha;
      }
      setShas(newShas);
      setDirty({});
      showToast(`Опубликовано: ${dirtyFiles.join(', ')}`, 'ok');
    } catch (e) {
      sessionStorage.removeItem('vp_gh_token');
      showToast('Ошибка: ' + e.message, 'err');
    } finally { setLoading(false); }
  };

  const logout = () => { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem('vp_gh_token'); setAuth(null); };

  if (!auth) return <Login onLogin={setAuth} />;
  if (loading && !data.site) return <div className="login"><div className="login__card"><p>Загрузка…</p></div></div>;
  if (!data.site) return null;

  const tabs = [
    { id: 'site',     label: '⚙️  Настройки сайта' },
    { id: 'pages',    label: '📄  Тексты страниц' },
    { id: 'products', label: '🍰  Товары' },
    { id: 'reviews',  label: '⭐  Отзывы' },
    { id: 'gallery',  label: '🖼️  Галерея' },
  ];

  const dirtyCount = Object.values(dirty).filter(Boolean).length;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand"><strong>Vkusno Polezno</strong><span>Админ-панель</span></div>
        <nav className="sidebar__nav">
          {tabs.map(t => (
            <button key={t.id} className={`sidebar__link ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}{dirty[t.id] && <span style={{ marginLeft: 'auto', color: 'var(--honey)' }}>●</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar__foot">
          <span className="status-dot status-dot--ok"></span>{auth.name || auth.email}<br/>
          <button onClick={logout}>Выйти →</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <h1>{tabs.find(t => t.id === tab)?.label}</h1>
          <div className="actions">
            <a href="index.html" target="_blank" className="btn btn--ghost">Открыть сайт ↗</a>
            <button className="btn btn--ghost" disabled={dirtyCount === 0} onClick={exportChanges} title="Скачать изменённые файлы и загрузить вручную в репо">
              ⬇️ Скачать ({dirtyCount})
            </button>
            <button className="btn btn--sage" disabled={loading || dirtyCount === 0} onClick={saveToGitHub} title="Опубликовать на сайт через GitHub">
              {loading ? 'Публикация…' : `🚀 Опубликовать (${dirtyCount})`}
            </button>
          </div>
        </div>

        {tab === 'site'     && <SiteSection     data={data.site}     onChange={v => updateData('site', v)} />}
        {tab === 'pages'    && <PagesSection    data={data.pages}    onChange={v => updateData('pages', v)} />}
        {tab === 'products' && <ProductsSection data={data.products} onChange={v => updateData('products', v)} />}
        {tab === 'reviews'  && <ReviewsSection  data={data.reviews}  onChange={v => updateData('reviews', v)} />}
        {tab === 'gallery'  && <GallerySection  data={data.gallery}  onChange={v => updateData('gallery', v)} />}
      </main>

      {toastNode}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
