# HARUKA — Replace x402 Card with Live Price Card (Developer Brief)

---

## APA YANG BERUBAH

Ganti card x402 yang sekarang ada di landing page:

```
SEKARANG:
┌─────────────────────────────────────────────────────┐
│  LIVE ON DEVNET                                     │
│  x402 powers paid agent actions in HARUKA           │
│                                                     │
│  HARUKA now exposes an x402 payment flow for...     │
│                                                     │
│  HTTP 402 native | Onchain micropayments | Agent... │
└─────────────────────────────────────────────────────┘

GANTI DENGAN:
┌─────────────────────────────────────────────────────┐
│  $HARUKA                              LIVE          │
│                                                     │
│  $0.000123                          +12.5%          │
│                                                     │
│  Market Cap        Volume 24h       Liquidity       │
│  $45K              $3.2K            $12K            │
│                                                     │
│  [Buy on Pump.fun]                                  │
└─────────────────────────────────────────────────────┘
```

Ukuran card sama persis dengan card x402 yang sekarang.
Posisi sama. Style sama. Hanya konten yang berubah.

---

## DATA SOURCE

DexScreener API — gratis, tidak perlu API key.

```
GET https://api.dexscreener.com/latest/dex/tokens/9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
```

---

## LAYOUT CARD

```html
<div class="price-card">
  
  <!-- Header -->
  <div class="price-card-header">
    <span class="price-card-title">$HARUKA</span>
    <span class="price-card-badge">LIVE</span>
  </div>

  <!-- Price + Change -->
  <div class="price-card-main">
    <span id="haruka-price" class="price-value">$0.000000</span>
    <span id="haruka-change" class="price-change">0.00%</span>
  </div>

  <!-- Stats Row -->
  <div class="price-card-stats">
    <div class="stat">
      <span class="stat-label">Market Cap</span>
      <span id="haruka-mcap" class="stat-value">—</span>
    </div>
    <div class="stat">
      <span class="stat-label">Volume 24h</span>
      <span id="haruka-volume" class="stat-value">—</span>
    </div>
    <div class="stat">
      <span class="stat-label">Liquidity</span>
      <span id="haruka-liquidity" class="stat-value">—</span>
    </div>
  </div>

  <!-- Buy Button -->
  <a href="https://pump.fun/coin/9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump" 
     target="_blank" 
     class="price-card-buy">
    Buy on Pump.fun
  </a>

</div>
```

---

## STYLING

Pakai color palette HARUKA yang existing di website.

```css
.price-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(200, 146, 42, 0.3);
  border-radius: 16px;
  padding: 24px 32px;
  /* SAMAKAN ukuran dengan card x402 yang sekarang */
  width: 100%;
  max-width: sama dengan card x402 yang existing;
  margin: 0 auto;
}

.price-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.price-card-title {
  font-size: 1rem;
  font-weight: 700;
  color: #1E2D1F;
  letter-spacing: 0.02em;
}

.price-card-badge {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  padding: 4px 10px;
  border-radius: 100px;
}

.price-card-main {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 24px;
}

.price-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1E2D1F;
}

.price-change {
  font-size: 1rem;
  font-weight: 600;
}

.price-change.price-up {
  color: #4ade80;
}

.price-change.price-down {
  color: #f87171;
}

.price-card-stats {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(200, 146, 42, 0.15);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #3D5A3E;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #1E2D1F;
}

.price-card-buy {
  display: block;
  text-align: center;
  background: #C8922A;
  color: white;
  padding: 12px 24px;
  border-radius: 100px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.price-card-buy:hover {
  background: #A06820;
}
```

---

## JAVASCRIPT

```javascript
const HARUKA_CA = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const API_URL = `https://api.dexscreener.com/latest/dex/tokens/${HARUKA_CA}`;

async function fetchPrice() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (!pair) return;

    // Price
    const priceEl = document.getElementById('haruka-price');
    const price = parseFloat(pair.priceUsd);
    priceEl.textContent = price < 0.01 
      ? `$${price.toFixed(6)}` 
      : `$${price.toFixed(4)}`;

    // 24h Change
    const changeEl = document.getElementById('haruka-change');
    const change = pair.priceChange?.h24 || 0;
    const sign = change >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${parseFloat(change).toFixed(2)}%`;
    changeEl.className = `price-change ${change >= 0 ? 'price-up' : 'price-down'}`;

    // Market Cap
    const mcapEl = document.getElementById('haruka-mcap');
    const mc = pair.marketCap || 0;
    mcapEl.textContent = mc >= 1_000_000 
      ? `$${(mc / 1_000_000).toFixed(2)}M`
      : mc >= 1_000 
        ? `$${(mc / 1_000).toFixed(1)}K`
        : `$${mc.toFixed(0)}`;

    // Volume
    const volEl = document.getElementById('haruka-volume');
    const vol = pair.volume?.h24 || 0;
    volEl.textContent = vol >= 1_000_000 
      ? `$${(vol / 1_000_000).toFixed(2)}M`
      : vol >= 1_000 
        ? `$${(vol / 1_000).toFixed(1)}K`
        : `$${vol.toFixed(0)}`;

    // Liquidity
    const liqEl = document.getElementById('haruka-liquidity');
    const liq = pair.liquidity?.usd || 0;
    liqEl.textContent = liq >= 1_000_000 
      ? `$${(liq / 1_000_000).toFixed(2)}M`
      : liq >= 1_000 
        ? `$${(liq / 1_000).toFixed(1)}K`
        : `$${liq.toFixed(0)}`;

  } catch (error) {
    console.error('Price fetch failed:', error);
  }
}

// Fetch pertama kali
fetchPrice();

// Auto refresh setiap 30 detik
setInterval(fetchPrice, 30000);
```

---

## YANG DIKERJAKAN

```
1. Hapus card x402 dari landing page
2. Ganti dengan price card di posisi yang sama
3. Ukuran card sama persis
4. Pakai styling yang sudah ada di atas
5. Tambah JavaScript fetch + auto refresh
6. Test — pastikan data muncul dan update setiap 30 detik
7. Test — pastikan warna hijau/merah sesuai naik/turun
8. Test — pastikan buy button link ke pump.fun
```
