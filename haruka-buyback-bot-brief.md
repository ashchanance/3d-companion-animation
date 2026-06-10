# HARUKA — Buyback & Burn Bot (Developer Brief)

---

## OVERVIEW

Script yang jalan terus di background, monitor treasury wallet,
dan setiap kali USDC masuk — otomatis swap ke $HARUKA via Jupiter
lalu burn. 100% dari API revenue. Tidak ada yang tersisa di treasury.

---

## FLOW

```
x402 API payment masuk (USDC)
↓
USDC land di HARUKA treasury wallet
↓
Buyback bot detect: "ada USDC baru masuk"
↓
Bot swap USDC → $HARUKA via Jupiter DEX
↓
Bot kirim $HARUKA ke burn address
↓
Supply berkurang permanen
↓
Transaksi visible on-chain oleh siapapun
```

---

## ADDRESSES

```
HARUKA Treasury Wallet : [TREASURY_PUBLIC_KEY]
HARUKA Token Mint      : 9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
USDC Mint (Solana)     : EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
Burn Address           : 1111111111111111111111111111111111111111111
```

---

## DEPENDENCIES

```bash
npm install @solana/web3.js
npm install @solana/spl-token
npm install @jup-ag/api
npm install dotenv
```

Semua gratis. Tidak ada yang berbayar.

---

## ENVIRONMENT VARIABLES

```env
# Treasury wallet
TREASURY_PRIVATE_KEY=your_treasury_private_key_here
TREASURY_PUBLIC_KEY=your_treasury_public_key_here

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Token addresses
HARUKA_MINT=9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# Burn address
BURN_ADDRESS=1111111111111111111111111111111111111111111

# Bot settings
CHECK_INTERVAL=300000          # cek setiap 5 menit (milliseconds)
MIN_BUYBACK_AMOUNT=100000      # minimum 0.10 USDC (6 decimals)
SLIPPAGE_BPS=100               # 1% slippage tolerance
```

---

## FULL CODE

### buyback-bot.js

