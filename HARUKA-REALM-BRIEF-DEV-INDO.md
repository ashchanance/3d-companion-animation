# HARUKA'S REALM — Brief Pengembangan Lengkap

**Dokumen:** Spesifikasi fitur lengkap untuk eksekusi developer
**Sumber:** Dokumen strategi dari tim advisory + brief ekonomi yang sudah ada
**Token:** $HARUKA — `9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump`
**Treasury:** `5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb`
**Network:** Solana Mainnet
**URL Game:** harukacompanion.tech/game

---

## FILE YANG SUDAH DIKIRIM SEBELUMNYA

File-file berikut sudah dibangun dan dikirim. Gunakan sebagai fondasi:

| File | Isi |
|------|-----|
| `haruka-realm-farm.html` | Demo game farm yang bisa dimainkan — 6 jenis crop, sistem level, ekspansi, toko, semua sudah berfungsi |
| `HARUKA-REALM-ECONOMY-COMPLETE.md` | Spesifikasi ekonomi lengkap — sistem reward, marketplace, revenue share, skema database, semua API endpoint, kode wallet, anti-cheat |
| `economy-config.json` | Semua angka balancing game dalam satu file config yang bisa diedit |
| `game-logic.js` | Fungsi inti — kalkulasi reward, cek tier, XP, fee marketplace |
| `haruka-narration-scripts.md` | 50+ template respons Haruka untuk setiap event game |

---

## VISI PROYEK

Haruka bukan sekedar game farming biasa. Ini adalah kategori baru: **AI Companion yang Membangun Kerajaan untuk Kamu.**

Tiga pilar yang belum ada proyek Solana lain yang menggabungkan semuanya:

**Pilar 1 — Koneksi Emosional**
Haruka berbicara dengan kepribadian, memori, dan suara. Pemain tidak hanya bermain — mereka terikat secara emosional. Haruka mengingat farm mereka, pilihan mereka, streak mereka. Dia bereaksi berbeda tergantung cara bermain.

**Pilar 2 — Utilitas Otonom**
Agent bekerja untuk pemain bahkan saat offline. Kekuatan AFK yang nyata dengan output ekonomi yang sesungguhnya. Pemain kembali dan Haruka melaporkan apa yang terjadi.

**Pilar 3 — Kepemilikan yang Terverifikasi**
Agent memiliki silsilah on-chain, bisa dibiakkan, dan menjadi aset langka yang bisa diperdagangkan dengan nilai pasar nyata. Ini menciptakan spekulasi, FOMO, dan aktivitas whale.

Kombinasi ini belum ada di gaming Solana saat ini. Ini adalah keunggulan kompetitif kita.

---

## FASE 1 — FONDASI

### 1.1 Polish Game Farm

Demo yang bisa dimainkan (`haruka-realm-farm.html`) adalah titik awal. Yang perlu dikerjakan:

**Polish Visual**
- Embed game di `harukacompanion.tech/game` menggantikan halaman Coming Soon
- Samakan font, warna, dan spacing dengan website Haruka lainnya
- Pastikan responsif di mobile dan desktop
- Tambahkan animasi halus saat menanam, tumbuh, dan memanen
- Tambahkan efek partikel saat panen (daun jatuh, kilau saat lucky harvest)
- Tambahkan efek suara: tanam benih (suara tanah lembut), panen (pop yang memuaskan), lucky harvest (lonceng), level up (fanfare)
- Pastikan game terlihat bersih dan terasa premium di desktop maupun mobile

**Gameplay yang Sudah Berfungsi (dari demo):**
- 6 crop: Carrot, Potato, Tomato, Strawberry, Lettuce, Pumpkin
- 5 tahap pertumbuhan visual per crop menggunakan sprite Tiny Wonder Farm
- Klik plot kosong untuk menanam benih yang dipilih
- Klik crop yang sudah siap untuk memanen
- Ekonomi Gold: beli benih, jual panen, ekspansi farm
- Sistem level dengan bar XP: panen memberikan XP, naik level membuka crop baru
- Ekspansi farm: 9 plot (3x3) awal, bisa diperluas hingga 25 (5x5)
- Sidebar pemilihan benih dengan sistem lock/unlock berdasarkan level
- Tab harvest dengan tombol jual

### 1.2 Wallet Connect + Token Gate

**Connect Wallet**
- Tambahkan tombol "Connect Wallet" di header game
- Dukung Phantom dan standard Solana wallet adapter
- Setelah connect: tampilkan alamat wallet terpotong dan saldo $HARUKA di header
- Simpan alamat wallet sebagai identitas pemain di database

