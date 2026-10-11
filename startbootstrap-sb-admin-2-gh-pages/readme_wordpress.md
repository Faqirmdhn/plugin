# Panduan Menjalankan "Han Repair" di WordPress

Aplikasi **Han Repair - Sistem Informasi Akuntansi Bengkel Motor** ini dibuat dari
template SB Admin 2 dan berisi: Login, Dashboard, Barang Masuk, Barang Keluar,
Data Barang, Stok Barang, serta Laporan Laba Rugi (termasuk beban operasional).

Aplikasi ini **HTML/CSS/JavaScript murni** (tanpa backend wajib). Data bisa disimpan
dengan 2 cara:

| Metode | Penyimpanan data | Kerumitan | Cocok untuk |
|--------|------------------|-----------|-------------|
| **Metode 1 - Upload folder** | localStorage browser | Sangat mudah | Cepat jalan, 1 komputer |
| **Metode 2 - Plugin + Database** | Tabel/opsi WordPress (MySQL) | Sedang | Data tersimpan di server, bisa diakses dari mana saja |

> Login default: **admin** / **admin**. Segera ganti (lihat bagian "Mengganti Password").

---

## Struktur File yang Di-upload

```
han-repair/
├── login.html            <- halaman login
├── index.html            <- dashboard
├── barang.html           <- data barang (tambah via tombol +)
├── barang-masuk.html     <- input barang masuk (tambah via tombol +)
├── barang-keluar.html    <- input barang keluar (tambah via tombol +)
├── stok.html             <- kartu stok + stok opname
├── laporan.html          <- laporan laba rugi + beban operasional
├── css/
│   ├── sb-admin-2.min.css
│   └── han.css
├── js/
│   └── han-app.js        <- mesin aplikasi (login, data, laporan)
├── vendor/               <- jQuery, Bootstrap, Font Awesome, Chart.js
```

> Logo dan foto profil sudah menempel (inline SVG) di dalam file, jadi **tidak
> ada folder `img/`** yang perlu di-copy.

---

## METODE 1 - Upload Folder ke Hosting WordPress (Paling Mudah)

CRUD (tambah/ubah/hapus) **langsung berjalan** karena data disimpan di
penyimpanan browser (localStorage). Tidak perlu ubah tema atau plugin.

### Cara upload lewat cPanel File Manager
1. Login ke **cPanel** hosting Anda.
2. Buka **File Manager**.
3. Masuk ke folder **`public_html`** (atau folder tempat WordPress terpasang,
   biasanya `public_html` bila WP ada di domain utama, atau `public_html/nama-folder`
   bila WP di subfolder).
4. Klik **+ Folder**, buat folder baru bernama **`han-repair`**.
5. Masuk ke folder `han-repair`, klik **Upload**.
6. Upload **seluruh isi** folder aplikasi ini (semua file .html, folder `css`, `js`,
   `vendor`, `img`). Jika berbentuk ZIP, upload lalu klik kanan → **Extract**.
   Pastikan `login.html` berada langsung di dalam folder `han-repair` (bukan dobel
   folder `han-repair/han-repair`).
7. Selesai. Buka:
   ```
   https://domain-anda.com/han-repair/login.html
   ```

### Cara upload lewat FTP (FileZilla)
1. Buka FileZilla, masukkan Host (biasanya `ftp.domain-anda.com`), Username, Password, Port 21.
2. Di panel kanan masuk ke `public_html`.
3. Buat folder `han-repair`.
4. Drag & drop seluruh file aplikasi ke folder tersebut.
5. Buka `https://domain-anda.com/han-repair/login.html`.

### Menambahkan tautan ke menu WordPress
1. Dashboard WordPress → **Appearance → Menus**.
2. Tambahkan **Custom Link**.
3. URL: `/han-repair/login.html`, Label: mis. "Akuntansi Bengkel".
4. **Save Menu**.

> Catatan Metode 1: data tersimpan per-browser. Membersihkan cache/riwayat browser
> akan menghapus data. Untuk data yang tersimpan di server, gunakan Metode 2.

---

## METODE 2 - Plugin + Database WordPress (CRUD Tersimpan di Server)

Metode ini menyajikan aplikasi lewat alamat `/han-repair/` dan menyimpan data ke
**database WordPress**, sehingga bisa diakses dari komputer/HP lain.

### Langkah pemasangan
1. **Siapkan folder plugin.**
   - Ambil folder `wordpress/han-repair` yang disertakan.
2. **Copy plugin ke WordPress.**
   - Upload folder `han-repair` tersebut ke
     `wp-content/plugins/` (via File Manager atau FTP). Hasil: `wp-content/plugins/han-repair/han-repair.php`.
