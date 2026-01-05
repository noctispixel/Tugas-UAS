/* =========================
   CONSTANTS & KEYS
========================= */
const ORDER_KEY = 'buahperkilo_order';
const ROLE_KEY = 'buahperkilo_role';
const PRODUK_KEY = 'buahperkilo_produk';

/* =========================
   LOCAL STORAGE HELPER (ORDER)
========================= */
function saveOrder(order) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  currentOrder = order;
}

function loadOrder() {
  const data = localStorage.getItem(ORDER_KEY);
  const parsed = data ? JSON.parse(data) : null;
  if (parsed) currentOrder = parsed;
  return parsed;
}

function clearOrder() {
  localStorage.removeItem(ORDER_KEY);
  currentOrder = null;
}

/* =========================
   LOCAL STORAGE HELPER (PRODUK)
========================= */
const defaultProducts = [
  { id: 1, nama: 'Apel Merah', harga: 25000, stok: 50, img: 'https://via.placeholder.com/150' },
  { id: 2, nama: 'Pisang Cavendish', harga: 15000, stok: 100, img: 'https://via.placeholder.com/150' },
  { id: 3, nama: 'Jeruk Medan', harga: 20000, stok: 30, img: 'https://via.placeholder.com/150' }
];

function loadProducts() {
  const data = localStorage.getItem(PRODUK_KEY);
  return data ? JSON.parse(data) : defaultProducts;
}

function saveProducts(products) {
  localStorage.setItem(PRODUK_KEY, JSON.stringify(products));
}

/* =========================
   STATE MANAGEMENT
========================= */
let currentRole = null; 
let cart = [];
let currentOrder = null;
let qty = 1;
let lastKnownStatus = null; 
let pollingInterval = null;
let skipFormReset = false; // Flag khusus mode Edit

/* =========================
   CHAT STATE (Mock Data)
========================= */
let chatMessages = [
  { from: 'penjual', text: 'Halo, buah kami dipanen segar setiap pagi.', time: '09:30' },
  { from: 'pembeli', text: 'Apakah apel merah ready stok?', time: '09:31' },
  { from: 'penjual', text: 'Ready kak, silakan diorder.', time: '09:32' }
];

/* =========================
   AUTH & ROLE
========================= */
function setRole(role) {
  currentRole = role;
  localStorage.setItem(ROLE_KEY, role);
  loadOrder(); 
}

function getRole() {
  if (!currentRole) {
    currentRole = localStorage.getItem(ROLE_KEY);
  }
  return currentRole;
}

function clearRole() {
  currentRole = null;
  localStorage.removeItem(ROLE_KEY);
}

function proteksiNavbar() {
  const role = getRole();
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;

  activePage.querySelectorAll('nav button').forEach(btn => {
    const allowedRole = btn.dataset.role;
    if (!allowedRole || allowedRole === role) {
      btn.style.display = 'inline-flex';
    } else {
      btn.style.display = 'none';
    }
  });
}

/* =========================
   NAVIGASI (GO)
========================= */
function loginPembeli() { setRole('pembeli'); go('home'); }
function loginPenjual() { setRole('penjual'); go('petani-dashboard'); }

function go(id) {
  const page = document.getElementById(id);
  if (!page) return;

  const role = getRole();
  const allowedRole = page.dataset.role;

  if (allowedRole && role !== allowedRole) {
    alert('Anda tidak memiliki akses ke halaman ini');
    return;
  }

  stopPolling();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  page.classList.add('active');

  if (role) {
    proteksiNavbar();
    updateNavbar(id);
  }

  loadOrder();

  // --- LOGIC PER HALAMAN ---
  
  if (id === 'keranjang') renderKeranjang();
  
  if (id === 'pesanan') {
    renderPesanan();
    lastKnownStatus = currentOrder?.status;
    startPolling('pesanan');
  }
  
  if (id === 'petani-dashboard') {
    renderPesananPetani();
    startPolling('petani-dashboard');
  }
  
  if (id === 'petani-produk') {
    renderProdukSaya();
  }

  if (id === 'petani-tambah') {
    if (!skipFormReset) {
      tambahBaru(false);
    } else {
      skipFormReset = false;
    }
  }

  // LOGIC RENDER CHAT (PENTING)
  if (id === 'chat-detail') {
    renderChat('#chat-detail .chat-body', 'pembeli');
  }
  
  if (id === 'petani-chat-detail') {
    // Menggunakan ID baru dari HTML terakhir (#petaniChatBody)
    renderChat('#petaniChatBody', 'penjual');
  }

  window.scrollTo(0, 0);
}