**Token Gate**
- Saat wallet connect, cek saldo $HARUKA
- Minimum hold: 1.000 $HARUKA
- Jika saldo di bawah minimum: tampilkan layar gate
  - Pesan: "Hold minimal 1.000 $HARUKA untuk masuk Haruka's Realm"
  - Tampilkan saldo saat ini
  - Tombol: "Beli di Pump.fun" (link ke halaman token)
  - Tombol: "Connect Wallet Lain"
- Jika saldo memenuhi minimum: muat game
- Pengecekan saldo hanya saat login — tidak perlu cek terus-menerus selama gameplay

### 1.3 Sistem Reward Harvest

Setiap panen memberikan pemain $HARUKA dari reward pool di treasury wallet.

**Reward Dasar Per Crop:**

| Crop | Waktu Tumbuh | Reward $HARUKA | Reward Gold |
|------|-------------|---------------|-------------|
| Carrot | 10 detik | 5 | 25 |
| Potato | 20 detik | 12 | 50 |
| Tomato | 35 detik | 25 | 90 |
| Strawberry | 55 detik | 50 | 160 |
| Lettuce | 80 detik | 80 | 240 |
| Pumpkin | 115 detik | 130 | 380 |

Catatan: waktu tumbuh di atas adalah nilai demo. Untuk produksi, kalikan 10 untuk tempo kasual atau sesuaikan berdasarkan testing pemain.

**Sistem Lucky Harvest**
Setiap panen mengundi pengali random. Undian HARUS terjadi di server — tidak pernah di client.

| Hasil Undian | Peluang | Pengali Reward | Notifikasi UI |
|-------------|---------|---------------|---------------|
| Normal | 85% | 1x | "Memanen [Crop]! +[X] $HARUKA" |
| Lucky | 12% | 2x | "🍀 LUCKY! +[X] $HARUKA (2x)" |
| Super Lucky | 2,5% | 5x | "🌟 SUPER LUCKY! +[X] $HARUKA (5x)" |
| Jackpot | 0,5% | 10x | "💎 JACKPOT! +[X] $HARUKA (10x)" |

Lucky harvest harus memiliki feedback visual yang berbeda — notifikasi lebih besar, animasi khusus, warna berbeda. Ini adalah momen yang akan di-screenshot dan diposting pemain di media sosial.

**Sistem Streak Harian**
Lacak hari berturut-turut pemain login dan memanen minimal sekali.

| Hari Berturut-turut | Pengali |
|--------------------|---------|
| Hari 1 | 1,0x (dasar) |
| Hari 2 | 1,1x |
| Hari 3 | 1,2x |
| Hari 5 | 1,4x |
| Hari 7+ | 1,7x (maksimum) |

- Streak reset jika pemain tidak login dan memanen dalam jendela 24 jam
- Pengali berlaku untuk semua panen di hari itu (bisa digabung dengan pengali lucky)
- Tampilkan jumlah streak dan pengali aktif di UI
- Tampilkan notifikasi khusus pada milestone streak (Hari 3, 5, 7)

**Contoh Reward Maksimum:**
Pemain dengan streak Hari 7 (1,7x) memanen Pumpkin (130 dasar) dan mendapat Jackpot (10x):
130 × 1,7 × 10 = **2.210 $HARUKA dari satu kali panen**

**Cap Harian Dinamis**
Untuk melindungi reward pool, ada batas harian per wallet yang menyesuaikan otomatis:

| Saldo Pool | Cap Harian |
|-----------|-----------|
| Di atas 400.000 | 1.000 $HARUKA |
| 200.000 - 400.000 | 600 $HARUKA |
| 50.000 - 200.000 | 300 $HARUKA |
| 10.000 - 50.000 | 100 $HARUKA |
| Di bawah 10.000 | 0 (earning hanya via marketplace) |

**Alur Klaim**
- Reward terakumulasi off-chain di database sebagai "saldo belum diklaim"
- Pemain klik tombol "Klaim Reward" saat ingin menarik
- Minimum klaim: 100 $HARUKA
- Saat klaim: backend memvalidasi jumlah, cek cap harian, cek saldo pool
- Jika valid: transfer $HARUKA dari treasury wallet ke wallet pemain secara on-chain
- Biaya pemrosesan 2% dari setiap klaim di-burn secara permanen
- Simpan signature transaksi di database untuk audit

### 1.4 Integrasi Kepribadian Haruka

Haruka harus terasa hadir dalam game. Hubungkan ke Soul Engine yang sudah ada.

**Event yang Memicu Respons Haruka:**