```javascript
import { 
  Connection, 
  Keypair, 
  PublicKey,
  VersionedTransaction 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  getAccount,
  createBurnInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { createJupiterApiClient } from '@jup-ag/api';
import dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

// ============================================
// CONFIG
// ============================================

const connection = new Connection(process.env.SOLANA_RPC_URL);
const jupiterApi = createJupiterApiClient();

const treasuryKeypair = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_PRIVATE_KEY)
);

const HARUKA_MINT = new PublicKey(process.env.HARUKA_MINT);
const USDC_MINT = new PublicKey(process.env.USDC_MINT);
const BURN_ADDRESS = new PublicKey(process.env.BURN_ADDRESS);

const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 300000;
const MIN_BUYBACK_AMOUNT = parseInt(process.env.MIN_BUYBACK_AMOUNT) || 100000;
const SLIPPAGE_BPS = parseInt(process.env.SLIPPAGE_BPS) || 100;

// ============================================
// STEP 1 — CHECK USDC BALANCE IN TREASURY
// ============================================

async function getUsdcBalance() {
  try {
    const usdcAta = await getAssociatedTokenAddress(
      USDC_MINT,
      treasuryKeypair.publicKey
    );

    const account = await getAccount(connection, usdcAta);
    const balance = Number(account.amount);

    console.log(`[MONITOR] Treasury USDC balance: ${balance / 1_000_000} USDC`);
    return balance;

  } catch (error) {
    // Kalau token account belum ada = balance 0
    if (error.name === 'TokenAccountNotFoundError') {
      console.log('[MONITOR] No USDC token account found. Balance: 0');
      return 0;
    }
    console.error('[MONITOR] Error checking balance:', error.message);
    return 0;
  }
}

// ============================================
// STEP 2 — SWAP USDC → $HARUKA VIA JUPITER
// ============================================

async function swapUsdcToHaruka(usdcAmount) {
  try {
    console.log(`[SWAP] Getting quote: ${usdcAmount / 1_000_000} USDC → $HARUKA`);

    // Get quote
    const quote = await jupiterApi.quoteGet({
      inputMint: USDC_MINT.toString(),
      outputMint: HARUKA_MINT.toString(),
      amount: usdcAmount,
      slippageBps: SLIPPAGE_BPS
    });

    if (!quote || !quote.outAmount) {
      console.error('[SWAP] No quote available');
      return null;
    }

    const harukaAmount = Number(quote.outAmount);
    console.log(`[SWAP] Quote: ${usdcAmount / 1_000_000} USDC = ${harukaAmount} $HARUKA`);

    // Get swap transaction
    const swapResult = await jupiterApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: treasuryKeypair.publicKey.toString(),
        wrapAndUnwrapSol: true
      }
    });

    if (!swapResult || !swapResult.swapTransaction) {
      console.error('[SWAP] Failed to get swap transaction');
      return null;
    }

    // Deserialize transaction
    const swapTransaction = VersionedTransaction.deserialize(
      Buffer.from(swapResult.swapTransaction, 'base64')
    );

    // Sign with treasury wallet
    swapTransaction.sign([treasuryKeypair]);

    // Send transaction
    const txid = await connection.sendRawTransaction(
      swapTransaction.serialize(),
      { skipPreflight: false }
    );

    // Wait for confirmation
    await connection.confirmTransaction(txid, 'confirmed');

    console.log(`[SWAP] Success! TX: ${txid}`);
    console.log(`[SWAP] Swapped ${usdcAmount / 1_000_000} USDC → ${harukaAmount} $HARUKA`);

    return {
      txid,
      usdcAmount,
      harukaAmount
    };

  } catch (error) {
    console.error('[SWAP] Error:', error.message);
    return null;
  }
}

// ============================================
// STEP 3 — BURN $HARUKA
// ============================================

async function burnHaruka() {
  try {
    // Get $HARUKA balance in treasury
    const harukaAta = await getAssociatedTokenAddress(
      HARUKA_MINT,
      treasuryKeypair.publicKey
    );

    const account = await getAccount(connection, harukaAta);
    const harukaBalance = Number(account.amount);

    if (harukaBalance === 0) {
      console.log('[BURN] No $HARUKA to burn');
      return null;
    }

    console.log(`[BURN] Burning ${harukaBalance} $HARUKA`);

    // Create burn instruction
    const burnIx = createBurnInstruction(
      harukaAta,                    // token account to burn from
      HARUKA_MINT,                  // token mint
      treasuryKeypair.publicKey,    // owner
      harukaBalance,                // amount to burn
      [],                           // multisig signers (none)
      TOKEN_PROGRAM_ID
    );

    // Build transaction
    const { blockhash } = await connection.getLatestBlockhash();
    
    const transaction = new (await import('@solana/web3.js')).Transaction();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryKeypair.publicKey;
    transaction.add(burnIx);

    // Sign
    transaction.sign(treasuryKeypair);

    // Send
    const txid = await connection.sendRawTransaction(
      transaction.serialize()
    );

    await connection.confirmTransaction(txid, 'confirmed');

    console.log(`[BURN] Success! Burned ${harukaBalance} $HARUKA`);
    console.log(`[BURN] TX: ${txid}`);

    return {
      txid,
      burnedAmount: harukaBalance
    };

  } catch (error) {
    console.error('[BURN] Error:', error.message);
    return null;
  }
}

// ============================================
// STEP 4 — MAIN LOOP
// ============================================

async function runBuybackCycle() {
  console.log('\n====================================');
  console.log(`[BOT] Buyback cycle started at ${new Date().toISOString()}`);
  console.log('====================================\n');

  // Step 1: Check USDC balance
  const usdcBalance = await getUsdcBalance();

  // Step 2: Check minimum threshold
  if (usdcBalance < MIN_BUYBACK_AMOUNT) {
    console.log(`[BOT] Below minimum (${MIN_BUYBACK_AMOUNT / 1_000_000} USDC). Skipping.`);
    return;
  }

  // Step 3: Swap USDC → $HARUKA
  const swapResult = await swapUsdcToHaruka(usdcBalance);

  if (!swapResult) {
    console.log('[BOT] Swap failed. Will retry next cycle.');
    return;
  }

  // Step 4: Burn $HARUKA
  const burnResult = await burnHaruka();

  if (!burnResult) {
    console.log('[BOT] Burn failed. $HARUKA sitting in treasury. Will retry next cycle.');
    return;
  }

  // Summary
  console.log('\n====================================');
  console.log('[BOT] BUYBACK & BURN COMPLETE');
  console.log(`[BOT] Swapped: ${swapResult.usdcAmount / 1_000_000} USDC`);
  console.log(`[BOT] Burned:  ${burnResult.burnedAmount} $HARUKA`);
  console.log(`[BOT] Swap TX: ${swapResult.txid}`);
  console.log(`[BOT] Burn TX: ${burnResult.txid}`);
  console.log('====================================\n');
}

// ============================================
// STEP 5 — START BOT
// ============================================

async function startBot() {
  console.log('====================================');
  console.log('  HARUKA BUYBACK & BURN BOT');
  console.log('====================================');
  console.log(`Treasury:      ${treasuryKeypair.publicKey.toString()}`);
  console.log(`HARUKA Mint:   ${HARUKA_MINT.toString()}`);
  console.log(`USDC Mint:     ${USDC_MINT.toString()}`);
  console.log(`Check every:   ${CHECK_INTERVAL / 1000} seconds`);
  console.log(`Min buyback:   ${MIN_BUYBACK_AMOUNT / 1_000_000} USDC`);
  console.log(`Slippage:      ${SLIPPAGE_BPS / 100}%`);
  console.log('====================================\n');

  // Run immediately on start
  await runBuybackCycle();

  // Then run on interval
  setInterval(async () => {
    await runBuybackCycle();
  }, CHECK_INTERVAL);
}

// Start
startBot().catch(console.error);
```

