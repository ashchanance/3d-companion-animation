# HARUKA — x402 Implementation Brief

---

## APA ITU x402

x402 adalah payment protocol yang menggunakan HTTP status code 402 "Payment Required".
Fungsinya: memastikan setiap request ke Haruka API sudah bayar dulu sebelum diproses.

Developer luar yang mau pakai Haruka API harus bayar per call.
Payment terjadi otomatis on-chain dalam USDC.
Tidak ada invoice, tidak ada manual process.

---

## FLOW LENGKAP

```
Developer kirim request ke Haruka API
│
├─ GET https://api.harukacompanion.tech/chat
│
▼
x402 middleware cek: ada payment header?
│
├── TIDAK ADA ──▶ Return HTTP 402
│                 Response berisi:
│                 {
│                   "status": 402,
│                   "paymentRequired": true,
│                   "price": "0.001",
│                   "currency": "USDC",
│                   "network": "solana",
│                   "payTo": "HARUKA_TREASURY_WALLET"
│                 }
│                 
│                 Developer terima instruksi ini,
│                 sign transaksi USDC,
│                 kirim ulang request dengan payment proof di header.
│
├── ADA ─────────▶ x402 verifikasi payment on-chain
│                  │
│                  ├── VALID ──▶ Request lanjut ke Haruka API
│                  │             Soul Engine proses
│                  │             Return response ke developer
│                  │
│                  ├── INVALID ▶ Return 402 lagi
│
▼
USDC sudah masuk ke HARUKA treasury wallet
│
▼
Buyback bot detect USDC masuk
│
▼
Auto swap USDC → $HARUKA via Jupiter DEX
│
▼
$HARUKA di-burn
│
▼
Supply berkurang. Holder benefit.
```

---

## IMPLEMENTASI

### Step 1 — Install x402

```bash
npm install x402
```

---

### Step 2 — Setup Treasury Wallet

Buat dedicated Solana wallet khusus untuk HARUKA treasury.
Jangan pakai wallet personal.

```bash
solana-keygen new --outfile haruka-treasury.json
```

Simpan public key dan private key.
Tambahkan ke environment variables:

```env
HARUKA_TREASURY_WALLET=public_key_disini
HARUKA_TREASURY_PRIVATE_KEY=private_key_disini
```

---

### Step 3 — Wrap API Endpoint dengan x402

Sebelum x402:
```
Developer call /chat → langsung masuk ke Soul Engine → gratis
```

Sesudah x402:
```
Developer call /chat → x402 cek payment → kalau sudah bayar → masuk ke Soul Engine
```

Implementasi di code:

```typescript
import { x402Middleware } from 'x402';

// Harga per API call
const PRICE_PER_CALL = '0.001'; // USDC

// Wrap endpoint /chat
app.post('/chat', 
  x402Middleware({
    wallet: process.env.HARUKA_TREASURY_WALLET,
    price: PRICE_PER_CALL,
    currency: 'USDC',
    network: 'solana'
  }),
  async (req, res) => {
    // Kalau sampai sini = sudah bayar
    // Lanjut ke Soul Engine seperti biasa
    const { message, userId, sessionId } = req.body;
    
    const response = await soulEngine.process({
      message,
      userId,
      sessionId
    });

    return res.json({
      response: response.text,
      emotion: response.emotion,
      memoryUpdated: response.memoryUpdated
    });
  }
);
```

---

### Step 4 — Setup Pricing Tiers (opsional)

```typescript
const PRICING = {
  free: {
    calls: 100,      // 100 calls per hari gratis (untuk testing)
    price: '0'
  },
  basic: {
    calls: Infinity,
    price: '0.001'   // $0.001 USDC per call
  },
  holder: {
    calls: Infinity,
    price: '0.0005'  // 50% diskon untuk holder $HARUKA
  }
};
```

Holder discount: cek on-chain apakah wallet developer hold $HARUKA.
Kalau hold → kasih rate lebih murah.

---

### Step 5 — Buyback Bot (setelah x402 jalan)

Script terpisah yang monitor treasury wallet.

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Jupiter } from '@jup-ag/core';

const TREASURY = new PublicKey(process.env.HARUKA_TREASURY_WALLET);
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const HARUKA_MINT = new PublicKey('9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump');
const BURN_ADDRESS = new PublicKey('1111111111111111111111111111111111111111111');

async function checkAndBuyback() {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  
  // Cek saldo USDC di treasury
  const usdcBalance = await getTokenBalance(connection, TREASURY, USDC_MINT);
  
  // Kalau ada USDC masuk, swap ke $HARUKA
  if (usdcBalance > 0) {
    // Swap USDC → $HARUKA via Jupiter
    const jupiter = await Jupiter.load({ connection });
    
    const routes = await jupiter.computeRoutes({
      inputMint: USDC_MINT,
      outputMint: HARUKA_MINT,
      amount: usdcBalance,
      slippageBps: 50 // 0.5% slippage
    });

    const bestRoute = routes.routesInfos[0];
    const { execute } = await jupiter.exchange({ routeInfo: bestRoute });
    const result = await execute();
    
    // Burn $HARUKA yang dibeli
    // Transfer ke burn address
    console.log('Buyback complete. Burning $HARUKA...');
  }
}

// Jalankan setiap 5 menit
setInterval(checkAndBuyback, 5 * 60 * 1000);
```

---

## DEPLOYMENT

Deploy ke Railway — same instance dengan API Server dan Soul Engine.

```
Railway project:
├── Soul Engine (sudah jalan)
├── API Server (sudah jalan)
├── x402 middleware (wrap di atas API Server)
└── Buyback bot (script terpisah, jalan di background)
```

---

## ENVIRONMENT VARIABLES

```env
# Treasury
HARUKA_TREASURY_WALLET=public_key
HARUKA_TREASURY_PRIVATE_KEY=private_key

# x402
X402_PRICE_PER_CALL=0.001
X402_CURRENCY=USDC
X402_NETWORK=solana

# Jupiter (untuk buyback)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
HARUKA_TOKEN_MINT=9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump

# Buyback interval (milliseconds)
BUYBACK_INTERVAL=300000
```

---

## TESTING CHECKLIST

- [ ] Treasury wallet created dan funded dengan sedikit SOL untuk gas
- [ ] x402 middleware terpasang di endpoint /chat
- [ ] Request tanpa payment → return 402
- [ ] Request dengan payment valid → return response Haruka
- [ ] Payment USDC masuk ke treasury wallet
- [ ] Buyback bot detect USDC masuk
- [ ] Buyback bot swap USDC → $HARUKA via Jupiter
- [ ] $HARUKA di-burn setelah buyback
- [ ] Semua transaksi visible on-chain