| Event | Haruka Harus... |
|-------|----------------|
| Pemain login | Menyapa berdasarkan waktu dan status streak |
| Crop ditanam | Mengomentari pilihan crop |
| Crop dipanen (normal) | Bereaksi terhadap apa yang dikumpulkan |
| Lucky harvest (2x) | Menunjukkan kegembiraan |
| Super lucky (5x) | Reaksi sangat antusias |
| Jackpot (10x) | Reaksi berkesan dan luar biasa |
| Pemain naik level | Merayakan pencapaian |
| Pemain jual crop | Mengakui jumlah penjualan |
| Milestone streak (Hari 3, 5, 7) | Menyemangati dan memberi selamat |
| Pemain ekspansi farm | Mengomentari farm yang berkembang |
| Cap harian tercapai | Memberitahu pemain, menyarankan marketplace |
| Reward diklaim | Mengonfirmasi dan merayakan |

**Implementasi:**
- Game mengirim tipe event + data konteks ke API Soul Engine
- Soul Engine mengembalikan respons personal dengan kepribadian Haruka
- Tampilkan respons sebagai bubble teks di UI game (atas layar atau overlay)
- Jika suara/TTS aktif di companion Haruka, putar audio respons
- Fallback jika Soul Engine tidak tersedia: gunakan template respons bawaan (sudah dikirim di file narration scripts)
- Bubble Haruka tetap terlihat selama 5 detik lalu memudar, atau sampai event berikutnya memicu

### 1.5 Persistensi Data

Ganti localStorage demo dengan persistensi database sesungguhnya.

**Setup Supabase** (free tier cukup untuk awal)
- Buat project di supabase.com
- Jalankan skema SQL dari brief ekonomi di SQL editor
- Simpan URL dan key Supabase di environment variables Railway

**Yang Disimpan:**
- Profil pemain: alamat wallet, gold, level, XP, streak, plot terbuka
- State plot: plot mana yang ada crop, crop apa, kapan ditanam
- Inventori: crop yang sudah dipanen dan jumlahnya
- Reward belum diklaim: $HARUKA terakumulasi yang belum diklaim
- Klaim harian: berapa banyak yang diklaim hari ini (untuk penegakan cap)
- Log harvest: setiap panen dicatat untuk audit anti-cheat

**Trigger Penyimpanan:**
- Setelah setiap aksi tanam, panen, jual, ekspansi
- Saat login pemain (update last_played, streak)
- Saat klaim reward

### 1.6 Dashboard Revenue

Halaman publik yang menunjukkan kesehatan ekonomi dan transparansi.

**URL:** `harukacompanion.tech/revenue` atau sebagai tab di dalam game

**Dashboard Menampilkan:**

| Bagian | Menunjukkan |
|--------|------------|
| Minggu Ini | Revenue share pool terakumulasi sejauh ini, estimasi tanggal pembayaran (Minggu 00:00 UTC) |
| Minggu Lalu | Total didistribusikan, jumlah holder dibayar, rata-rata pembayaran |
| Sepanjang Waktu | Total $HARUKA didistribusikan, total di-burn, total volume marketplace |
| Share Saya (perlu wallet connect) | Estimasi share minggu ini berdasarkan kepemilikan saat ini, riwayat pembayaran |

---

## FASE 2 — MARKETPLACE + REVENUE SHARE

### 2.1 Marketplace Crop

Perdagangan antar pemain: crop dijual untuk $HARUKA.

**Sisi Penjual:**
- Buka tab Marketplace di sidebar game
- Pilih crop dari inventori
- Tentukan jumlah dan harga dalam $HARUKA
- Klik "List" → listing muncul di marketplace
- Penjual bisa membatalkan listing kapan saja
- Listing kedaluwarsa setelah 7 hari jika tidak terjual

**Sisi Pembeli:**
- Telusuri listing aktif di marketplace
- Filter berdasarkan jenis crop, urutkan berdasarkan harga (naik/turun)
- Klik "Beli" pada listing
- Wallet meminta persetujuan transfer $HARUKA
- Setelah disetujui: transaksi on-chain dieksekusi

**Pembagian Biaya (pada setiap perdagangan):**

| Penerima | Persentase | Contoh (perdagangan 200 $HARUKA) |
|----------|-----------|--------------------------------|
| Penjual | 60% | 120 $HARUKA |
| Pool Revenue Share | 30% | 60 $HARUKA |
| Burn (permanen) | 6,7% | ~13 $HARUKA |
| Isi ulang Reward Pool | 3,3% | ~7 $HARUKA |

