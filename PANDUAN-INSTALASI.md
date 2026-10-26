# Panduan Instalasi IZIN-KU

## A. Backend (Google Apps Script)
1. Buka https://script.google.com → **Proyek baru**. Ganti nama `Code.gs` → `Kode`, tempel seluruh isi `Kode.gs`.
2. Pengaturan Proyek (ikon roda gigi) → centang **Tampilkan file manifes appsscript.json** → ganti isinya dengan `appsscript.json`.
3. Pilih fungsi `setupIZINKU` → ▶ Run → izinkan akses. **Jalankan sekali.** Catat **sandi awal superadmin** dari log (username `admin`). Rahasia (`TOKEN_SECRET`, ID spreadsheet/folder) terisi otomatis di Script Properties.
4. Edit daftar di fungsi `buatAkunAwal` (Kepala Sekolah, Staf TU, guru) → Run sekali → catat sandi acak tiap akun dari log.
5. **Deploy → Deployment baru → Aplikasi web** · Jalankan sebagai: **Saya** · Akses: **Siapa saja** → salin URL `/exec`.
6. Update berikutnya: **Deploy → Kelola deployment → ✏️ → Versi baru** (jangan "Deployment baru", URL akan berubah).

## B. WhatsApp (opsional, bawaan MATI)
Script Properties → tambah `FONNTE_TOKEN` (dari fonnte.com) → di sheet `Pengaturan` ubah `NOTIF_WA_AKTIF` jadi `YA` → jalankan `pasangTrigger` sekali. Gagal kirim hanya tercatat di sheet `AntrianNotif`, tidak menggagalkan pengajuan.

## C. Frontend (GitHub Pages)
1. Ekstrak `izin-ku-frontend.zip`. Folder hasil ekstrak **adalah** folder kerja (berisi `index.html`, `css/`, `js/`).
2. Buka `js/config.js`, isi `GAS_URL` dengan URL `/exec`.
3. Di folder itu: `git init` → `git add .` → `git commit -m "Upload pertama"` → `git branch -M main` → `git remote add origin https://github.com/USERNAME/NAMA-REPO.git` → `git push -u origin main` (repo Public, tanpa README awal; sandi = Personal Access Token dengan scope `repo`).
4. GitHub → Settings → Pages → Deploy from a branch → `main` `/ (root)` → Enforce HTTPS.
5. Update: `git add .` · `git commit -m "..."` · `git push`, lalu Ctrl+Shift+R.

## Rahasia
Otomatis: `TOKEN_SECRET`, `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `UPLOADS_FOLDER`. Diisi Anda: `FONNTE_TOKEN`. Sandi pengguna disimpan sebagai hash.
