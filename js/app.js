(() => {
'use strict';
const G = (window.IZINKU || {}).GAS_URL, $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = 'izinku:v1:', st = { get(k) { try { return JSON.parse(localStorage.getItem(LS + k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} } };
const S = { tok: st.get('tok'), me: null, jenis: [], list: [], notif: [], tab: 'jam', f: 'semua', q: '' };
const BL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fd = s => { if (!s) return '-'; const [y, m, d] = s.slice(0, 10).split('-'); return `${d} ${BL[m - 1]} ${y}`; };
const ft = s => s ? fd(s) + ' · ' + s.slice(11, 16) : '-';
const ini = n => String(n || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const dur = x => x.Tipe === 'Jam' ? (m => (m / 60 % 1 ? (m / 60).toFixed(1) : m / 60) + ' Jam')((+x.JamAkhir.slice(0, 2) * 60 + +x.JamAkhir.slice(3)) - (+x.JamMulai.slice(0, 2) * 60 + +x.JamMulai.slice(3))) : ((Date.parse(x.TglAkhir) - Date.parse(x.TglMulai)) / 864e5 + 1) + ' Hari';
const when = x => x.Tipe === 'Jam' ? `${fd(x.TglMulai)} · ${x.JamMulai}-${x.JamAkhir}` : x.TglMulai === x.TglAkhir ? fd(x.TglMulai) : `${fd(x.TglMulai)} – ${fd(x.TglAkhir)}`;
const role = () => S.me && S.me.Peran, isStaff = () => role() === 'staf', isKep = () => role() === 'kepsek';
const lbl = x => x.Status === 'Terverifikasi' && role() === 'user' ? 'Pending' : x.Status;
const cls = x => ({ Pending: 'pend', Terverifikasi: 'pend', Disetujui: 'ok', Ditolak: 'no', Dikembalikan: 'ret' }[lbl(x)] || 'pend');
const chip = x => `<span class="chip ${cls(x)}">${esc(lbl(x))}</span>`;
const tipeChip = x => `<span class="chip ${x.Tipe === 'Jam' ? 'tj' : 'th'}">IZIN ${esc(x.Tipe)}</span>`;
const mine = () => S.list.filter(x => x.IDPegawai === S.me.ID);
function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = '', 3200); }

// ---------- API (timeout, retry baca, reqId untuk tulis) ----------
async function api(action, data) {
  const w = !/^(boot|berkas)$/.test(action) && action !== 'login' ? true : action === 'login';
  const rid = w ? (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random()) : '';
  let r;
  for (let i = 0; i < (w ? 2 : 3); i++) {
    if (i) await new Promise(z => setTimeout(z, 1200 * i));
    const c = new AbortController(), t = setTimeout(() => c.abort(), w ? 60000 : 30000);
    try {
      const x = await fetch(G, { method: 'POST', redirect: 'follow', signal: c.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: S.tok || '', reqId: action === 'login' ? '' : rid, data: data || {} }) });
      r = JSON.parse(await x.text());
    } catch (e) { r = { ok: false, retry: true, msg: e.name === 'AbortError' ? 'Server terlalu lama merespons.' : 'Koneksi terputus.' }; }
    finally { clearTimeout(t); }
    if (r.ok || !r.retry) break;
  }
  if (r.code === 'AUTH' && action !== 'login') logout(true);
  return r;
}
function apply(b) { S.me = b.me; S.jenis = b.jenis; S.list = b.list; S.notif = b.notif; }
let lastRefresh = 0;
async function refresh(silent) {
  const r = await api('boot'); if (!r.ok) { if (!silent && !S.me) loginView(r.msg); return r.ok; }
  lastRefresh = Date.now();
  const h = JSON.stringify(r.data), same = S.me && JSON.stringify(st.get('boot')) === h;
  st.set('boot', r.data); if (same) return true;
  apply(r.data); if (!(silent && /^#\/form/.test(location.hash))) route(); return true;
}
function logout(exp) { S.tok = null; S.me = null; st.del('tok'); st.del('boot'); if (exp) setTimeout(() => toast('Sesi berakhir, silakan masuk lagi.', 1), 100); $('#app').innerHTML = ''; loginView(); }

// ---------- Kerangka ----------
const NAV = () => { const B = ['beranda', 'Beranda', 'space_dashboard'], I = ['izin', 'Izin Saya', 'assignment'], N = ['notif', 'Notif', 'notifications'], P = ['profil', 'Profil', 'account_circle'];
  return { user: [B, ['izin', 'Izin', 'assignment'], N, P], staf: [B, I, ['antrian', 'Verifikasi', 'fact_check'], N, P], kepsek: [B, ['antrian', 'Persetujuan', 'draw'], I, N, P], superadmin: [B, I, ['antrian', 'Semua', 'fact_check'], N, P] }[role()]; };
const unread = () => S.notif.filter(n => n.Dibaca !== 'YA').length;
function shell() {
  const nav = NAV(), br = '<span class="logo"><span class="ms">task_alt</span></span><span><b>IZIN-KU</b><small>Presensi &amp; Izin Guru</small></span>';
  $('#app').innerHTML = `<header class="top"><div><div class="brand tb">${br}</div><div class="lb" style="color:#dde1ff">${esc(S.me.Nama)} · ${esc(S.me.Peran)}</div>
  <div class="brand"><a class="ibtn" href="#/notif" aria-label="Notifikasi"><span class="ms">notifications</span><span class="badge" id="bd"></span></a><a href="#/profil" class="av">${esc(ini(S.me.Nama))}</a></div></div></header>
  <aside class="side"><div class="brand">${br}</div>${nav.map(n => `<a class="nv" data-k="${n[0]}" href="#/${n[0]}"><span class="ms">${n[2]}</span>${n[1]}</a>`).join('')}<button class="out" id="lo">Keluar</button></aside>
  <main><div class="wrap" id="view"></div></main><nav class="bar">${nav.map(n => `<a data-k="${n[0]}" href="#/${n[0]}"><span class="ms">${n[2]}</span>${n[1]}</a>`).join('')}</nav>`;
  $('#lo').onclick = () => logout();
}
function ask(t, s, need, okT, dng) {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'sheet';
    d.innerHTML = `<h3>${esc(t)}</h3><p>${esc(s)}</p><textarea maxlength="250" placeholder="Catatan${need ? ' (wajib)' : ' (opsional)'}"></textarea><div class="acts"><button type="button" id="x" class="btn out">Batal</button><button type="button" id="k" class="btn ${dng ? 'dng' : 'pri'}">${esc(okT)}</button></div>`;
    document.body.appendChild(d); d.showModal();
    const done = v => { d.close(); d.remove(); res(v); };
    $('#x', d).onclick = () => done(null);
    $('#k', d).onclick = () => { const n = $('textarea', d).value.trim(); if (need && !n) { $('textarea', d).focus(); return toast('Catatan wajib diisi.', 1); } done(n); };
    d.addEventListener('cancel', e => { e.preventDefault(); done(null); });
  });
}
async function act(kind, id, aksi) {
  const C = { teruskan: ['Teruskan ke Kepala Sekolah', 'Pengajuan akan diteruskan untuk keputusan akhir.', 0, 'Teruskan'], kembalikan: ['Kembalikan ke Pemohon', 'Jelaskan alasan pengembalian agar pemohon dapat memperbaiki.', 1, 'Kembalikan', 1],
    setuju: ['Setujui Pengajuan', 'Keputusan Kepala Sekolah bersifat final dan mengikat.', 0, 'Setujui'], tolak: ['Tolak Pengajuan', 'Alasan wajib diisi. Pemohon harus membuat pengajuan baru.', 1, 'Tolak', 1] }[aksi];
  const n = await ask(...C); if (n === null) return;
  const r = await api(kind, { id, aksi, catatan: n }); toast(r.msg, !r.ok);
  if (r.ok) { await refresh(); location.hash = '#/antrian'; }
}

// ---------- Halaman ----------
const item = (x, own) => `<a class="card it ${cls(x)}" href="#/detail/${esc(x.ID)}"><div class="row"><span class="id">#${esc(x.ID)}</span>${chip(x)}</div>
 <h3>${esc(x.JenisNama)}</h3>${own ? '' : `<div class="lb" style="margin-bottom:6px">${esc(x.Nama)}</div>`}<div class="meta"><span class="ms" style="font-size:16px">${x.Tipe === 'Jam' ? 'schedule' : 'calendar_month'}</span> ${esc(when(x))} · ${esc(dur(x))}</div>
 ${x.Status === 'Ditolak' || x.Status === 'Dikembalikan' ? `<div class="note err" style="margin-top:10px"><b class="lb">${x.Status === 'Ditolak' ? 'Alasan penolakan' : 'Catatan pengembalian'}</b><br>${esc(x.CatatanKeputusan || x.CatatanVerifikasi)}</div>` : ''}</a>`;
const kpi = (l, n, c, s) => `<div class="card kpi" style="--c:${c}"><span class="lb">${l}</span><div class="n">${String(n).padStart(2, '0')}</div><span class="lb">${s || ''}</span></div>`;
function pBeranda() {
  const m = mine(), c = a => m.filter(x => a.includes(x.Status)).length, bln = new Date().toISOString().slice(0, 7), q = S.list.filter(x => x.Status === (isStaff() ? 'Pending' : 'Terverifikasi')).length;
  return `<div class="stack"><div class="card hero"><div class="row"><span class="lb">Selamat datang,</span><span class="chip tj">${esc(S.me.Peran)}</span></div><div style="font:700 24px/32px var(--head);margin:4px 0">${esc(S.me.Nama)}</div><span class="mono lb">${S.me.NIP ? 'NIP. ' + esc(S.me.NIP) + ' · ' : ''}${esc(S.me.Jabatan)}</span></div>
 ${isStaff() || isKep() ? `<a class="card row" href="#/antrian" style="border-left:4px solid #FACC15"><span><b>${q} pengajuan</b> menunggu ${isStaff() ? 'verifikasi Anda' : 'keputusan Anda'}</span><span class="ms">arrow_forward</span></a>` : ''}
 <div class="grid g2 g4">${kpi('Menunggu verif', c(['Pending', 'Terverifikasi']), '#FACC15', 'Pending')}${kpi('Telah disetujui', c(['Disetujui']), '#22c55e', 'Disetujui')}${kpi('Ditolak', c(['Ditolak']), '#DC2626', 'Ditolak')}${kpi('Total bulan ini', m.filter(x => x.Dibuat.slice(0, 7) === bln).length, '#EA580C', BL[+bln.slice(5) - 1] + ' ' + bln.slice(0, 4))}</div>
 <div class="lb">Menu cepat</div><div class="grid g2" style="grid-template-columns:repeat(2,1fr)"><a class="btn out" href="#/form/jam"><span class="ms">schedule</span>Izin Jam</a><a class="btn out" href="#/form/hari"><span class="ms">calendar_month</span>Izin Hari</a></div>
 <div class="note warn"><b>Info:</b> pastikan jadwal guru pengganti terisi bila mengambil Izin Jam pada jam mengajar aktif.</div>
 <div class="row"><span class="lb">Pengajuan terakhir</span><a class="lb" style="color:var(--p)" href="#/izin">Lihat semua →</a></div><div class="cards">${m.slice(0, 3).map(x => item(x, 1)).join('') || '<div class="card empty">Belum ada pengajuan.</div>'}</div></div>`;
}
function listHtml() {
  const q = S.q.toLowerCase(), a = mine().filter(x => x.Tipe.toLowerCase() === S.tab && (S.f === 'semua' || (S.f === 'Pending' ? ['Pending', 'Terverifikasi'] : [S.f]).includes(x.Status)) && (!q || (x.ID + x.JenisNama + x.Keterangan).toLowerCase().includes(q)));
  return a.map(x => item(x, 1)).join('') || '<div class="card empty" style="grid-column:1/-1">Tidak ada pengajuan.</div>';
}
function pIzin() {
  return `<div class="ph"><h1>Daftar Pengajuan</h1></div><div class="stack"><input id="q" placeholder="Cari nomor tiket / keperluan…" value="${esc(S.q)}" style="margin:0">
 <div class="tabs"><button data-t="jam" class="${S.tab === 'jam' ? 'on' : ''}">IZIN JAM</button><button data-t="hari" class="${S.tab === 'hari' ? 'on' : ''}">IZIN HARI (CUTI)</button></div>
 <div class="chips">${['semua', 'Pending', 'Disetujui', 'Ditolak', 'Dikembalikan'].map(f => `<button data-f="${f}" class="${S.f === f ? 'on' : ''}">${f}</button>`).join('')}</div><div class="cards" id="lst">${listHtml()}</div></div>
 <a class="fab" href="#/form/${S.tab}" aria-label="Ajukan izin"><span class="ms">add</span></a>`;
}
function bIzin() {
  $('#q').oninput = e => { S.q = e.target.value; clearTimeout(bIzin.t); bIzin.t = setTimeout(() => $('#lst').innerHTML = listHtml(), 250); };
  $$('[data-t]').forEach(b => b.onclick = () => { S.tab = b.dataset.t; route(); }); $$('[data-f]').forEach(b => b.onclick = () => { S.f = b.dataset.f; route(); });
}
function pForm(tipe) {
  tipe = tipe === 'hari' ? 'hari' : 'jam'; const J = S.jenis.filter(j => j.Kategori === (tipe === 'jam' ? 'Jam' : 'Hari')), today = new Date().toISOString().slice(0, 10), jam = tipe === 'jam';
  return `<div class="ph"><a href="#/izin" class="back" aria-label="Kembali"><span class="ms">arrow_back</span></a><h1>Ajukan Izin ${jam ? 'Jam' : 'Hari'}</h1></div>
 <form id="f" class="card"><div id="ov"></div><label>Jenis / Keperluan Izin *<select name="jenis" required>${J.map(j => `<option value="${esc(j.ID)}" data-w="${esc(j.WajibBerkas)}">${esc(j.Nama)}</option>`).join('')}</select></label>
 ${jam ? `<label>Tanggal Pelaksanaan *<input type="date" name="tgl" value="${today}" required></label><div class="two"><label>Jam Mulai *<input type="time" name="jm" required></label><label>Jam Berakhir *<input type="time" name="ja" required></label></div><div class="lb" id="du" style="margin:-6px 0 14px"></div>`
 : `<div class="two"><label>Tanggal Mulai *<input type="date" name="tgl" value="${today}" required></label><label>Tanggal Berakhir *<input type="date" name="tglA" value="${today}" required></label></div><div class="lb" id="du" style="margin:-6px 0 14px"></div>`}
 <label>Catatan Alasan / Rincian * <span class="lb" id="cn">0/${jam ? 250 : 300}</span><textarea name="ket" maxlength="${jam ? 250 : 300}" required></textarea></label>
 ${jam ? `<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="pgc" style="width:20px;min-height:20px;margin:0">Sertakan jadwal jam mengajar pengganti</label><div class="sub" id="pg" hidden><label>Guru Pengganti<input name="pg1"></label><label>Tanggal &amp; Jam Pengganti<input name="pg2" placeholder="17 Okt 2024 · 08:00-10:00"></label><label>Tugas Siswa<input name="pg3"></label></div>` : ''}
 <label>Dokumen Pendukung <span class="lb" id="wb">OPSIONAL</span><div class="drop"><input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,image/*"><div class="lb">PDF · JPG · PNG · maks 5 MB</div></div></label>
 <div class="acts"><a href="#/izin" class="btn out">Batal</a><button class="btn pri" id="sb">KIRIM PENGAJUAN →</button></div></form>`;
}
function bForm(tipe) {
  const f = $('#f'), jam = tipe !== 'hari', sel = f.jenis, calc = () => {
    const a = f.tgl.value, b = jam ? '' : f.tglA.value, d = $('#du');
    d.textContent = jam ? (f.jm.value && f.ja.value && f.ja.value > f.jm.value ? 'Durasi: ' + dur({ Tipe: 'Jam', JamMulai: f.jm.value, JamAkhir: f.ja.value }) : '') : (b >= a ? 'Total: ' + dur({ Tipe: 'Hari', TglMulai: a, TglAkhir: b }) : 'Tanggal berakhir tidak boleh lebih awal.');
  }, wb = () => { const w = sel.selectedOptions[0] && sel.selectedOptions[0].dataset.w === 'Ya'; $('#wb').textContent = w ? 'WAJIB' : 'OPSIONAL'; f.file.required = w; };
  f.addEventListener('input', calc); sel.onchange = wb; wb();
  f.ket.oninput = () => $('#cn').textContent = f.ket.value.length + '/' + f.ket.maxLength;
  if (jam) $('#pgc').onchange = e => $('#pg').hidden = !e.target.checked;
  f.onsubmit = async e => {
    e.preventDefault(); const b = $('#sb'); b.disabled = true; b.textContent = 'Mengirim…';
    const d = { tipe: jam ? 'jam' : 'hari', jenis: sel.value, tgl: f.tgl.value, ket: f.ket.value };
    if (jam) { d.jm = f.jm.value; d.ja = f.ja.value; if ($('#pgc').checked) d.pengganti = [f.pg1.value, f.pg2.value, f.pg3.value].filter(Boolean).join(' · '); } else d.tglA = f.tglA.value;
    const file = f.file.files[0];
    if (file) { if (file.size > 5 * 1048576) { b.disabled = false; b.textContent = 'KIRIM PENGAJUAN →'; return toast('Berkas maksimal 5 MB.', 1); }
      d.file = { nama: file.name, mime: file.type, b64: await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(file); }) }; }
    const r = await api('create', d);
    if (r.ok) { toast(r.msg + (r.data.warning ? ' ⚠ ' + r.data.warning : '')); await refresh(true); S.tab = jam ? 'jam' : 'hari'; location.hash = '#/izin'; }
    else { toast(r.msg, 1); $('#ov').innerHTML = `<div class="note err" style="margin-bottom:14px">${esc(r.msg)}</div>`; b.disabled = false; b.textContent = 'KIRIM PENGAJUAN →'; }
  };
}
function pDetail(id) {
  const x = S.list.find(r => r.ID === id); if (!x) return '<div class="card empty">Pengajuan tidak ditemukan.</div>';
  const v = x.Status !== 'Pending', dn = ['Disetujui', 'Ditolak'].includes(x.Status), ret = x.Status === 'Dikembalikan';
  const canV = isStaff() && x.Status === 'Pending', canD = isKep() && x.Status === 'Terverifikasi';
  const row = (l, t) => `<div class="meta" style="margin-bottom:8px"><div class="lb">${l}</div>${t}</div>`;
  return `<div class="ph"><a href="#/${S.me.Peran === 'user' || x.IDPegawai === S.me.ID ? 'izin' : 'antrian'}" class="back"><span class="ms">arrow_back</span></a><h1>Detail Pengajuan</h1></div>
 <div class="dt"><div class="stack"><div class="card"><div class="row">${tipeChip(x)}${chip(x)}</div><div class="id" style="margin:10px 0 4px">#${esc(x.ID)}</div><h2 style="font-size:22px">${esc(x.JenisNama)}</h2>
 <div class="row" style="justify-content:flex-start;margin-top:12px"><span class="av">${esc(ini(x.Nama))}</span><div><b>${esc(x.Nama)}</b><div class="mono lb">${x.NIP ? 'NIP ' + esc(x.NIP) : ''}</div><div class="lb">${esc(x.Jabatan)}</div></div></div></div>
 <div class="card"><h2 style="font-size:18px;margin-bottom:12px">Rincian Permohonan</h2>${row('Diajukan', ft(x.Dibuat))}${row('Periode izin', esc(when(x)) + ' · ' + esc(dur(x)))}${row('Alasan', esc(x.Keterangan))}${x.Pengganti ? row('Guru pengganti', esc(x.Pengganti)) : ''}
 ${x.BerkasNama ? `<button class="btn out w" id="bk"><span class="ms">attach_file</span>${esc(x.BerkasNama)} — Lihat</button>` : ''}</div></div>
 <div class="stack"><div class="card"><h2 style="font-size:18px;margin-bottom:14px">Proses Verifikasi &amp; Persetujuan</h2><ul class="tl">
 <li><i class="d"><span class="ms">check</span></i><b>1. Pengajuan</b><div class="lb">${esc(x.Nama)} · ${ft(x.Dibuat)}</div></li>
 <li><i class="${ret ? 'x' : v ? 'd' : 'c'}"><span class="ms">${ret ? 'undo' : v ? 'check' : 'hourglass_top'}</span></i><b>2. Verifikasi Staf TU</b><div class="lb">${v ? esc(x.Verifikator) + ' · ' + ft(x.WaktuVerifikasi) : 'Menunggu'}</div>${x.CatatanVerifikasi ? `<div class="meta" style="margin-top:6px">${esc(x.CatatanVerifikasi)}</div>` : ''}</li>
 <li><i class="${x.Status === 'Disetujui' ? 'd' : x.Status === 'Ditolak' ? 'x' : x.Status === 'Terverifikasi' ? 'c' : ''}"><span class="ms">${x.Status === 'Ditolak' ? 'close' : dn ? 'check' : 'gavel'}</span></i><b>3. Keputusan Kepala Sekolah</b><div class="lb">${dn ? esc(x.Pemutus) + ' · ' + ft(x.WaktuKeputusan) : 'Menunggu'}</div>${x.CatatanKeputusan ? `<div class="meta" style="margin-top:6px">${esc(x.CatatanKeputusan)}</div>` : ''}</li></ul></div>
 <div class="note info"><b>Catatan:</b> keputusan Kepala Sekolah bersifat final dan tidak dapat diedit. Jika ditolak atau dikembalikan, buat pengajuan baru.</div></div></div>
 ${canV ? `<div class="abar"><button class="btn out" data-a="verify:kembalikan" style="color:#9A3412">Kembalikan</button><button class="btn pri" data-a="verify:teruskan">Teruskan ke Kepsek →</button></div>` : ''}
 ${canD ? `<div class="abar"><button class="btn out" data-a="decide:tolak" style="color:var(--r)">Tolak</button><button class="btn pri" data-a="decide:setuju">Setujui</button></div>` : ''}`;
}
function bDetail(id) {
  $$('[data-a]').forEach(b => b.onclick = () => { const [k, a] = b.dataset.a.split(':'); act(k, id, a); });
  const bk = $('#bk'); if (bk) bk.onclick = async () => {
    bk.disabled = true; const r = await api('berkas', { id }); bk.disabled = false; if (!r.ok) return toast(r.msg, 1);
    const u = atob(r.data.b64), a = new Uint8Array(u.length); for (let i = 0; i < u.length; i++) a[i] = u.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([a], { type: r.data.mime })), '_blank');
  };
}
function pAntrian() {
  const a = S.list.filter(x => isStaff() ? x.Status === 'Pending' : isKep() ? x.Status === 'Terverifikasi' : true);
  return `<div class="ph"><h1>${isStaff() ? 'Verifikasi Pengajuan Masuk' : isKep() ? 'Persetujuan Pengajuan' : 'Semua Pengajuan'}</h1></div><div class="stack"><input id="qa" placeholder="Cari nama atau jenis izin…" style="margin:0"><div class="lb" id="ca">${a.length} berkas${role() === 'superadmin' ? '' : ' menunggu'}</div><div class="cards" id="la">${a.map(x => item(x)).join('') || '<div class="card empty" style="grid-column:1/-1">Tidak ada antrean. 🎉</div>'}</div></div>`;
}
function bAntrian() {
  $('#qa').oninput = e => { const q = e.target.value.toLowerCase(); $$('#la .it').forEach(c => c.hidden = !c.textContent.toLowerCase().includes(q)); };
}
function pNotif() {
  return `<div class="ph"><h1>Pusat Notifikasi</h1>${unread() ? '<button class="btn out" id="ra" style="margin-left:auto;min-height:40px">Tandai semua</button>' : ''}</div><div class="stack">${S.notif.map(n => `<a class="card nt ${n.Dibaca === 'YA' ? '' : 'un'}" href="#/detail/${esc(n.RefID)}"><div class="row"><span class="id">#${esc(n.RefID)}</span><span class="lb">${ft(n.Waktu)}</span></div><h3>${esc(n.Judul)}</h3><div>${esc(n.Isi)}</div></a>`).join('') || '<div class="card empty">Belum ada notifikasi.</div>'}</div>`;
}
function bNotif() { const b = $('#ra'); if (b) b.onclick = () => { S.notif.forEach(n => n.Dibaca = 'YA'); route(); api('notifRead'); }; }
function pProfil() {
  const m = S.me; return `<div class="ph"><h1>Profil &amp; Keamanan</h1></div><div class="dt"><div class="stack"><div class="card" style="text-align:center"><span class="av" style="width:72px;height:72px;font-size:24px;margin:0 auto 10px">${esc(ini(m.Nama))}</span><h2>${esc(m.Nama)}</h2>
 <div class="mono lb" style="margin:6px 0">${m.NIP ? 'NIP ' + esc(m.NIP) : esc(m.Username)}</div><div class="lb">${esc(m.Jabatan)}</div><div class="mono" style="margin-top:8px">${esc(m.NoWA || '-')}</div></div>
 <button class="btn w" id="lo2" style="background:#FEE2E2;color:#991B1B"><span class="ms">logout</span>KELUAR DARI APLIKASI</button></div>
 <form class="card" id="pw"><h2 style="font-size:18px;margin-bottom:12px">Ganti Kata Sandi</h2><label>Kata sandi saat ini<input type="password" name="lama" required autocomplete="current-password"></label><label>Kata sandi baru (min. 8 karakter)<input type="password" name="baru" minlength="8" required autocomplete="new-password"></label><label>Ulangi kata sandi baru<input type="password" name="ul" required autocomplete="new-password"></label><button class="btn pri w">Simpan Kata Sandi Baru</button><p class="lb" style="margin-top:10px">Sesi berakhir otomatis setelah 8 jam.</p></form></div>`;
}
function bProfil() {
  $('#lo2').onclick = () => logout();
  $('#pw').onsubmit = async e => { e.preventDefault(); const f = e.target; if (f.baru.value !== f.ul.value) return toast('Konfirmasi sandi tidak sama.', 1);
    const r = await api('passwd', { lama: f.lama.value, baru: f.baru.value }); toast(r.msg, !r.ok); if (r.ok) f.reset(); };
}
const PAGES = { beranda: [pBeranda], izin: [pIzin, bIzin], form: [pForm, bForm], detail: [pDetail, bDetail], antrian: [pAntrian, bAntrian], notif: [pNotif, bNotif], profil: [pProfil, bProfil] };
function route() {
  if (!S.tok || !S.me) return;
  if (!$('#view')) shell();
  let [, pg = 'beranda', prm = ''] = location.hash.split('/'); prm = decodeURIComponent(prm);
  if (!PAGES[pg] || (pg === 'antrian' && role() === 'user')) pg = 'beranda';
  $('#view').innerHTML = PAGES[pg][0](prm); if (PAGES[pg][1]) PAGES[pg][1](prm);
  $$('[data-k]').forEach(a => a.classList.toggle('on', a.dataset.k === (pg === 'form' || (pg === 'detail' && !location.hash.includes('antrian')) ? (pg === 'form' ? 'izin' : a.dataset.k === 'antrian' && role() !== 'user' && S.list.find(r => r.ID === prm && r.IDPegawai !== S.me.ID) ? 'antrian' : 'izin') : pg)));
  const bd = $('#bd'); bd.textContent = unread() || ''; bd.hidden = !unread(); window.scrollTo(0, 0);
  if (Date.now() - lastRefresh > 60000) refresh(true);
}
function loginView(err) {
  $('#app').innerHTML = `<div class="lg"><div class="hv"><div class="logo"><span class="ms" style="font-size:40px">task_alt</span></div><h1>IZIN-KU<em>PORTAL</em></h1><p>Sistem Pengajuan &amp; Persetujuan Izin Guru / Staf Sekolah</p></div>
 <form class="card bx" id="lf"><div class="row"><h2 style="font-size:22px">MASUK AKUN</h2><span class="chip tj">AUTH_STEP_01</span></div><p class="lb" style="margin:4px 0 14px">Gerbang validasi kedinasan</p>
 <div id="le">${err ? `<div class="note err" style="margin-bottom:14px"><b class="mono">AKUN TIDAK AKTIF / SALAH</b><br>${esc(err)}</div>` : ''}</div>
 <label>USERNAME / NIP *<input name="u" autocomplete="username" autocapitalize="none" required></label>
 <label>KATA SANDI<input name="p" type="password" autocomplete="current-password" required></label><label style="display:flex;gap:8px;align-items:center;margin-top:-6px"><input type="checkbox" id="sh" style="width:18px;min-height:18px;margin:0">Tampilkan sandi</label>
 <button class="btn pri w" id="lb2" style="font-size:16px">MASUK →</button><p class="lb" style="text-align:center;margin-top:14px">Lupa password? Hubungi Superadmin Tata Usaha</p></form></div>`;
  const f = $('#lf'); $('#sh').onchange = e => f.p.type = e.target.checked ? 'text' : 'password'; f.u.focus();
  f.onsubmit = async e => {
    e.preventDefault(); const b = $('#lb2'); b.disabled = true; b.textContent = 'Memeriksa…';
    const r = await api('login', { username: f.u.value, password: f.p.value });
    if (!r.ok) { b.disabled = false; b.textContent = 'MASUK →'; $('#le').innerHTML = `<div class="note err" style="margin-bottom:14px"><b class="mono">AKUN TIDAK AKTIF / SALAH</b><br>${esc(r.msg)}</div>`; return; }
    S.tok = r.data.token; st.set('tok', S.tok); st.set('boot', r.data.boot); apply(r.data.boot); lastRefresh = Date.now(); $('#app').innerHTML = ''; location.hash = '#/beranda'; route();
  };
}
// ---------- Mulai ----------
if (!G) { document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">Isi <b>GAS_URL</b> di <code>js/config.js</code> lalu muat ulang.</p>'; return; }
addEventListener('hashchange', route);
fetch(G + '?ping=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});     // pemanasan server
if (S.tok) { const c = st.get('boot'); if (c) { apply(c); route(); } else $('#app').innerHTML = '<main><div class="sk"></div></main>'; refresh(); } else loginView();
setInterval(() => { if (document.visibilityState === 'visible' && S.me && S.me.Peran !== 'user') refresh(true); }, 60000);   // polling ringan: hanya staf/kepsek/admin
})();