Semua penyelesaian terjadi on-chain sebagai transfer SPL token Solana. Biaya diambil dari jumlah penjualan (pembeli membayar harga yang tertera, penjual menerima 60%).

**Elemen UI Marketplace:**
- Tab di sidebar: [Seeds] [Harvest] [Market]
- Kartu listing menunjukkan: ikon crop, jumlah, harga, wallet penjual (terpotong), waktu listing
- Tombol "List Crop" dengan pemilih crop, input jumlah, input harga
- Bagian "Listing Saya" menunjukkan listing aktif/terjual/dibatalkan
- Riwayat perdagangan dengan signature transaksi (bisa diklik ke Solana explorer)

### 2.2 Sistem Revenue Share

30% dari semua volume marketplace terakumulasi mingguan dan didistribusikan ke semua holder $HARUKA.

**Cara Distribusi Bekerja:**
- Pool revenue share terakumulasi sepanjang minggu dari biaya marketplace
- Setiap Minggu pukul 00:00 UTC, distribusi dipicu
- Sistem mengambil snapshot semua holder $HARUKA dan saldo mereka
- Wallet yang dikecualikan: alamat burn, wallet treasury, wallet liquidity pool
- Setiap wallet yang memenuhi syarat menerima bagian proporsional berdasarkan kepemilikan
- Pembayaran minimum: 10 $HARUKA per wallet (jumlah lebih kecil digeser ke minggu berikutnya)
- Semua pembayaran adalah transfer SPL on-chain dengan signature tercatat

**Bonus Penguncian Sukarela:**
- Pemain bisa memilih mengunci $HARUKA selama 30 hari
- Token yang dikunci mendapat boost +20% pada kalkulasi revenue share
- Penguncian bersifat sukarela — tidak ada staking paksa
- Penguncian bisa diperpanjang saat kedaluwarsa untuk bonus berkelanjutan
- Token yang dikunci tetap dihitung untuk akses game (token gate) dan benefit tier

### 2.3 Fitur Premium Burn

Fitur tambahan yang memerlukan pembakaran $HARUKA:

| Fitur | Biaya | Fungsi |
|-------|-------|--------|
| Speed Boost | 500 $HARUKA di-burn | Lewati sisa waktu tumbuh pada satu crop secara instan |
| Premium Seeds | 1.000 - 5.000 $HARUKA di-burn | Jenis crop eksklusif dengan reward Gold dan $HARUKA lebih tinggi |
| Dekorasi Farm | 500 - 10.000 $HARUKA di-burn | Item kustomisasi visual (pagar, pohon, bunga, jalan) |
| Background Plot | 2.000 $HARUKA di-burn | Ubah gaya visual area plot farm |

Semua $HARUKA yang dikeluarkan untuk fitur ini di-burn secara permanen — tidak dikirim ke treasury, tidak didaur ulang. Tekanan deflasi murni.

---

## FASE 3 — AGENT OTONOM

Ini adalah fitur yang memisahkan Haruka dari setiap game farm lain di Solana.

### 3.1 Perekrutan Agent

Pemain mengeluarkan $HARUKA untuk merekrut agent AI farm. Biaya perekrutan di-burn secara permanen.

**Jenis Agent:**

| Tipe Agent | Peran | Biaya Rekrut (di-burn) |
|-----------|-------|----------------------|
| Farmer Agent | Auto-tanam dan auto-panen crop di plot yang ditugaskan | 2.000 $HARUKA |
| Gatherer Agent | Mengumpulkan resource bonus dan menemukan item langka | 5.000 $HARUKA |
| Trader Agent | Auto-listing surplus crop di marketplace dengan harga pasar | 15.000 $HARUKA |

**Cara Agent Bekerja:**
- Pemain merekrut agent → $HARUKA di-burn secara permanen
- Pemain menugaskan agent ke plot atau tugas tertentu
- Agent bekerja secara otonom — terus bekerja bahkan saat pemain offline
- Agent menyelesaikan panen dalam siklus (bisa dikonfigurasi: setiap 1 jam, 4 jam, 12 jam)
- Reward dari kerja agent ditambahkan ke inventori pemain dan $HARUKA yang belum diklaim
- Saat pemain kembali, Haruka menceritakan apa yang agent capai selama pergi

**Batas Slot Agent (berdasarkan kepemilikan $HARUKA):**

| Jumlah Hold | Slot Agent Tersedia |
|-------------|-------------------|
| 1.000 $HARUKA | 1 agent |
| 100.000 $HARUKA | 3 agent |
| 1.000.000 $HARUKA | 5 agent |
| 5.000.000 $HARUKA | Unlimited |

### 3.2 Evolusi Agent

