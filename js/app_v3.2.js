/* ==========================================================
   DATABASE PEMINJAM v3.2 | app_v3.2.js
   - Dual search (Borrower vs Generic)
   - "👤 Profil Peminjam" header above borrower details
   - Risk Scoring (Income, Ratio, Purpose, Job)
   - Date overlap detection (⚠️ + highlight)
   - Smooth fade animations, Apple-style
   ========================================================== */

/* ---------- CONFIGURATION ---------- */
const SHEET_ID = '1ANwgbJdxvSY4rB71njLUQvz7IBZYNTIOjfQk7rDAS2Q';
const RANGE = 'Form Responses 1!A:Z';
const API_KEY = 'AIzaSyBmY0s92IXmpmErmRoTyoSlH3oKQYAU5M4';   // ← replace with your real Google API key
const PAGE_SIZE = 20;

/* ---------- GLOBALS ---------- */
let headers = [];
let allRows = [];
let filteredRows = [];
let currentPage = 1;

/* ---------- HELPERS ---------- */
const currency = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(num || 0);

const parseVal = (v) => parseInt((v || '').toString().replace(/[^0-9]/g, '')) || 0;

// Parse date in DD/MM/YYYY format safely
function parseDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split(/[\/\- ]/);
  return new Date(`${y}-${m}-${d}`);
}

/* ==========================================================
   === INITIAL LOAD ===
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => loadSheet());

async function loadSheet() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
      RANGE
    )}?key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.values) throw new Error('No data received');

    headers = data.values[0];
    allRows = data.values.slice(1);
    filteredRows = allRows;

    renderTable();
    updateDashboard();
  } catch (err) {
    document.body.innerHTML =
      "<p style='text-align:center;color:red'>Gagal memuat data. Periksa API key atau izin Sheet.</p>";
  } finally {
    document.getElementById('loading').style.display = 'none';
    document.querySelectorAll('.card').forEach((c, i) =>
      setTimeout(() => c.classList.add('visible'), 120 * i)
    );
  }
}

/* ==========================================================
   === DASHBOARD SUMMARY ===
   ========================================================== */
function updateDashboard() {
  document.getElementById('totalPeminjam').textContent = filteredRows.length;

  const incIdx = headers.findIndex((h) => /penghasilan|pendapatan|income|gaji/i.test(h));
  const loanIdx = headers.findIndex((h) => /pinjaman|jumlah/i.test(h));
  const purpIdx = headers.findIndex((h) => /tujuan|purpose/i.test(h));

  const incomeVals = filteredRows.map((r) => parseVal(r[incIdx]));
  const loanVals = filteredRows.map((r) => parseVal(r[loanIdx]));
  const avgIncome =
    incomeVals.length > 0 ? incomeVals.reduce((a, b) => a + b, 0) / incomeVals.length : 0;
  const totalLoan = loanVals.reduce((a, b) => a + b, 0);

  document.getElementById('rataPenghasilan').textContent = currency(avgIncome);
  document.getElementById('totalPinjaman').textContent = currency(totalLoan);

  const freq = {};
  filteredRows.forEach((r) => {
    const val = (r[purpIdx] || '').trim();
    if (val) freq[val] = (freq[val] || 0) + 1;
  });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('tujuanTeratas').textContent = top ? top[0] : '-';
}

/* ==========================================================
   === TABLE RENDERING ===
   ========================================================== */
function renderTable() {
  const tbl = document.getElementById('dataTable');
  if (!headers.length) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filteredRows.slice(start, start + PAGE_SIZE);
  let html = '<thead><tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach((r) => {
    html += '<tr>' + headers.map((_, i) => `<td>${r[i] || ''}</td>`).join('') + '</tr>';
  });
  html += '</tbody>';
  tbl.innerHTML = html;
  renderPagination();
}