function updateNavbar(pageId) {
  const navMap = ['home', 'pesanan', 'chat-list', 'profil'];
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const nav = activePage.querySelector('nav');
  if (!nav) return;
  nav.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  const index = navMap.indexOf(pageId);
  if (index !== -1) {
    nav.querySelectorAll('button')[index]?.classList.add('active');
  }
}

/* =========================
   MANAJEMEN PRODUK
========================= */
function renderProdukSaya() {
  const list = document.getElementById('listProdukPetani');
  const products = loadProducts();
  
  if (!list) return;
  list.innerHTML = '';

  products.forEach(p => {
    list.innerHTML += `
      <div class="produk-card" style="border:1px solid #ddd; padding:10px; border-radius:8px; background:white;">
        <img src="${p.img}" alt="${p.nama}" style="width:100%; height:100px; object-fit:cover; border-radius:4px;">
        <h4 style="margin:10px 0 5px;">${p.nama}</h4>
        <p style="color:#4CAF50; font-weight:bold;">Rp ${p.harga.toLocaleString('id-ID')} / kg</p>
        <p style="font-size:0.9em; color:#666;">Stok: ${p.stok} kg</p>
        <button onclick="editProduk(${p.id})" style="width:100%; margin-top:10px; background:#FF9800; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer;">✏️ Edit</button>
      </div>
    `;
  });
}

function tambahBaru(redirect = true) {
  document.getElementById('editId').value = ''; 
  document.getElementById('inputNamaProduk').value = '';
  document.getElementById('inputHargaProduk').value = '';
  document.getElementById('inputStokProduk').value = '';
  document.getElementById('inputImgProduk').value = 'https://via.placeholder.com/150';
  
  const judul = document.getElementById('judulFormProduk');
  if(judul) judul.innerText = 'Tambah Produk Baru';
  
  const btnHapus = document.getElementById('btnHapus');
  if(btnHapus) btnHapus.style.display = 'none';
  
  if (redirect) go('petani-tambah');
}

function editProduk(id) {
  const products = loadProducts();
  const produk = products.find(p => p.id === id);
  
  if (produk) {
    document.getElementById('editId').value = produk.id;
    document.getElementById('inputNamaProduk').value = produk.nama;
    document.getElementById('inputHargaProduk').value = produk.harga;
    document.getElementById('inputStokProduk').value = produk.stok;
    document.getElementById('inputImgProduk').value = produk.img;
    
    const judul = document.getElementById('judulFormProduk');
    if(judul) judul.innerText = 'Edit Produk';
    
    const btnHapus = document.getElementById('btnHapus');
    if(btnHapus) btnHapus.style.display = 'block';
    
    skipFormReset = true;
    go('petani-tambah');
  }
}

function simpanProduk() {
  const idInput = document.getElementById('editId').value;
  const nama = document.getElementById('inputNamaProduk').value;
  const harga = parseInt(document.getElementById('inputHargaProduk').value);
  const stok = parseInt(document.getElementById('inputStokProduk').value);
  const img = document.getElementById('inputImgProduk').value || 'https://via.placeholder.com/150';

  if (!nama || !harga) {
    alert('Nama dan Harga wajib diisi!');
    return;
  }

  let products = loadProducts();

  if (idInput) {
    // UPDATE
    const index = products.findIndex(p => p.id == idInput);
    if (index !== -1) {
      products[index] = { id: parseInt(idInput), nama, harga, stok, img };
      alert('Produk berhasil diperbarui!');
    }
  } else {
    // CREATE
    const newId = Date.now();
    products.push({ id: newId, nama, harga, stok, img });
    alert('Produk baru berhasil ditambahkan!');
  }

  saveProducts(products);
  go('petani-produk');
}