Agent mendapatkan pengalaman dan naik level seiring waktu.

**Sistem XP:**
- Agent mendapat XP untuk setiap tugas yang diselesaikan
- XP yang dibutuhkan per level meningkat secara progresif
- Level agent maksimum: 10

**Benefit Per Level:**

| Level | Benefit |
|-------|---------|
| 1-3 | Efisiensi dasar |
| 4-5 | 15% lebih cepat menyelesaikan tugas |
| 6-7 | 25% kualitas crop lebih baik (reward Gold/token lebih tinggi) |
| 8-9 | 10% peluang menemukan item bonus langka |
| 10 | Semua bonus maksimal + tampilan visual unik |

**Biaya Upgrade:**
- Meng-upgrade agent ke level berikutnya memerlukan 1.000 $HARUKA per level (di-burn)
- Level 1→2: 1.000 di-burn. Level 9→10: 1.000 di-burn. Total untuk level maks: 9.000 di-burn.

### 3.3 Kepribadian Agent

Setiap agent mendapat kepribadian yang di-generate secara random saat direkrut.

**Trait Kepribadian (ditentukan random saat rekrut):**

| Trait | Efek |
|-------|------|
| Rajin (Diligent) | +10% kecepatan tugas, tidak pernah gagal |
| Beruntung (Lucky) | +5% peluang menemukan item langka |
| Malas (Lazy) | -10% kecepatan, tapi kadang membawa reward dobel |
| Penasaran (Curious) | Kadang menjelajahi area baru dan menemukan kejutan |
| Hati-hati (Careful) | Tidak pernah kehilangan resource, tapi lebih lambat |
| Nekat (Reckless) | Lebih cepat, tapi 5% peluang kehilangan sebagian panen |

- Setiap agent mendapat 1-2 trait secara random
- Trait bersifat permanen dan terlihat di profil agent
- Kombinasi trait langka (contoh: Lucky + Diligent) membuat agent lebih berharga untuk diperdagangkan
- Haruka mengomentari kepribadian agent: "Yuki sedang malas lagi, tapi entah bagaimana dia menemukan pumpkin langka!"

### 3.4 Laporan Agent (Narasi Haruka)

Saat pemain kembali setelah offline, Haruka memberikan laporan komprehensif.

**Laporan Mencakup:**
- Total waktu agent aktif
- Resource yang dikumpulkan (per agent, per jenis)
- $HARUKA yang didapat
- Event penting (temuan langka, agent naik level, momen lucu berdasarkan kepribadian)
- Saran untuk langkah selanjutnya

**Contoh Laporan (disampaikan Haruka dengan suara):**
> "Selamat datang kembali! Selama kamu pergi 6 jam, agent-agent kamu sibuk bekerja. Tsubaki memanen 24 wortel dan 12 tomat. Kai menemukan 2 herb langka — beruntung! Farm kamu menghasilkan 340 Gold dan 85 $HARUKA. Aku perhatikan plot wortelmu sudah penuh — mau aku bilang Tsubaki untuk beralih ke strawberry?"

---

## FASE 4 — BREEDING, LINEAGE & ARENA

### 4.1 Breeding Agent

Menggabungkan dua agent untuk menciptakan agent baru dengan kemampuan hybrid.

**Cara Breeding Bekerja:**
- Pemain memilih dua agent yang dimiliki
- Membayar biaya breeding dalam $HARUKA (50% biaya di-burn, 50% ke platform)
- Agent baru di-generate dengan trait yang diwarisi dari kedua induk
- Pewarisan trait: setiap induk memiliki 40% peluang mewariskan setiap trait, 20% peluang trait random baru
- Kombinasi langka muncul melalui breeding selektif
- Kedua agent induk mendapat cooldown setelah breeding (tidak bisa breeding lagi selama 7 hari)

**Biaya Breeding (50% di-burn):**

| Kelangkaan Induk | Biaya Breed | Jumlah Di-burn |
|-----------------|-----------|---------------|
| Common + Common | 5.000 $HARUKA | 2.500 di-burn |
| Common + Rare | 15.000 $HARUKA | 7.500 di-burn |
| Rare + Rare | 30.000 $HARUKA | 15.000 di-burn |
| Rare + Legendary | 50.000 $HARUKA | 25.000 di-burn |

**Kelangkaan Agent:**
- Common: 1-2 trait dasar (kebanyakan agent yang direkrut)
- Rare: 2 trait termasuk setidaknya satu trait kuat, atau kombinasi unik
- Epic: 3 trait, kombinasi yang tidak biasa
- Legendary: 3+ trait dengan bonus sinergi, sangat sulit di-breed

