# HARUKA — Camera Interaction (Developer Brief)

---

## OVERVIEW

Tambahkan fitur kamera di HARUKA agar user bisa berinteraksi
face-to-face dengan Haruka. User nyalain kamera, ngomong via mic,
Haruka dengerin dan jawab — terasa kayak video call.

Tidak ada library tambahan. Semua browser native. Gratis.

---

## YANG SUDAH ADA

- Voice input (mic) → sudah jalan
- Voice output (TTS) → sudah jalan
- Live2D karakter Haruka → sudah jalan

---

## YANG PERLU DITAMBAH

Hanya 1 hal: tampilkan webcam user di layar.

---

## IMPLEMENTASI

### Step 1 — Tambah Tombol "Enable Camera"

Tambahkan tombol di samping tombol mic yang sudah ada.

```html
<button id="camera-toggle" onclick="toggleCamera()">
  📷 Camera
</button>
```

---

### Step 2 — Request Webcam Access

```javascript
let cameraStream = null;
let cameraActive = false;

async function toggleCamera() {
  const videoEl = document.getElementById('user-camera');
  
  if (cameraActive) {
    // Matikan kamera
    cameraStream.getTracks().forEach(track => track.stop());
    videoEl.srcObject = null;
    videoEl.style.display = 'none';
    cameraActive = false;
    return;
  }

  try {
    // Minta izin kamera
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: 'user'  // kamera depan
      }
    });

    // Tampilkan video
    videoEl.srcObject = cameraStream;
    videoEl.style.display = 'block';
    cameraActive = true;

  } catch (error) {
    console.error('Camera access denied:', error);
    alert('Camera access denied. Please allow camera permission.');
  }
}
```

---

### Step 3 — Tambah Video Element

```html
<video 
  id="user-camera" 
  autoplay 
  playsinline 
  muted
  style="display: none;">
</video>
```

Atribut penting:
- `autoplay` → langsung play tanpa user klik
- `playsinline` → tidak fullscreen di mobile
- `muted` → wajib, browser block autoplay kalau tidak muted

---

### Step 4 — Styling Video Element

```css
#user-camera {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 200px;
  height: 150px;
  border-radius: 12px;
  border: 2px solid rgba(200, 146, 42, 0.5);
  object-fit: cover;
  z-index: 1000;
  background: #000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Responsive — lebih kecil di mobile */
@media (max-width: 768px) {
  #user-camera {
    width: 120px;
    height: 90px;
    bottom: 80px;
    left: 10px;
  }
}
```

Posisi: pojok kiri bawah.
Haruka tetap di tengah/kanan.
Terasa kayak layout video call.

---

### Step 5 — Toggle Button Styling

```css
#camera-toggle {
  /* Samakan style dengan tombol mic yang sudah ada */
  background: transparent;
  border: 1px solid rgba(200, 146, 42, 0.3);
  border-radius: 50%;
  width: 44px;
  height: 44px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
}

#camera-toggle:hover {
  background: rgba(200, 146, 42, 0.1);
  border-color: rgba(200, 146, 42, 0.6);
}

#camera-toggle.active {
  background: rgba(200, 146, 42, 0.2);
  border-color: #C8922A;
}
```

---

### Step 6 — Update Toggle Button State

```javascript
async function toggleCamera() {
  const videoEl = document.getElementById('user-camera');
  const toggleBtn = document.getElementById('camera-toggle');
  
  if (cameraActive) {
    cameraStream.getTracks().forEach(track => track.stop());
    videoEl.srcObject = null;
    videoEl.style.display = 'none';
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '📷';
    cameraActive = false;
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: 'user'
      }
    });

    videoEl.srcObject = cameraStream;
    videoEl.style.display = 'block';
    toggleBtn.classList.add('active');
    toggleBtn.textContent = '📹';
    cameraActive = true;

  } catch (error) {
    console.error('Camera access denied:', error);
  }
}
```

---

### Step 7 — Cleanup Saat User Tutup Tab

```javascript
window.addEventListener('beforeunload', () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
});
```

---

## LAYOUT DI LAYAR

```
┌──────────────────────────────────────────┐
│  [Home]              [Background] [⚙️]  │
│                                          │
│              ┌──────────┐                │
│              │          │                │
│              │  HARUKA  │                │
│              │ (Live2D) │                │
│              │          │                │
│              └──────────┘                │
│                                          │
│  ┌─────────┐                             │
│  │  USER   │           [chat bubble]     │
│  │ CAMERA  │                             │
│  └─────────┘                             │
│         [🎤 mic] [📷 camera] [EN|JP]     │
└──────────────────────────────────────────┘

User camera: pojok kiri bawah
Haruka: tengah
Mic + Camera button: bawah tengah
```

---

## NOTES

- Kamera TIDAK kirim data ke server manapun — video stream 100% lokal
- Video tidak di-record — hanya display
- User harus klik tombol untuk aktifkan — tidak auto-on
- Kalau user deny permission → tampilkan pesan yang jelas
- Test di Chrome, Edge, dan mobile browser
- Di iOS Safari, `playsinline` wajib ada agar tidak fullscreen

---

## TESTING CHECKLIST

- [ ] Tombol camera muncul di samping tombol mic
- [ ] Klik tombol → browser minta izin kamera
- [ ] Izin diberikan → video muncul di pojok kiri bawah
- [ ] Video mirror (tidak terbalik)
- [ ] Klik tombol lagi → kamera mati
- [ ] Voice tetap jalan bersamaan dengan kamera
- [ ] Haruka tetap respond normal saat kamera aktif
- [ ] Mobile responsive — video lebih kecil
- [ ] Tutup tab → kamera otomatis mati
- [ ] Deny permission → pesan error yang jelas