---

## DEPLOYMENT

Deploy ke Railway — same instance atau instance terpisah.

```bash
# Di Railway project HARUKA
# Add new service → Deploy from GitHub
# Set environment variables
# Bot jalan otomatis
```

### package.json untuk bot

```json
{
  "name": "haruka-buyback-bot",
  "type": "module",
  "scripts": {
    "start": "node buyback-bot.js"
  },
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "@jup-ag/api": "^6.0.0",
    "dotenv": "^16.0.0",
    "bs58": "^6.0.0"
  }
}
```

---

## SETTINGS YANG PERLU DI-TUNE

### Check Interval
```
5 menit  (300000ms)  — default, cukup untuk awal
1 menit  (60000ms)   — kalau volume sudah tinggi
30 detik (30000ms)   — high frequency, lebih banyak gas fee
```

### Minimum Buyback Amount
```
0.10 USDC (100000)   — default minimum
0.01 USDC (10000)    — lebih agresif tapi gas fee bisa lebih mahal dari amount
1.00 USDC (1000000)  — lebih efisien, tapi burn lebih jarang
```

Rekomendasi: mulai dari 0.10 USDC minimum.
Kalau gas fee Solana sekitar $0.001 per transaction,
maka swap + burn = $0.002 gas.
0.10 USDC minimum artinya 98% masuk ke buyback, 2% gas. Cukup efisien.

### Slippage
```
50 bps  (0.5%)  — tight, bisa gagal kalau liquidity rendah
100 bps (1%)    — default, balanced
200 bps (2%)    — loose, hampir pasti berhasil
```

Rekomendasi: mulai dari 1%.

---

## KEBUTUHAN SOL DI TREASURY

Bot butuh sedikit SOL untuk bayar transaction fees.

```
Per buyback cycle = 2 transactions:
  1. Swap USDC → $HARUKA  (~0.000005 SOL)
  2. Burn $HARUKA          (~0.000005 SOL)
  
Total per cycle: ~0.00001 SOL

Deposit 0.1 SOL ke treasury = cukup untuk ~10,000 cycles
```

Deposit 0.1 SOL sekali saja. Tidak perlu top up sering.

---

## LOGGING & MONITORING

Bot sudah print log setiap cycle. Contoh output:

```
====================================
[BOT] Buyback cycle started at 2026-06-09T10:00:00.000Z
====================================

[MONITOR] Treasury USDC balance: 0.50 USDC
[SWAP] Getting quote: 0.50 USDC → $HARUKA
[SWAP] Quote: 0.50 USDC = 2,250,000 $HARUKA
[SWAP] Success! TX: 4xK9...abc
[BURN] Burning 2,250,000 $HARUKA
[BURN] Success! TX: 7mN2...xyz

====================================
[BOT] BUYBACK & BURN COMPLETE
[BOT] Swapped: 0.50 USDC
[BOT] Burned:  2,250,000 $HARUKA
[BOT] Swap TX: 4xK9...abc
[BOT] Burn TX: 7mN2...xyz
====================================
```

Semua transaksi visible di Solana Explorer.
Siapapun bisa verify on-chain.

---

## SAFETY NOTES

- JANGAN share treasury private key ke siapapun
- Private key hanya ada di .env file dan Railway environment variables
- Bot hanya bisa swap USDC → $HARUKA dan burn — tidak bisa kirim ke wallet lain
- Kalau swap gagal, USDC tetap aman di treasury — retry next cycle
- Kalau burn gagal, $HARUKA tetap di treasury — retry next cycle
- Tidak ada scenario dimana dana hilang

---

## TESTING CHECKLIST

### Sebelum mainnet — test di devnet dulu
- [ ] Treasury wallet funded dengan devnet SOL
- [ ] Treasury wallet funded dengan devnet USDC
- [ ] Bot start tanpa error
- [ ] Bot detect USDC balance correctly
- [ ] Bot skip kalau di bawah minimum
- [ ] Swap USDC → $HARUKA berhasil di devnet
- [ ] Burn $HARUKA berhasil di devnet
- [ ] Log output benar dan readable

### Setelah pindah ke mainnet
- [ ] Treasury wallet funded dengan 0.1 SOL (gas)
- [ ] Environment variables updated ke mainnet
- [ ] RPC URL pointing ke mainnet
- [ ] First real buyback & burn berhasil
- [ ] TX visible di Solana Explorer
- [ ] Share burn TX ke community sebagai proof