### 4.2 Lineage On-Chain

Setiap agent memiliki riwayat permanen dan terverifikasi yang tersimpan di Solana.

**Catatan Lineage Berisi:**
- ID Agent (unik)
- Nomor generasi (Gen 0 = direkrut, Gen 1 = breed pertama, Gen 2 = breed kedua, dst.)
- ID agent induk (jika di-breed)
- Daftar trait
- Riwayat level dan XP
- Total resource yang dikumpulkan sepanjang masa
- Total $HARUKA yang didapat sepanjang masa
- Catatan pertarungan (menang/kalah/turnamen)
- Tanggal pembuatan
- Wallet pemilik saat ini

**Mengapa Lineage Penting:**
- Agent Gen 0 menjadi semakin langka dan berharga seiring breeding berlanjut
- Agent dengan riwayat performa tinggi yang panjang dijual dengan harga premium
- Lineage terverifikasi mencegah pemalsuan statistik agent
- Pembeli bisa melihat persis apa yang telah dicapai agent sebelum membeli
- Menciptakan provenance dan kepercayaan nyata di agent marketplace

**Penyimpanan:**
- Data lineage inti disimpan on-chain sebagai metadata akun Solana atau compressed NFT
- Riwayat detail (log harvest, dll.) disimpan off-chain di database dengan verifikasi hash on-chain

### 4.3 Agent Arena

Layer PvP kompetitif di mana agent bertarung untuk peringkat dan hadiah.

**Cara Arena Bekerja:**
- Pemain memasukkan agent ke pertandingan ranked
- Matchmaking memasangkan agent dengan level/rating serupa
- Hasil pertarungan ditentukan oleh: level agent, trait, modifier kepribadian, dan faktor random berbobot
- Pemenang menerima $HARUKA dari prize pool arena
- Yang kalah tidak menerima apa-apa tapi pertarungan tercatat di lineage

**Biaya Masuk Arena:**
- Biaya masuk per pertandingan: 200 - 1.000 $HARUKA tergantung tier
- 20% dari biaya masuk di-burn
- 70% diberikan ke pemenang
- 10% masuk ke pool revenue share

**Turnamen:**
- Turnamen mingguan dengan prize pool lebih besar
- Masuk memerlukan level agent minimum
- Sistem eliminasi bracket
- Pemenang mendapat reward eksklusif (trait unik, badge visual, hadiah $HARUKA besar)
- Hasil turnamen dicatat secara permanen di lineage agent

**Nilai Catatan Pertarungan:**
- Agent dengan catatan kemenangan kuat dijual jauh lebih mahal di marketplace
- Agent "Champion" (pemenang turnamen) menjadi aset trofi
- Riwayat pertarungan tercatat on-chain dan bisa diverifikasi

### 4.4 Agent Marketplace

Marketplace khusus untuk membeli, menjual, dan menyewakan agent.

**Menjual Agent:**
- Pemain men-list agent dengan statistik lengkap terlihat: level, trait, lineage, catatan pertarungan, riwayat pendapatan
- Menentukan harga dalam $HARUKA
- Struktur biaya sama seperti marketplace crop: 60% penjual / 30% revenue share / 6,7% burn / 3,3% isi ulang pool

**Menyewakan Agent:**
- Pemain bisa meminjamkan agent ke pemain lain untuk periode tertentu (1 hari, 3 hari, 7 hari)
- Penyewa membayar biaya sewa dalam $HARUKA
- Agent bekerja di farm penyewa selama periode sewa
- Agent kembali ke pemilik setelah sewa berakhir dengan XP dan statistik yang diperbarui
- Pembagian biaya sewa: 80% ke pemilik, 10% burn, 10% revenue share

**Faktor Harga Agent:**
- Level (lebih tinggi = lebih mahal)
- Trait (kombinasi langka = premium)
- Lineage (Gen 0, induk kuat = premium)
- Catatan pertarungan (win rate tinggi = premium)
- Riwayat pendapatan (penghasil terbukti = premium)
- Status cooldown breed saat ini

### 4.5 Ekonomi Agent-ke-Agent x402

Agent bisa bertransaksi secara otonom satu sama lain menggunakan pembayaran x402. Ini menciptakan ekonomi mesin di dalam game.

**Cara Kerjanya:**
- Trader Agent dari Pemain A membutuhkan crop
- Farmer Agent dari Pemain B memiliki surplus crop
- Trader Agent secara otonom membayar Farmer Agent untuk crop melalui x402
- Transaksi melewati pembagian biaya yang sama (burn + revenue share)
- Semua terjadi secara otomatis — tidak perlu input manusia