function renderPagination() {
  const pag = document.getElementById('pagination');
  const total = Math.ceil(filteredRows.length / PAGE_SIZE);
  if (total <= 1) return (pag.innerHTML = '');
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="${i === currentPage ? 'disabled' : ''}" ${
      i === currentPage ? 'disabled' : ''
    } onclick="goPage(${i})">${i}</button>`;
  }
  pag.innerHTML = html;
}
function goPage(p) {
  currentPage = p;
  renderTable();
}

/* ==========================================================
   === SEARCH LOGIC (BORROWER PROFILE) ===
   ========================================================== */
function searchBorrower() {
  const q = document.getElementById('searchBorrower').value.trim().toLowerCase();
  if (!q) return resetView();

  const borrowerIdx = headers.findIndex((h) => /nama peminjam/i.test(h));
  const matches = allRows.filter((r) => (r[borrowerIdx] || '').toLowerCase().includes(q));

  if (matches.length > 0) showBorrowerProfile(matches);
  else alert("Nama peminjam tidak ditemukan.");
}

/* ==========================================================
   === SEARCH LOGIC (GENERIC TABLE) ===
   ========================================================== */
function searchGeneric() {
  const q = document.getElementById('searchGeneric').value.trim().toLowerCase();
  if (!q) return resetView();

  filteredRows = allRows.filter((r) => r.join(' ').toLowerCase().includes(q));
  currentPage = 1;
  renderTable();
  updateDashboard();
}

/* ==========================================================
   === PROFILE VIEW (DETAIL PEMINJAM) ===
   ========================================================== */
function showBorrowerProfile(rows) {
  const profileView = document.getElementById('profileView');
  const tableWrapper = document.getElementById('tableWrapper');
  const pagination = document.getElementById('pagination');
  tableWrapper.style.display = 'none';
  pagination.style.display = 'none';
  profileView.style.display = 'block';

  // Column detection
  const nameIdx = headers.findIndex((h) => /nama peminjam/i.test(h));
  const genderIdx = headers.findIndex((h) => /kelamin|gender/i.test(h));
  const nikIdx = headers.findIndex((h) => /nik/i.test(h));
  const incomeIdx = headers.findIndex((h) => /penghasilan|pendapatan|income|gaji/i.test(h));
  const jobIdx = headers.findIndex((h) => /pekerjaan|job|work/i.test(h));
  const loanIdx = headers.findIndex((h) => /pinjaman|jumlah/i.test(h));
  const purposeIdx = headers.findIndex((h) => /tujuan|purpose/i.test(h));
  const tenorIdx = headers.findIndex((h) => /tenor/i.test(h));
  const startIdx = headers.findIndex((h) => /mulai|bayar/i.test(h));
  const endIdx = headers.findIndex((h) => /lunas|selesai/i.test(h));
  const rekeningIdx = headers.findIndex((h) => /rekening|account/i.test(h));
  const bankIdx = headers.findIndex((h) => /bank/i.test(h));

  const name = rows[0][nameIdx] || '-';
  const gender = rows[0][genderIdx] || '-';
  const nik = rows[0][nikIdx] || '-';
  const job = rows[0][jobIdx] || '-';
  const rekening = rows[0][rekeningIdx] || '-';
  const bank = rows[0][bankIdx] || '-';

  // Calculate stats
  const loans = rows.map((r) => parseVal(r[loanIdx]));
  const incomes = rows.map((r) => parseVal(r[incomeIdx]));
  const avgIncome =
    incomes.length > 0 ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0;
  const totalLoan = loans.reduce((a, b) => a + b, 0);
  const avgLoan = loans.length > 0 ? totalLoan / loans.length : 0;

  const mostPurpose = (() => {
    const freq = {};
    rows.forEach((r) => {
      const val = (r[purposeIdx] || '').trim();
      if (val) freq[val] = (freq[val] || 0) + 1;
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  })();

  const risk = calculateRisk(avgIncome, avgLoan, mostPurpose, job);

  /* === Build Loan History === */
  const sorted = rows.slice().sort((a, b) => {
    const da = parseDate(a[startIdx]);
    const db = parseDate(b[startIdx]);
    return (da || 0) - (db || 0);
  });

  let history =
    `<table><thead><tr><th>Tanggal Mulai Bayar</th><th>Tanggal Lunas</th><th>Jumlah</th><th>Tujuan</th><th>Tenor</th></tr></thead><tbody>`;
  let lastLunas = null;
  sorted.forEach((r) => {
    const start = parseDate(r[startIdx]);
    const end = parseDate(r[endIdx]);
    const overlap = lastLunas && start && end && start < lastLunas;
    const rowColor = overlap ? 'background:rgba(255,59,48,0.25)' : '';
    const warn = overlap ? '⚠️ ' : '';
    const tooltip = overlap
      ? 'title="Tanggal mulai bayar lebih awal dari tanggal lunas sebelumnya."'
      : '';
    history += `<tr style="${rowColor}" ${tooltip}>
      <td>${warn}${r[startIdx] || ''}</td>
      <td>${r[endIdx] || ''}</td>
      <td>${currency(parseVal(r[loanIdx]))}</td>
      <td>${r[purposeIdx] || ''}</td>
      <td>${r[tenorIdx] || ''}</td>
    </tr>`;
    if (end) lastLunas = end;
  });
  history += '</tbody></table>';

  // === Render Profile HTML ===
  profileView.innerHTML = `
    <h2>👤 Profil Peminjam</h2>
    <h3>${name}</h3>
    <p>${gender} • NIK: ${nik}</p>
    <p>Nomor Rekening: ${rekening} (${bank})</p>
    <p>Pekerjaan: ${job}</p>
    <hr style="border:1px solid rgba(255,255,255,0.2)">
    <h3>💰 Statistik Pinjaman</h3>
    <ul>
      <li>Total Pinjaman: <b>${currency(totalLoan)}</b></li>
      <li>Rata-rata Pinjaman: <b>${currency(avgLoan)}</b></li>
      <li>Rata-rata Penghasilan: <b>${currency(avgIncome)}</b></li>
      <li>Jumlah Transaksi: <b>${rows.length} kali</b></li>
      <li>Tujuan Paling Sering: <b>${mostPurpose}</b></li>
    </ul>
    <h3>⚖️ Risiko</h3>
    <p><span style="padding:6px 10px;border-radius:8px;background:${risk.color}">${risk.label}</span></p>
    <h3>🕓 Riwayat Pinjaman</h3>
    ${history}
    <button onclick="resetView()">⬅ Kembali ke Tabel Data</button>
  `;
}

/* ==========================================================
   === RISK SCORE LOGIC ===
   ========================================================== */
function calculateRisk(income, loan, purpose, job) {
  let score = 0;

  // 1. Income
  if (income < 3000000) score += 3;
  else if (income <= 10000000) score += 2;
  else score += 1;

  // 2. Ratio loan/income
  const ratio = income ? loan / income : 0;
  if (ratio < 1) score += 1;
  else if (ratio <= 2) score += 2;
  else score += 3;

  // 3. Purpose
  if (/konsum|belanja|hiburan/i.test(purpose)) score += 3;
  else if (/pendidikan|kesehatan/i.test(purpose)) score += 2;
  else if (/modal|usaha|investasi|bisnis/i.test(purpose)) score += 1;
  else score += 2;

  // 4. Job
  if (/ibu rumah tangga|irt|pengangguran|tidak punya pekerjaan/i.test(job))
    score += 3;
  else score += 1;

  const category =
    score >= 9
      ? { label: 'Tinggi 🔴', color: 'rgba(255,59,48,0.6)' }
      : score >= 6
      ? { label: 'Sedang 🟠', color: 'rgba(255,149,0,0.6)' }
      : { label: 'Rendah 🟢', color: 'rgba(52,199,89,0.6)' };
  return category;
}

/* ==========================================================
   === RESET VIEW ===
   ========================================================== */
function resetView() {
  document.getElementById('profileView').style.display = 'none';
  document.getElementById('tableWrapper').style.display = 'block';
  document.getElementById('pagination').style.display = 'flex';
  filteredRows = allRows;
  currentPage = 1;
  renderTable();
  updateDashboard();
}
