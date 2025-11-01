/* ==========================================================
   DATABASE PEMINJAM v3.5 | Final Stable Edition
   ----------------------------------------------------------
   • Dual Search (Profil Peminjam vs Semua Kolom)
   • Multi-profile rendering (all matching borrowers)
   • Live "Profil Penanggung Jawab" dashboard summary
   • Total Peminjam = jumlah transaksi (rows)
   • Pastel highlight + fade animations inline
   ========================================================== */

/* ---------- CONFIGURATION ---------- */
const SHEET_ID = '1ANwgbJdxvSY4rB71njLUQvz7IBZYNTIOjfQk7rDAS2Q';
const RANGE = 'Form Responses 1!A:Z';
const API_KEY = 'AIzaSyBmY0s92IXmpmErmRoTyoSlH3oKQYAU5M4';
const PAGE_SIZE = 20;

/* ---------- GLOBALS ---------- */
let headers = [];
let allRows = [];
let filteredRows = [];
let currentPage = 1;

/* ==========================================================
   === INLINE STYLES (Pastel headers & fade-in) ===
   ========================================================== */
const style = document.createElement("style");
style.innerHTML = `
  .fade-in {opacity: 0; transform: translateY(10px); animation: fadeIn 0.7s ease forwards;}
  @keyframes fadeIn {to {opacity: 1; transform: translateY(0);}}
  .pastel-pill {
    display: inline-block; padding: 6px 12px; border-radius: 16px;
    font-weight: 600; color: #333; margin-bottom: 10px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  }
  hr.soft-divider {border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 40px 0;}
`;
document.head.appendChild(style);

/* ---------- HELPERS ---------- */
const currency = (num) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(num || 0);
const parseVal = (v) => parseInt((v || '').toString().replace(/[^0-9]/g, '')) || 0;
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
  }
}

/* ==========================================================
   === DASHBOARD SUMMARY (Reactive to Filters) ===
   ========================================================== */
function updateDashboard() {
  const ids = ['totalPeminjam', 'totalPinjaman', 'rataPenghasilan', 'tujuanTeratas'];
  if (!filteredRows || filteredRows.length === 0) {
    ids.forEach((id) => (document.getElementById(id).textContent = '-'));
    return;
  }

  const incIdx = headers.findIndex((h) => /penghasilan|pendapatan|income|gaji/i.test(h));
  const loanIdx = headers.findIndex((h) => /pinjaman|jumlah/i.test(h));
  const purpIdx = headers.findIndex((h) => /tujuan|purpose/i.test(h));

  const totalLoan = filteredRows.reduce((sum, r) => sum + parseVal(r[loanIdx]), 0);
  const incomes = filteredRows.map((r) => parseVal(r[incIdx])).filter((v) => v > 0);
  const avgIncome =
    incomes.length > 0 ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0;
  const freq = {};
  filteredRows.forEach((r) => {
    const val = (r[purpIdx] || '').trim();
    if (val) freq[val] = (freq[val] || 0) + 1;
  });
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  const updates = {
    totalPeminjam: filteredRows.length,
    totalPinjaman: currency(totalLoan),
    rataPenghasilan: currency(avgIncome),
    tujuanTeratas: top ? top[0] : '-',
  };

  for (const [id, val] of Object.entries(updates)) {
    const el = document.getElementById(id);
    el.textContent = val;
    el.classList.remove('fade-in');
    void el.offsetWidth;
    el.classList.add('fade-in');
  }
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
}

/* ==========================================================
   === SEARCH (Profil Peminjam Multi-profile) ===
   ========================================================== */
function searchBorrower() {
  const q = document.getElementById('searchBorrower').value.trim().toLowerCase();
  if (!q) return resetView();

  const borrowerIdx = headers.findIndex((h) => /nama peminjam/i.test(h));
  const matches = allRows.filter((r) => (r[borrowerIdx] || '').toLowerCase().includes(q));
  if (matches.length === 0) {
    alert("Nama peminjam tidak ditemukan.");
    return;
  }

  // Group by borrower name
  const grouped = {};
  matches.forEach((r) => {
    const name = (r[borrowerIdx] || '').trim();
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(r);
  });

  // Hide table and show profile view
  const profileView = document.getElementById('profileView');
  document.getElementById('tableWrapper').style.display = 'none';
  document.getElementById('pagination').style.display = 'none';
  profileView.style.display = 'block';

  const colors = ['#EBD4EF', '#D9F5E5', '#FFE5D4', '#D8EBF9', '#FAD4E0'];
  let colorIndex = 0;
  let html = '';

  for (const [name, rows] of Object.entries(grouped)) {
    const color = colors[colorIndex % colors.length];
    html += renderBorrowerProfile(name, rows, color);
    html += '<hr class="soft-divider">';
    colorIndex++;
  }
  html += `<button onclick="resetView()">⬅ Kembali ke Tabel Data</button>`;
  profileView.innerHTML = html;
}