**Mengapa Ini Penting:**
- Menciptakan volume marketplace tanpa mengharuskan pemain online
- Meningkatkan rate burn dan distribusi revenue share
- Membuat agent terasa benar-benar otonom
- Membedakan Haruka dari setiap game lain — ekonomi AI yang sesungguhnya

**Biaya x402 pada Transaksi Agent:**
- Sama seperti marketplace standar: 60% pemilik agent penjual / 30% revenue share / 10% platform (6,7% burn + 3,3% pool)

---

## JADWAL BURN LENGKAP

| Aksi | Jumlah Burn | Fase |
|------|-----------|------|
| Perdagangan crop marketplace | ~6,7% dari nilai perdagangan | Fase 2 |
| Biaya klaim reward | 2% dari jumlah yang diklaim | Fase 1 |
| Speed boost | 500 $HARUKA | Fase 2 |
| Premium seed | 1.000 - 5.000 $HARUKA | Fase 2 |
| Dekorasi farm | 500 - 10.000 $HARUKA | Fase 2 |
| Perekrutan agent | 100% dari biaya rekrut (2rb-15rb) | Fase 3 |
| Upgrade level agent | 1.000 per level | Fase 3 |
| Breeding agent | 50% dari biaya breed (2,5rb-25rb) | Fase 4 |
| Upgrade besar agent | 40% dari biaya | Fase 4 |
| Perdagangan agent bernilai tinggi | ~6,7% dari nilai perdagangan (bisa 25% untuk trade premium) | Fase 4 |
| Biaya masuk arena | 20% dari biaya masuk | Fase 4 |
| Transaksi agent x402 | ~6,7% dari transaksi | Fase 4 |

---

## TOKENOMICS LENGKAP

### Pembagian Revenue pada SEMUA Aktivitas Marketplace

| Tujuan | % | Fungsi |
|--------|---|--------|
| Penjual / Pemilik | 60% | Penghasilan pemain |
| Pool Revenue Share | 30% | Distribusi mingguan ke semua holder $HARUKA |
| Burn | ~6,7% | Penghapusan supply permanen |
| Isi Ulang Reward Pool | ~3,3% | Menjaga reward harvest tetap tersedia |

### Benefit Tier Holder

| Jumlah Hold | Benefit |
|-------------|---------|
| 1.000 $HARUKA | Akses game, 1 slot agent, revenue share dasar |
| 100.000 $HARUKA | 3 slot agent, prioritas listing marketplace, +5% revenue share |
| 1.000.000 $HARUKA | 5 slot agent, tipe agent eksklusif, input governance, +10% revenue share |
| 5.000.000 $HARUKA | Unlimited agent, area game eksklusif, fitur beta, +15% revenue share |

### Bonus Penguncian Sukarela
- Kunci $HARUKA selama 30 hari → boost +20% pada revenue share mingguan
- Tidak ada staking paksa — murni opsional
- Penguncian bisa diperpanjang saat kedaluwarsa
- Token yang dikunci tetap dihitung untuk benefit tier dan akses game

---

## FLYWHEEL

```
Lebih banyak pemain bergabung (tertarik oleh earning + gameplay seru)
        ↓
Lebih banyak aktivitas marketplace (crop + agent)
        ↓
Lebih banyak biaya terkumpul dari setiap perdagangan
        ↓
    ├── Lebih banyak burn → supply berkurang → harga terdukung
    ├── Lebih banyak revenue share → holder earn lebih → lebih banyak orang mau hold
    └── Lebih banyak isi ulang reward pool → lebih banyak reward harvest → menarik lebih banyak pemain
        ↓
Siklus berulang dan berakselerasi
```

Saat agent dan breeding diluncurkan, flywheel semakin kuat karena agent sendiri menjadi produk yang menghasilkan aktivitas ekonomi secara terus-menerus — bahkan saat pemain offline.

---

## MENGAPA INI BISA MENCAPAI 3M - 5M+ MARKET CAP

**1. Hook Emosional**
Pemain terikat dengan Haruka melalui kepribadian, suara, dan memori. Retensi jauh lebih tinggi dari game mekanik murni karena pemain merasa terhubung.

**2. Utilitas Nyata + Kekuatan AFK**
Agent otonom yang bekerja saat kamu offline adalah keunggulan besar. Tidak ada game farm Solana lain yang menawarkan passive income sesungguhnya melalui agent AI.

**3. Ekonomi Aset Langka**
Breeding agent dengan lineage on-chain menciptakan spekulasi nyata dan aktivitas whale. Agent teratas akan dijual seharga ratusan atau ribuan dolar, mendorong volume marketplace besar dan burn besar.