function hapusProduk() {
  const idInput = document.getElementById('editId').value;
  if (!idInput) return;

  if (confirm('Yakin ingin menghapus produk ini?')) {
    let products = loadProducts();
    products = products.filter(p => p.id != idInput);
    saveProducts(products);
    alert('Produk dihapus.');
    go('petani-produk');
  }
}

/* =========================
   POLLING SYSTEM
========================= */
function startPolling(pageId) {
  stopPolling();
  
  if (pageId === 'pesanan') {
    pollingInterval = setInterval(() => {
      const freshOrder = loadOrder();
      if (freshOrder && freshOrder.status !== lastKnownStatus) {
        lastKnownStatus = freshOrder.status;
        renderPesanan();
        showNotification(`Status pesanan: ${freshOrder.status}`);
      }
    }, 2000);
  } else if (pageId === 'petani-dashboard') {
    pollingInterval = setInterval(() => {
      const freshOrder = loadOrder();
      if (freshOrder) {
        renderPesananPetani();
      }
    }, 3000);
  }
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function showNotification(message) {
  const notif = document.createElement('div');
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white;
    padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999; animation: slideIn 0.3s ease;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

/* =========================
   LOGIC TRANSAKSI
========================= */
function tambah() { qty++; updateQty(); }
function kurang() { if (qty > 1) { qty--; updateQty(); } }
function updateQty() { 
  const el = document.getElementById('qty');
  if(el) el.innerText = qty; 
}

function tambahKeranjang() {
  const produk = {
    id: 'apel-merah', nama: 'Apel Merah', harga: 25000, qty: qty,
    img: 'https://via.placeholder.com/80'
  };
  const exist = cart.find(p => p.id === produk.id);
  if (exist) exist.qty += qty;
  else cart.push(produk);
  qty = 1;
  updateQty();
  go('keranjang');
}

function renderKeranjang() {
  const list = document.getElementById('keranjangList');
  const totalEl = document.getElementById('keranjangTotal');
  if (!list) return;
  list.innerHTML = '';
  let total = 0;
  if (!cart.length) {
    list.innerHTML = '<p style="text-align:center; padding:2rem; color:#999;">Keranjang kosong</p>';
    totalEl.innerText = 'Rp 0';
    return;
  }
  cart.forEach((item, i) => {
    total += item.qty * item.harga;
    list.innerHTML += `
      <div class="pesanan-card">
        <img src="${item.img}" alt="${item.nama}">
        <div class="pesanan-info">
          <h4>${item.nama}</h4>
          <p>${item.qty} kg x Rp ${item.harga.toLocaleString('id-ID')}</p>
          <button onclick="hapusItem(${i})" style="color:red; margin-top:5px;">Hapus</button>
        </div>
      </div>`;
  });
  totalEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function hapusItem(i) {
  cart.splice(i, 1);
  renderKeranjang();
}

function checkout() {
  if (!cart.length) {
    alert('Keranjang kosong');
    return;
  }
  const newOrder = {
    items: [...cart],
    status: 'Diproses',
    tanggal: new Date().toLocaleDateString('id-ID'),
    sellerConfirmed: false
  };
  saveOrder(newOrder);
  cart = [];
  alert('Pesanan berhasil dibuat!');
  go('pesanan');
}

/* =========================
   RENDER VIEW: PEMBELI
========================= */
function renderPesanan() {
  currentOrder = loadOrder();
  const listContainer = document.getElementById('pesananList');
  const section = document.getElementById('pesanan');
  
  if (!currentOrder || !listContainer) {
    if (listContainer) listContainer.innerHTML = '<p style="text-align:center; color:#888; margin-top:20px;">Belum ada pesanan aktif</p>';
    const badge = section?.querySelector('.badge');
    const totalEl = section?.querySelector('.total h3');
    if (badge) badge.style.display = 'none';
    if (totalEl) totalEl.innerText = 'Rp 0';
    return;
  }

  listContainer.innerHTML = '';
  let total = 0;
  currentOrder.items.forEach(item => {
    total += item.qty * item.harga;
    listContainer.innerHTML += `
      <div class="pesanan-card">
        <img src="${item.img}" alt="${item.nama}">
        <div class="pesanan-info">
          <h4>${item.nama}</h4>
          <p>${item.qty} kg x Rp ${item.harga.toLocaleString('id-ID')}</p>
          <strong>Total: Rp ${(item.qty * item.harga).toLocaleString('id-ID')}</strong>
        </div>
      </div>
    `;
  });
  
  const badge = section.querySelector('.badge');
  if (badge) {
    badge.style.display = 'inline-block';
    badge.innerText = currentOrder.status;
    badge.className = 'badge ' + (currentOrder.status === 'Diproses' ? 'proses' : currentOrder.status === 'Dikirim' ? 'dikirim' : 'selesai');
  }
  const totalEl = section.querySelector('.total h3');
  if (totalEl) totalEl.innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

/* =========================
   RENDER VIEW: PETANI
========================= */
function renderPesananPetani() {
  const box = document.getElementById('petaniPesananList');
  const countEl = document.getElementById('pesananMasukCount');
  if (!box) return;
  const order = loadOrder();
  currentOrder = order;

  if (!order) {
    box.innerHTML = '<p style="text-align:center; padding:2rem; color:#999; font-style:italic;">Belum ada pesanan masuk</p>';
    if (countEl) { countEl.innerText = '0'; countEl.style.background = '#ccc'; }
    return;
  }

  let total = 0;
  let itemsHTML = '';
  order.items.forEach(item => {
    total += item.qty * item.harga;
    itemsHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px dashed #eee; padding-bottom:5px;"><span>${item.nama} <small>(${item.qty} kg)</small></span><strong>Rp ${(item.qty * item.harga).toLocaleString('id-ID')}</strong></div>`;
  });

  let aksi = '', labelKartu = '', warnaBorder = '';
  if (order.status === 'Diproses') {
    labelKartu = '⚡ PESANAN BARU'; warnaBorder = '2px solid #ff9800';
    aksi = `<button onclick="konfirmasiPengiriman()" style="background:#4CAF50; color:white; width:100%; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:15px;">✅ Konfirmasi Kirim</button>`;
  } else if (order.status === 'Dikirim') {
    labelKartu = '📦 SEDANG DIKIRIM'; warnaBorder = '2px solid #2196F3';
    aksi = `<p style="color:#2196F3; font-weight:bold; text-align:center; margin-top:15px; background:#e3f2fd; padding:10px; border-radius:8px;">Sedang dalam perjalanan...</p>`;
  } else {
    labelKartu = '✓ SELESAI'; warnaBorder = '2px solid #4CAF50';
    aksi = `<p style="color:#4CAF50; font-weight:bold; text-align:center; margin-top:15px;">Transaksi Selesai</p>`;
  }

  box.innerHTML = `
    <div class="pesanan-card" style="border: ${warnaBorder}; padding: 0; overflow:hidden; border-radius: 12px; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
      <div style="background:${order.status === 'Diproses' ? '#fff3e0' : '#f5f5f5'}; padding: 10px 15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; color:${order.status === 'Diproses' ? '#e65100' : '#333'};">${labelKartu}</h4>
        <small style="color:#666;">${order.tanggal || 'Hari ini'}</small>
      </div>
      <div style="padding: 15px;">
        <div style="margin-bottom:15px;">${itemsHTML}</div>
        <div style="display:flex; justify-content:space-between; font-size:1.2em; margin-top:10px;"><span>Total</span><strong style="color:#4CAF50;">Rp ${total.toLocaleString('id-ID')}</strong></div>
        ${aksi}
      </div>
    </div>`;
  
  if (countEl) { countEl.innerText = '1'; countEl.style.background = '#ff9800'; }
}

function konfirmasiPengiriman() {
  const order = loadOrder();
  if (!order) return;
  order.status = 'Dikirim';
  saveOrder(order);
  alert('Pesanan dikonfirmasi dan status diubah jadi DIKIRIM');
  renderPesananPetani();
  setTimeout(() => {
    const freshOrder = loadOrder();
    if (freshOrder && freshOrder.status === 'Dikirim') {
      freshOrder.status = 'Selesai';
      saveOrder(freshOrder);
      const dashboard = document.getElementById('petani-dashboard');
      if (dashboard.classList.contains('active')) {
         renderPesananPetani();
         showNotification('Pesanan telah sampai ke pembeli!');
      }
    }
  }, 10000);
}

/* =========================
   LOGIC CHAT (FINAL)
========================= */
function renderChat(selector, viewerRole) {
  const chatBody = document.querySelector(selector);
  if (!chatBody) return;
  
  chatBody.innerHTML = ''; // Clear chat lama
  
  chatMessages.forEach(msg => {
    const bubble = document.createElement('div');
    
    // Logic Posisi Bubble:
    // Jika saya 'viewerRole', pesan dari saya sendiri harus di KANAN.
    // Pesan dari role lain harus di KIRI.
    const isMe = (msg.from === viewerRole);
    
    bubble.className = isMe ? 'bubble kanan' : 'bubble kiri';
    bubble.textContent = msg.text;
    
    // Timestamp
    const time = document.createElement('div');
    time.style.fontSize = '0.7em';
    time.style.opacity = '0.6';
    time.style.textAlign = 'right'; 
    time.style.marginTop = '4px';
    time.innerText = msg.time;
    
    bubble.appendChild(time);
    chatBody.appendChild(bubble);
  });
  
  chatBody.scrollTop = chatBody.scrollHeight;
}

// Fungsi Kirim Pesan PEMBELI
function kirim() {
  const input = document.getElementById('pesan');
  const text = input.value;
  if (!text) return;

  chatMessages.push({
    from: 'pembeli',
    text: text,
    time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})
  });

  input.value = ''; 
  renderChat('#chat-detail .chat-body', 'pembeli');
  
  // Balasan Otomatis
  setTimeout(() => {
    chatMessages.push({ from: 'penjual', text: 'Baik, mohon ditunggu sebentar ya kak.', time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) });
    const activePage = document.querySelector('.page.active').id;
    if(activePage === 'chat-detail') renderChat('#chat-detail .chat-body', 'pembeli');
  }, 1500);
}

// Fungsi Kirim Pesan PETANI
function kirimPetani() {
  const input = document.getElementById('inputPesanPetani');
  const text = input.value;
  if (!text) return;

  chatMessages.push({
    from: 'penjual',
    text: text,
    time: new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})
  });

  input.value = ''; 
  // Gunakan ID body chat petani yang baru
  renderChat('#petaniChatBody', 'penjual');
}

/* =========================
   LAIN-LAIN
========================= */
function simpanProfil() { alert('Profil berhasil disimpan'); go('profil'); }
function bayar() { if (!currentOrder) return; alert('Pembayaran berhasil!'); }
function logout() {
  if (confirm('Yakin ingin keluar?')) {
    stopPolling(); clearRole(); go('splash');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadOrder();
  const role = getRole();
  if (!role) { go('splash'); } 
  else { role === 'pembeli' ? go('home') : go('petani-dashboard'); }
});