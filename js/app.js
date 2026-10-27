(() => {
'use strict';
const G = (window.IZINKU || {}).GAS_URL, $ = (s, e = document) => e.querySelector(s), $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = 'izinku:v1:', st = { get(k) { try { return JSON.parse(localStorage.getItem(LS + k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(LS + k); } catch (e) {} } };
const S = { tok: st.get('tok'), me: null, jenis: [], list: [], notif: [], tab: 'jam', f: 'semua', q: '' };
const BL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fd = s => { if (!s) return '-'; if (!/^\d{4}-\d{2}-\d{2}/.test(s)) { const t = new Date(s); if (isNaN(t)) return String(s); s = t.toISOString(); } const [y, m, d] = s.slice(0, 10).split('-'); return `${d} ${BL[m - 1]} ${y}`; };
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
  const nav = NAV(), ex = EXTRA(), br = '<span class="logo"><span class="ms">task_alt</span></span><span><b>IZIN-KU</b><small>Presensi &amp; Izin Guru</small></span>';
  $('#app').innerHTML = `<header class="top"><div><div class="brand tb">${br}</div><div class="lb" style="color:#dde1ff">${esc(S.me.Nama)} · ${esc(S.me.Peran)}</div>
  <div class="brand"><a class="ibtn" href="#/notif" aria-label="Notifikasi"><span class="ms">notifications</span><span class="badge" id="bd"></span></a><a href="#/profil" class="av">${esc(ini(S.me.Nama))}</a></div></div></header>
  <aside class="side"><div class="brand">${br}</div>${nav.concat(ex).map(n => `<a class="nv" data-k="${n[0]}" href="#/${n[0]}"><span class="ms">${n[2]}</span>${n[1]}</a>`).join('')}<button class="out" id="lo">Keluar</button></aside>
  <main><div class="wrap" id="view"></div></main><nav class="bar">${BAR(nav, ex).map(n => `<a data-k="${n[0]}" href="#/${n[0]}"><span class="ms">${n[2]}</span>${n[1]}</a>`).join('')}</nav>`;
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
// ---------- Menu tambahan per peran ----------
const REK = ['rekap', 'Rekap & Laporan', 'insights'], JNS = ['jenis', 'Jenis Izin', 'category'], PEG = ['pegawai', 'Data Pegawai', 'groups'];
const EXTRA = () => ({ staf: [REK, JNS], kepsek: [REK], superadmin: [REK, JNS, PEG] }[role()] || []);
const BAR = (nav, ex) => ex.length ? nav.filter(n => !['izin', 'profil'].includes(n[0])).concat([['menu', 'Lainnya', 'apps'], ['profil', 'Profil', 'account_circle']]) : nav;
const ACC = { rekap: ['superadmin', 'staf', 'kepsek'], menu: ['superadmin', 'staf', 'kepsek'], jenis: ['superadmin', 'staf'], pegawai: ['superadmin'] };
const pMenu = () => `<div class="ph"><h1>Menu Lainnya</h1></div><div class="stack">${[['izin', 'Izin Saya', 'assignment']].concat(EXTRA()).map(n => `<a class="card row" href="#/${n[0]}"><span><span class="ms" style="color:var(--p)">${n[2]}</span> <b>${n[1]}</b></span><span class="ms">chevron_right</span></a>`).join('')}</div>`;
function modal(html, onForm) {
  const d = document.createElement('dialog'); d.className = 'sheet'; d.innerHTML = html; document.body.appendChild(d); d.showModal();
  const close = () => { d.close(); d.remove(); }; d.addEventListener('cancel', e => { e.preventDefault(); close(); }); $$('[data-x]', d).forEach(b => b.onclick = close);
  const f = $('form', d); if (f) f.onsubmit = async e => { e.preventDefault(); const b = $('.pri', f); b.disabled = true; if (!(await onForm(f, close))) b.disabled = false; }; return d;
}
const chk = (n, l, on) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${n}" style="width:18px;min-height:18px;margin:0" ${on ? 'checked' : ''}>${l}</label>`;
const acts = '<div class="acts"><button type="button" data-x class="btn out">Batal</button><button class="btn pri">Simpan</button></div>';
// ---------- Rekap & Laporan ----------
const num = x => x.Tipe === 'Jam' ? ((+x.JamAkhir.slice(0, 2) * 60 + +x.JamAkhir.slice(3)) - (+x.JamMulai.slice(0, 2) * 60 + +x.JamMulai.slice(3))) / 60 : (Date.parse(x.TglAkhir) - Date.parse(x.TglMulai)) / 864e5 + 1;
const R = { bln: '', tipe: '', st: '', q: '', tab: 'log' };
const rekapData = () => { const q = R.q.toLowerCase(); return S.list.filter(x => (!R.bln || x.TglMulai.slice(0, 7) === R.bln) && (!R.tipe || x.Tipe === R.tipe) && (!R.st || x.Status === R.st) && (!q || (x.Nama + x.NIP + x.JenisNama).toLowerCase().includes(q))); };
const bh = (items, max) => items.map(([l, v, c]) => `<div class="bh"><span class="lb">${esc(l)}</span><div><i style="width:${max ? Math.round(v / max * 100) : 0}%;background:${c || 'var(--p)'}"></i></div><b class="mono">${v}</b></div>`).join('') || '<div class="lb">Belum ada data.</div>';
function akum(a) { const m = {}; a.forEach(x => { const o = m[x.IDPegawai] || (m[x.IDPegawai] = { Pegawai: x.Nama, NIP: x.NIP, Pengajuan: 0, 'Total Jam': 0, 'Total Hari': 0 }); o.Pengajuan++; if (x.Status === 'Disetujui') o[x.Tipe === 'Jam' ? 'Total Jam' : 'Total Hari'] += num(x); }); return Object.values(m).map(o => (o['Total Jam'] = +o['Total Jam'].toFixed(1), o)).sort((p, q) => q.Pengajuan - p.Pengajuan); }
function pRekap() {
  const sel = (id, arr, v, l) => `<label>${l}<select id="${id}"><option value="">Semua</option>${arr.map(s => `<option ${v === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`;
  return `<div class="ph"><h1>Rekapitulasi &amp; Laporan</h1></div><div class="stack"><div class="card noprint"><div class="two"><label>Bulan<input type="month" id="rb" value="${R.bln}"></label>${sel('rt', ['Jam', 'Hari'], R.tipe, 'Tipe')}</div>
 <div class="two">${sel('rs', ['Pending', 'Terverifikasi', 'Disetujui', 'Ditolak', 'Dikembalikan'], R.st, 'Status')}<label>Cari<input id="rq" value="${esc(R.q)}" placeholder="Nama / NIP / jenis"></label></div>
 <div class="acts"><button class="btn out" id="xl"><span class="ms">table_view</span>Excel</button><button class="btn out" id="pf"><span class="ms">print</span>PDF / Cetak</button></div></div><div id="rk" class="stack"></div></div>`;
}
function rk() {
  const a = rekapData(), ap = a.filter(x => x.Status === 'Disetujui'), sum = t => ap.filter(x => x.Tipe === t).reduce((s, x) => s + num(x), 0), ds = ap.length, dt = a.filter(x => x.Status === 'Ditolak').length;
  const mo = {}; S.list.forEach(x => { const k = x.TglMulai.slice(0, 7); mo[k] = (mo[k] || 0) + 1; }); const ks = Object.keys(mo).sort().slice(-6);
  const jn = {}; a.forEach(x => jn[x.JenisNama] = (jn[x.JenisNama] || 0) + 1); const js = Object.entries(jn).sort((p, q) => q[1] - p[1]).slice(0, 6);
  const sc = {}, col = { Pending: '#FACC15', Terverifikasi: '#2563EB', Disetujui: '#22c55e', Ditolak: '#DC2626', Dikembalikan: '#fb923c' }; a.forEach(x => sc[x.Status] = (sc[x.Status] || 0) + 1);
  const tb = R.tab === 'log' ? `<table class="tbl"><tr><th>ID</th><th>Pemohon</th><th>Jenis</th><th>Tanggal</th><th>Durasi</th><th>Status</th><th>Pejabat</th></tr>${a.map(x => `<tr><td class="id">${esc(x.ID)}</td><td>${esc(x.Nama)}<div class="lb">${esc(x.NIP)}</div></td><td>${esc(x.Tipe)} · ${esc(x.JenisNama)}</td><td class="mono">${esc(when(x))}</td><td class="mono">${esc(dur(x))}</td><td>${chip(x)}</td><td>${esc(x.Pemutus || x.Verifikator || '-')}</td></tr>`).join('')}</table>`
    : `<table class="tbl"><tr><th>Pegawai</th><th>NIP</th><th>Pengajuan</th><th>Total Jam</th><th>Total Hari</th></tr>${akum(a).map(o => `<tr><td>${esc(o.Pegawai)}</td><td class="mono">${esc(o.NIP)}</td><td class="mono">${o.Pengajuan}</td><td class="mono">${o['Total Jam']}</td><td class="mono">${o['Total Hari']}</td></tr>`).join('')}</table>`;
  $('#rk').innerHTML = `<div class="grid g2 g4">${kpi('Total pengajuan', a.length, '#1E40AF')}${kpi('Total jam izin', +sum('Jam').toFixed(1), '#FACC15', 'disetujui')}${kpi('Total hari izin', sum('Hari'), '#EA580C', 'disetujui')}${kpi('Tingkat setuju', ds + dt ? Math.round(ds / (ds + dt) * 100) + '%' : '-', '#22c55e')}</div>
 <div class="cards"><div class="card"><div class="lb">Pengajuan per bulan</div>${bh(ks.map(k => [BL[+k.slice(5) - 1] + ' ' + k.slice(2, 4), mo[k]]), Math.max(0, ...ks.map(k => mo[k])))}</div>
 <div class="card"><div class="lb">Komposisi per jenis izin</div>${bh(js, Math.max(0, ...js.map(j => j[1])))}</div><div class="card"><div class="lb">Perbandingan status</div>${bh(Object.entries(sc).map(([s, v]) => [s, v, col[s]]), Math.max(0, ...Object.values(sc)))}</div></div>
 <div class="card"><div class="tabs noprint" style="margin-bottom:12px"><button data-rt="log" class="${R.tab === 'log' ? 'on' : ''}">LOG PENGAJUAN (${a.length})</button><button data-rt="akum" class="${R.tab === 'akum' ? 'on' : ''}">AKUMULASI PER PEGAWAI</button></div><div class="tw">${tb}</div></div>`;
  $$('[data-rt]').forEach(b => b.onclick = () => { R.tab = b.dataset.rt; rk(); });
}
function bRekap() {
  const go = () => { R.bln = $('#rb').value; R.tipe = $('#rt').value; R.st = $('#rs').value; R.q = $('#rq').value; clearTimeout(go.t); go.t = setTimeout(rk, 200); };
  ['rb', 'rt', 'rs', 'rq'].forEach(i => $('#' + i).oninput = go); $('#pf').onclick = () => print(); $('#xl').onclick = xls; rk();
}
async function xls() {
  if (!window.XLSX) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); }).catch(() => toast('Gagal memuat pustaka Excel (cek koneksi).', 1));
  if (!window.XLSX) return; const a = rekapData(), wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(a.map(x => ({ ID: x.ID, Pemohon: x.Nama, NIP: x.NIP, Tipe: x.Tipe, Jenis: x.JenisNama, Mulai: x.TglMulai, Akhir: x.TglAkhir, 'Jam Mulai': x.JamMulai, 'Jam Akhir': x.JamAkhir, Durasi: dur(x), Status: x.Status, Pejabat: x.Pemutus || x.Verifikator, Alasan: x.Keterangan }))), 'Log');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(akum(a)), 'Akumulasi'); XLSX.writeFile(wb, 'rekap-izin-' + new Date().toISOString().slice(0, 10) + '.xlsx');
}
// ---------- Kelola Jenis Izin ----------
const pJenis = () => '<div class="ph"><h1>Kelola Jenis Izin</h1><button class="btn pri" id="nw" style="margin-left:auto">+ Tambah</button></div><div id="ax"><div class="sk"></div></div>';
async function bJenis() {
  let JN = [];
  const fj = j => modal(`<h3>${j ? 'Ubah' : 'Tambah'} Jenis Izin</h3><form><label>Nama<input name="nama" required maxlength="80" value="${esc(j && j.Nama)}"></label><label>Kategori<select name="kategori"><option ${j && j.Kategori === 'Jam' ? 'selected' : ''}>Jam</option><option ${j && j.Kategori === 'Hari' ? 'selected' : ''}>Hari</option></select></label>${chk('wajib', 'Berkas pendukung wajib', j && j.WajibBerkas === 'Ya')}${chk('aktif', 'Aktif (muncul di formulir)', !j || j.Aktif === 'YA')}${acts}</form>`, async (f, close) => {
    const r = await api('jenisSave', { id: j && j.ID, nama: f.nama.value, kategori: f.kategori.value, wajib: f.wajib.checked, aktif: f.aktif.checked }); toast(r.msg, !r.ok); if (!r.ok) return false;
    close(); await refresh(true); draw(); return true; });
  async function draw() {
    const r = await api('jenisList'); if (!r.ok) return $('#ax').innerHTML = `<div class="note err">${esc(r.msg)}</div>`; JN = r.data;
    $('#ax').innerHTML = `<div class="cards">${JN.map(j => `<div class="card"><div class="row"><span class="id">${esc(j.ID)}</span><span class="chip ${j.Aktif === 'YA' ? 'ok' : 'no'}">${j.Aktif === 'YA' ? 'Aktif' : 'Nonaktif'}</span></div><h3 style="margin:8px 0;font-size:18px">${esc(j.Nama)}</h3><div class="row"><span class="lb">Izin ${j.Kategori} · berkas ${j.WajibBerkas === 'Ya' ? 'wajib' : 'opsional'}</span><button class="btn out" data-e="${esc(j.ID)}" style="min-height:36px">Ubah</button></div></div>`).join('')}</div>`;
    $$('[data-e]').forEach(b => b.onclick = () => fj(JN.find(j => j.ID === b.dataset.e)));
  }
  $('#nw').onclick = () => fj(); draw();
}
// ---------- Kelola Pegawai ----------
const pPegawai = () => '<div class="ph"><h1>Data Pegawai</h1></div><div class="stack"><div class="acts"><button class="btn pri" id="np">+ Tambah Pegawai</button><button class="btn out" id="im">Impor CSV</button></div><input id="qp" placeholder="Cari nama / username / NIP…" style="margin:0"><div id="ax"><div class="sk"></div></div></div>';
function showPw(list, judul) {
  const txt = list.map(x => `${x.username}\t${x.password}`).join('\n');
  modal(`<h3>${esc(judul)}</h3><p>Catat sekarang — sandi awal hanya tampil sekali dan tidak tersimpan.</p><textarea readonly style="font-family:var(--mono);min-height:140px">${esc(txt)}</textarea><div class="acts"><button type="button" data-x class="btn out">Tutup</button><button type="button" class="btn pri" id="cp">Salin</button></div>`).querySelector('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(txt).then(() => toast('Disalin.')); };
}
async function bPegawai() {
  let PG = [];
  const fp = p => modal(`<h3>${p ? 'Ubah' : 'Tambah'} Pegawai</h3><form><label>Nama lengkap<input name="nama" required value="${esc(p && p.Nama)}"></label><label>Username<input name="un" required pattern="[a-zA-Z0-9._@+\-]{3,60}" title="3–60 karakter: huruf, angka, titik, @, +, - atau _" autocapitalize="none" value="${esc(p && p.Username)}"></label><label>Peran<select name="peran">${['user', 'staf', 'kepsek', 'superadmin'].map(r => `<option value="${r}" ${p && p.Peran === r ? 'selected' : ''}>${{ user: 'Guru / Staf', staf: 'Staf / Admin TU', kepsek: 'Kepala Sekolah', superadmin: 'Superadmin' }[r]}</option>`).join('')}</select></label>
   <label>No. WhatsApp<input name="wa" inputmode="tel" placeholder="08xxxxxxxxxx" value="${esc(p && p.NoWA)}"></label><label>NIP<input name="nip" value="${esc(p && p.NIP)}"></label><label>Jabatan<input name="jab" value="${esc(p && p.Jabatan)}"></label>${chk('aktif', 'Akun aktif', !p || p.Aktif === 'YA')}${p ? chk('reset', 'Reset kata sandi (sandi baru ditampilkan sekali)') : ''}${acts}</form>`, async (f, close) => {
    const r = await api('pegSave', { id: p && p.ID, nama: f.nama.value, username: f.un.value, peran: f.peran.value, wa: f.wa.value, nip: f.nip.value, jabatan: f.jab.value, aktif: f.aktif.checked, reset: f.reset && f.reset.checked }); toast(r.msg, !r.ok); if (!r.ok) return false;
    close(); draw(); if (r.data.password) showPw([{ username: f.un.value.toLowerCase(), password: r.data.password }], 'Sandi awal akun'); return true; });
  function list() {
    const q = $('#qp').value.toLowerCase(), a = PG.filter(p => !q || (p.Nama + p.Username + p.NIP).toLowerCase().includes(q)), pl = { user: 'Guru / Staf', staf: 'Staf TU', kepsek: 'Kepsek', superadmin: 'Superadmin' };
    $('#ax').innerHTML = `<div class="lb" style="margin-bottom:8px">${a.length} dari ${PG.length} pegawai · ${PG.filter(p => p.Aktif === 'YA').length} aktif</div><div class="cards">${a.map(p => `<div class="card" style="${p.Aktif === 'YA' ? '' : 'opacity:.6'}"><div class="row" style="justify-content:flex-start"><span class="av">${esc(ini(p.Nama))}</span><div style="flex:1;min-width:0"><b>${esc(p.Nama)}</b><div class="mono lb">${esc(p.Username)}${p.NIP ? ' · ' + esc(p.NIP) : ''}</div></div></div><div class="row" style="margin-top:10px"><span class="chip tj">${pl[p.Peran]}</span><span class="chip ${p.Aktif === 'YA' ? 'ok' : 'no'}">${p.Aktif === 'YA' ? 'Aktif' : 'Nonaktif'}</span><button class="btn out" data-e="${esc(p.ID)}" style="min-height:36px">Ubah</button></div></div>`).join('')}</div>`;
    $$('[data-e]').forEach(b => b.onclick = () => fp(PG.find(p => p.ID === b.dataset.e)));
  }
  async function draw() { const r = await api('pegList'); if (!r.ok) return $('#ax').innerHTML = `<div class="note err">${esc(r.msg)}</div>`; PG = r.data; list(); }
  $('#np').onclick = () => fp(); $('#qp').oninput = list;
  $('#im').onclick = () => modal(`<h3>Impor Pegawai (CSV)</h3><p>Satu baris per pegawai, tanpa judul kolom, maksimal 100 baris:<br><code class="mono">nama,username,peran,wa,nip,jabatan</code><br>Peran: user / staf / kepsek / superadmin. Username yang sudah ada dilewati.</p><form><input type="file" name="fl" accept=".csv,.txt"><textarea name="t" placeholder="Budi Santoso,budi.s,staf,081234567890,1985...,Staf TU"></textarea>${acts.replace('Simpan', 'Impor')}</form>`, async (f, close) => {
    const rows = f.t.value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const c = l.split(/[,;\t]/).map(s => s.trim()); return { nama: c[0], username: c[1], peran: c[2], wa: c[3], nip: c[4], jabatan: c[5] }; });
    if (!rows.length) { toast('Tempel data atau pilih berkas CSV.', 1); return false; }
    const r = await api('pegImport', { rows }); toast(r.msg, !r.ok); if (!r.ok) return false; close(); draw();
    if (r.data.dibuat.length) showPw(r.data.dibuat, r.data.dibuat.length + ' akun dibuat'); return true; }).querySelector('[name=fl]').onchange = e => { const fr = new FileReader(); fr.onload = () => e.target.form.t.value = fr.result; fr.readAsText(e.target.files[0]); };
  draw();
}
const PAGES = { beranda: [pBeranda], izin: [pIzin, bIzin], form: [pForm, bForm], detail: [pDetail, bDetail], antrian: [pAntrian, bAntrian], notif: [pNotif, bNotif], profil: [pProfil, bProfil], menu: [pMenu], rekap: [pRekap, bRekap], jenis: [pJenis, bJenis], pegawai: [pPegawai, bPegawai] };
function route() {
  if (!S.tok || !S.me) return;
  if (!$('#view')) shell();
  let [, pg = 'beranda', prm = ''] = location.hash.split('/'); prm = decodeURIComponent(prm);
  if (!PAGES[pg] || (pg === 'antrian' && role() === 'user') || (ACC[pg] && ACC[pg].indexOf(role()) < 0)) pg = 'beranda';
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