/* ==========================================================
   === SEARCH (Generic Query + Dashboard Update) ===
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
   === PROFILE RENDERING (Single Borrower Section) ===
   ========================================================== */
function renderBorrowerProfile(name, rows, color) {
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
  const pjIdx = headers.findIndex((h) => /penanggung/i.test(h)); // <-- new

  const gender = rows[0][genderIdx] || '-';
  const nik = rows[0][nikIdx] || '-';
  const job = rows[0][jobIdx] || '-';
  const rekening = rows[0][rekeningIdx] || '-';
  const bank = rows[0][bankIdx] || '-';
  const penanggung = rows[0][pjIdx] || '-'; // <-- new

  const loans = rows.map((r) => parseVal(r[loanIdx]));
  const incomes = rows.map((r) => parseVal(r[incomeIdx]));
  const avgIncome =
    incomes.length > 0 ? incomes.reduce((a, b) => a + b, 0) / incomes.length : 0;
  const totalLoan = loans.reduce((a, b) => a + b, 0);
  const avgLoan = loans.length > 0 ? totalLoan / loans.length : 0;

  const freq = {};
  rows.forEach((r) => {
    const val = (r[purposeIdx] || '').trim();
    if (val) freq[val] = (freq[val] || 0) + 1;
  });
  const mostPurpose = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const risk = calculateRisk(avgIncome, avgLoan, mostPurpose, job);

  // --- Loan history table
  const sorted = rows.slice().sort((a, b) => {
    const da = parseDate(a[startIdx]);
    const db = parseDate(b[startIdx]);
    return (da || 0) - (db || 0);
  });
  let history = `<table><thead><tr><th>Tanggal Mulai Bayar</th><th>Tanggal Lunas</th><th>Jumlah</th><th>Tujuan</th><th>Tenor</th></tr></thead><tbody>`;
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

  return `
    <div class="fade-in">
      <h2><span class="pastel-pill" style="background:${color}">👤 Profil Peminjam</span></h2>
      <h3>${name}</h3>
      <p>${gender} • NIK: ${nik}</p>
      <p>Nomor Rekening: ${rekening} (${bank})</p>
      <p>Pekerjaan: ${job}</p>
      <p><b>Penanggung Jawab Peminjam:</b> ${penanggung}</p>
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
    </div>
  `;
}

/* ==========================================================
   === RISK SCORE LOGIC ===
   ========================================================== */
function calculateRisk(income, loan, purpose, job) {
  let score = 0;
  if (income < 3000000) score += 3;
  else if (income <= 10000000) score += 2;
  else score += 1;

  const ratio = income ? loan / income : 0;
  if (ratio < 1) score += 1;
  else if (ratio <= 2) score += 2;
  else score += 3;

  if (/konsum|belanja|hiburan/i.test(purpose)) score += 3;
  else if (/pendidikan|kesehatan/i.test(purpose)) score += 2;
  else if (/modal|usaha|investasi|bisnis/i.test(purpose)) score += 1;
  else score += 2;

  if (/ibu rumah tangga|irt|pengangguran|tidak punya pekerjaan/i.test(job)) score += 3;
  else score += 1;

  return score >= 9
    ? { label: 'Tinggi 🔴', color: 'rgba(255,59,48,0.6)' }
    : score >= 6
    ? { label: 'Sedang 🟠', color: 'rgba(255,149,0,0.6)' }
    : { label: 'Rendah 🟢', color: 'rgba(52,199,89,0.6)' };
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

  /* ==========================================================
   === PAGINATION LOGIC ===
   ========================================================== */
function changePage(step) {
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  currentPage += step;
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  renderTable();
  updatePagination();
}

function updatePagination() {
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const indicator = document.getElementById('pageIndicator');
  if (!indicator) return;
  indicator.textContent = `Halaman ${currentPage} dari ${totalPages}`;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;
}

/* Call this after renderTable() */
const oldRenderTable = renderTable;
renderTable = function () {
  oldRenderTable();
  updatePagination();
};
}