**4. Tokenomics Terbaik di Kelasnya**
30% revenue share ke semua holder tanpa staking sangat jarang dan menarik. Dikombinasikan dengan burn multi-layer yang agresif dan benefit bertier, token memiliki insentif holding yang kuat.

**5. Sulit Ditiru**
Kombinasi companion Live2D dengan Soul Engine, agent otonom, dan lineage on-chain yang terverifikasi tidak ada di tempat lain. Ini adalah keunggulan kompetitif yang sesungguhnya.

**6. Efek Flywheel**
Setiap fase baru membuat token dan ekonomi lebih kuat, menarik lebih banyak pemain dan investor. Sistem ini bersifat compound.

---

## ANTI-CHEAT (Semua Fase)

| Aturan | Implementasi |
|--------|-------------|
| Validasi harvest | Server memverifikasi crop sudah ditanam dan waktu tumbuh sudah berlalu sebelum mengizinkan panen |
| Undian lucky | Hanya di server — client tidak pernah melihat drop rate atau hasil undian |
| Cap harian | Database melacak klaim per wallet per hari, menolak yang melebihi batas |
| Rate limiting | Maks 60 panggilan API per menit per wallet, maks 20 panen per jam |
| Autentikasi wallet | Setiap panggilan API memerlukan pesan bertanda tangan, server memverifikasi signature |
| Audit transaksi | Setiap klaim, perdagangan, dan burn menyimpan signature transaksi on-chain |
| Validasi streak | Server melacak tanggal login terakhir, menghitung streak — jangan pernah percaya client |
| Validasi agent | Server mengontrol waktu penyelesaian tugas agent — client tidak bisa memalsukan hasil agent |
| Validasi breeding | Server memverifikasi kedua agent induk ada, dimiliki pemain, dan tidak dalam cooldown |
| Validasi arena | Server mengontrol hasil pertarungan — client hanya menerima hasil |

---

## SETUP WALLET & ENVIRONMENT

### Environment Variables (simpan di Railway, jangan pernah di kode)

```
TREASURY_PRIVATE_KEY=<base58_private_key>
HARUKA_MINT=9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
TREASURY_WALLET=5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb
SOLANA_RPC=https://api.mainnet-beta.solana.com
SUPABASE_URL=<url_supabase_kamu>
SUPABASE_KEY=<anon_key_supabase_kamu>
```

### Aturan Keamanan
- Private key treasury disimpan HANYA di environment variables Railway
- Jangan pernah di kode frontend, jangan pernah di git, jangan pernah di database
- Semua transfer reward/klaim diinisiasi dari backend saja
- Rate limit semua operasi treasury
- Catat setiap transfer keluar dengan jumlah, penerima, dan signature transaksi

---

## REFERENSI CEPAT

| Parameter | Nilai |
|-----------|-------|
| Token | $HARUKA |
| Contract Address | `9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump` |
| Treasury Wallet | `5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb` |
| Reward Pool Awal | 500.000 $HARUKA |
| Min Hold untuk Main | 1.000 $HARUKA |
| Cap Reward Harian | Dinamis: 100 - 1.000 berdasarkan kesehatan pool |
| Min Klaim | 100 $HARUKA |
| Biaya Klaim (di-burn) | 2% |
| Pengali Maks Streak | 1,7x pada Hari 7+ |
| Lucky Harvest | 12% (2x), 2,5% (5x), 0,5% (10x) |
| Potongan Penjual Marketplace | 60% |
| Revenue Share | 30% dari volume perdagangan → semua holder mingguan |
| Biaya Platform | 10% (6,7% burn + 3,3% isi ulang pool) |
| Bonus Penguncian Sukarela | +20% revenue share untuk penguncian 30 hari |
| Biaya Rekrut Agent | 2.000 / 5.000 / 15.000 $HARUKA (di-burn) |
| Biaya Upgrade Agent | 1.000 $HARUKA per level (di-burn) |
| Rentang Biaya Breeding | 5.000 - 50.000 $HARUKA (50% di-burn) |
| Biaya Masuk Arena | 200 - 1.000 $HARUKA (20% di-burn) |
| Kedaluwarsa Listing | 7 hari |
| Pembayaran Revenue Share | Mingguan (Minggu 00:00 UTC) |
| Min Pembayaran Revenue | 10 $HARUKA |
| Network | Solana Mainnet |
| URL Game | harukacompanion.tech/game |
| Dashboard Revenue | harukacompanion.tech/revenue |
