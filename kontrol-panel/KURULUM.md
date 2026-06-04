# 🎛️ LSPD Kontrol Paneli — Kurulum Rehberi

Bu panel **PM2** kullanarak bot, frontend ve backend'ini tek bir web arayüzünden yönetmeni sağlar. Pterodactyl benzeri ama daha hafif.

**Ne yapabilirsin:**
- ✅ Bot/Frontend/Backend'i başlat / durdur / restart at
- ✅ CPU & RAM kullanımını anlık gör
- ✅ Canlı log akışı (terminal gibi)
- ✅ Çoklu kullanıcı (her arkadaşına ayrı şifre, ayrı yetki)
- ✅ Aktivite logu (kim ne zaman ne yapmış)
- ✅ Hangi kullanıcı hangi process'e erişebilir (yetki kontrolü)

---

## 📋 1. ÖN HAZIRLIK — PM2 Kurulumu

Önce sunucunda PM2'nin yüklü olması lazım. Eğer yoksa:

```bash
sudo npm install -g pm2
```

## 📋 2. UYGULAMALARINI PM2'YE EKLE

Botun, frontend ve backend'ini PM2'ye **isim vererek** ekle. İsim önemli, panelde bu isimleri göreceksin.

```bash
# Bot
cd /yol/discord-botun
pm2 start index.js --name discord-bot

# Backend
cd /yol/backendin
pm2 start server.js --name backend

# Frontend (Next.js örneği)
cd /yol/frontendin
pm2 start npm --name frontend -- start
```

Sonra mevcut listeyi kaydet ki sunucu reboot olursa otomatik açılsın:

```bash
pm2 save
pm2 startup
# Çıkan komutu kopyala-yapıştır
```

PM2'yi yöneten kullanıcı **panel'i de aynı kullanıcı ile çalıştırmalısın**. Yoksa panel başka bir kullanıcının PM2'sini göremez.

---

## 📋 3. PANELİ KUR

```bash
# Panel klasörünü kopyala
cd /home/kullanici
# (bu klasörü VPS'ine yükle)

cd kontrol-panel

# Bağımlılıkları yükle
npm install

# .env dosyasını oluştur
cp .env.example .env

# JWT secret üret (rastgele uzun string)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Çıkan değeri .env'deki JWT_SECRET satırına yapıştır

nano .env   # Düzenle
```

`.env` içeriği:
```env
PANEL_PORT=4500
JWT_SECRET=buraya_yapistirdigin_uzun_random_string
```

## 📋 4. PANELİ ÇALIŞTIR

Paneli de PM2 ile çalıştır (kendini de yönetebilir):

```bash
pm2 start server.js --name kontrol-panel
pm2 save
```

Veya manuel:
```bash
node server.js
```

---

## 📋 5. TARAYICIDAN AÇ

Tarayıcıdan şu adrese git:

```
http://SUNUCU_IP:4500
```

**İlk giriş bilgileri:**
- Kullanıcı: `admin`
- Şifre: `admin123`

⚠️ **HEMEN ŞİFRENİ DEĞİŞTİR:** Sağ üstten "Hesabım" → şifre güncelle.

---

## 🌐 6. (ÖNERİLEN) NGİNX İLE GÜVENLİ ERİŞİM

Panel'i internet üzerinden HTTPS ile açmak için Nginx reverse proxy kur:

```nginx
# /etc/nginx/sites-available/panel.example.com
server {
    listen 80;
    server_name panel.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:4500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Sonra:
```bash
sudo ln -s /etc/nginx/sites-available/panel.example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL ekle
sudo certbot --nginx -d panel.example.com
```

---

## 👥 7. ARKADAŞLARINA ERİŞİM VERME

Panel'e admin olarak gir → **Kullanıcılar** sekmesi → **+ Yeni Kullanıcı**.

İki tip yetki:
- **Admin**: Her şeyi yapabilir, başka kullanıcı ekleyebilir, aktivite logunu görebilir.
- **User**: Sadece izin verdiğin process'leri görür ve restart atabilir.

Örnek: Bir arkadaşına sadece `discord-bot`'u restart etme yetkisi:
- Kullanıcı: `arkadas1`
- Şifre: `gucluSifre123`
- Rol: User
- İzinli Process'ler: `discord-bot`

Birden fazla process izni: `discord-bot,backend`
Tüm process'lere erişim: `*`

---

## 🚨 SORUN GİDERME

### "PM2 bağlanamadı" hatası
- Panel'i PM2'yi yöneten **aynı kullanıcı** ile çalıştırdığından emin ol
- `pm2 list` komutunu aynı kullanıcı ile çalıştır, process'lerini görebilmelisin
- `npm i -g pm2` ile global PM2 yüklü mü?

### "Process'ler boş görünüyor"
- PM2'de hiç process yoksa eklemeyi unutmuşsun. Bkz. Adım 2.
- `pm2 list` ile kontrol et.

### Canlı log akmıyor
- Tarayıcı konsolunda WebSocket hatası var mı? F12 → Console
- Nginx kullanıyorsan `proxy_set_header Upgrade` satırını eklediğinden emin ol (yukardaki config)

### Şifre unuttum
- `users.json` dosyasını sil → panel yeniden başlayınca `admin/admin123` ile yeniden oluşur.

---

## 📁 DOSYA YAPISI

```
kontrol-panel/
├── server.js              # Backend (Express + PM2 + WebSocket)
├── package.json           # Bağımlılıklar
├── public/
│   └── index.html         # Frontend UI (tek dosya)
├── .env                   # Yapılandırma (sen oluşturacaksın)
├── .env.example           # Örnek yapılandırma
├── users.json             # Kullanıcılar (otomatik oluşur, SAKLAYIN)
├── activity.json          # Aktivite logu (otomatik oluşur)
└── KURULUM.md             # Bu dosya
```

⚠️ **`users.json` ve `.env` dosyalarını ASLA paylaşma veya git'e push etme!**

`.gitignore` örneği:
```
node_modules/
.env
users.json
activity.json
```

---

## 🔒 GÜVENLİK İPUÇLARI

1. **Şifreni hemen değiştir** (admin/admin123 default'unu silmek için).
2. **JWT_SECRET'i uzun ve random yap** (en az 64 karakter).
3. **HTTPS kullan** (Nginx + Certbot ile).
4. **Firewall'da panel portunu kapalı tut** (sadece Nginx üzerinden erişilsin):
   ```bash
   sudo ufw deny 4500
   ```
5. **Düzenli yedek al**: `users.json`, `activity.json` dosyalarını yedekle.
6. **Brute force koruması** için fail2ban kurabilirsin (opsiyonel).

---

İyi yönetimler! 🎛️