3. **Masukkan aplikasi ke dalam plugin.**
   - Di dalam `wp-content/plugins/han-repair/`, buat folder **`app`**.
   - Copy **seluruh file aplikasi** (semua `.html`, `css/`, `js/`, `vendor/`)
     ke dalam folder `app` tersebut.
   - Hasil wajib seperti: `wp-content/plugins/han-repair/app/index.html`
     dan `wp-content/plugins/han-repair/app/login.html`.
4. **Aktifkan plugin.**
   - Dashboard WordPress → **Plugins** → aktifkan
     **"Han Repair - Sistem Informasi Akuntansi Bengkel"**.
   - Saat aktif, plugin otomatis membuat penyimpanan data kosong di database.
5. **Aktifkan permalink cantik.**
   - **Settings → Permalinks** → pilih **Post name** → **Save Changes**.
   - (Wajib, agar alamat `/han-repair/` dikenali. Jika halaman 404, cukup Save Changes lagi.)
6. **Buka aplikasi.**
   ```
   https://domain-anda.com/han-repair/
   ```
   atau `https://domain-anda.com/han-repair/login.html`.
7. **Login aplikasi** dengan `admin` / `admin`.

### Agar data bisa disimpan ke database
- Permintaan simpan (POST) secara bawaan hanya diizinkan untuk **admin WordPress
  yang sedang login**. Jadi sebelum memakai aplikasi, login dulu ke `/wp-admin`,
  lalu buka `/han-repair/` pada browser yang sama. Ini sudah cukup untuk pemilik bengkel.
- Ingin diakses tanpa login WP (kurang aman, hanya untuk intranet/uji coba)?
  Tambahkan baris berikut di akhir **`wp-config.php`** (sebelum `/* That's all */`):
  ```php
  define('HAN_REPAIR_OPEN_WRITE', true);
  ```

### Di mana data disimpan
Data disimpan sebagai *option* WordPress (tabel `wp_options`):

| Koleksi | Nama option |
|---------|-------------|
| Data Barang | `han_repair_barang` |
| Barang Masuk | `han_repair_masuk` |
| Barang Keluar | `han_repair_keluar` |
| Beban Operasional | `han_repair_beban` |

Endpoint REST yang dipakai aplikasi:
```
GET  /wp-json/han-repair/v1/barang      (dan masuk, keluar, beban)
POST /wp-json/han-repair/v1/barang      body: { "items": [ ... ] }
```

### Cara kerja CRUD di WordPress (ringkas)
1. Saat halaman dibuka, plugin menyuntikkan `window.HAN_REPAIR` berisi `api`, `nonce`,
   dan seluruh data dari database.
2. `js/han-app.js` menuliskan data tersebut ke localStorage (sebagai cache),
   sehingga tampilan langsung terisi.
3. Setiap kali Anda menambah/mengubah/menghapus di UI:
   - data diperbarui di localStorage **dan**
   - dikirim otomatis (POST) ke REST API plugin, lalu disimpan ke database WordPress.
4. Karena itu data tetap ada meski ganti browser/perangkat, selama plugin aktif dan
   admin sudah login.

> Tanpa plugin (Metode 1), langkah 3 hanya menyimpan ke localStorage.

---

## Mengganti Password Login Aplikasi

Akun login aplikasi (bukan akun WordPress) disimpan di `js/han-app.js` pada bagian
`seed()`:

```js
write(KEYS.users, [{
    username: "admin", password: "admin",
    nama: "Pemilik Han Repair", role: "Admin"
}]);
```

Ganti `password: "admin"` dengan password baru. Untuk reset akun pada browser yang
sudah pernah membuka aplikasi, hapus data situs (clear site data) di browser, atau
ganti lewat console browser:
```js
localStorage.removeItem("han_users");
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Halaman `/han-repair/` 404 | Settings → Permalinks → pilih **Post name** → Save. Pastikan folder `app` berisi `index.html`. |
| CSS/JS tidak muncul | Pastikan seluruh isi aplikasi (termasuk `vendor/` dan `css/`) ada di dalam `app/`. |
| Tidak bisa simpan (data hilang saat ganti browser) | Login dulu ke `/wp-admin`, atau set `HAN_REPAIR_OPEN_WRITE` (lihat atas). |
| Ikon/font kotak-kotak | Pastikan folder `vendor/fontawesome-free/` ikut ter-copy. |
| Data lama masih muncul | Clear site data browser (localStorage) atau buka mode Incognito. |
| Blank setelah login | Buka Console browser (F12), cek error; pastikan file JS/JS vendor lengkap. |
| Ingin pakai HTTPS | Gunakan https:// pada saat mengakses; jangan campur http/https untuk aset. |

---

## Lisensi

MIT. Template dasar: SB Admin 2 (Start Bootstrap).
