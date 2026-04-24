// Загрузка продуктов из JSON
async function loadProducts() {
    try {
        const response = await fetch('../data/products.json');
        const data = await response.json();
        const container = document.getElementById('products');
        
        // Показываем первые 6 товаров
        const products = [...data.cakes, ...data.desserts].slice(0, 6);
        
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <h3>${product.name}</h3>
                <p>${product.description || ''}</p>
                <div class="price">${product.price.toLocaleString()} тнг</div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Ошибка загрузки продуктов:', error);
    }
}

// Telegram WebApp integration
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
}

// Загружаем продукты при старте
document.addEventListener('DOMContentLoaded', loadProducts);
