/* =============================================================
   Han Repair - Sistem Informasi Akuntansi Bengkel Motor
   Engine bersama: autentikasi, penyimpanan data (localStorage),
   tata letak (sidebar/topbar), dan perhitungan laporan.
   ============================================================= */
window.Han = (function () {
    "use strict";

    var KEYS = {
        users: "han_users",
        session: "han_session",
        barang: "han_barang",
        masuk: "han_masuk",
        keluar: "han_keluar",
        beban: "han_beban"
    };

    var NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    var NAMA_BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    /* ------------------------- Penyimpanan ------------------------- */
    /* Jika dijalankan di WordPress (plugin Han Repair), window.HAN_REPAIR
       berisi { api, nonce, data }. Data akan disinkronkan ke database
       WordPress melalui REST API. Tanpa konfigurasi tersebut, seluruh data
       disimpan di localStorage browser (mode statis). */
    var remote = (typeof window !== "undefined" && window.HAN_REPAIR) ? window.HAN_REPAIR : null;
    var COLLECTION = {
        "han_barang": "barang",
        "han_masuk": "masuk",
        "han_keluar": "keluar",
        "han_beban": "beban"
    };
    var applyingRemote = false;

    function read(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }
    function write(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
        if (!applyingRemote && remote && remote.api && COLLECTION[key]) {
            pushRemote(COLLECTION[key], val);
        }
    }
    function pushRemote(collection, items) {
        try {
            window.fetch(remote.api + collection, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-WP-Nonce": remote.nonce || "" },
                body: JSON.stringify({ items: items })
            });
        } catch (e) { /* offline: data tetap tersimpan di localStorage */ }
    }
    function applyRemoteData() {
        if (!remote || !remote.data) return;
        applyingRemote = true;
        Object.keys(COLLECTION).forEach(function (key) {
            var name = COLLECTION[key];
            if (Array.isArray(remote.data[name])) write(key, remote.data[name]);
        });
        applyingRemote = false;
    }

    /* ------------------------- Utilitas ---------------------------- */
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function num(v) {
        var n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }
    function money(v) {
        return "Rp " + Math.round(num(v)).toLocaleString("id-ID");
    }
    function todayISO() { return toISO(new Date()); }
    function toISO(d) {
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return d.getFullYear() + "-" + m + "-" + day;
    }
    function fmtDate(iso) {
        if (!iso) return "-";
        var p = String(iso).split("-");
        if (p.length !== 3) return iso;
        return parseInt(p[2], 10) + " " + NAMA_BULAN_SINGKAT[parseInt(p[1], 10) - 1] + " " + p[0];
    }
    function monthLabel(key) {
        var p = key.split("-");
        return NAMA_BULAN_SINGKAT[parseInt(p[1], 10) - 1] + " " + p[0].slice(2);
    }
    function firstDayOfMonth() {
        var d = new Date();
        return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    /* --------------------------- Seed data ------------------------- */
    /* Data sengaja dikosongkan. Yang dibuat hanya akun login default
       agar pemilik bengkel dapat masuk pertama kali. */
    function seed() {
        if (!localStorage.getItem(KEYS.users)) {
            write(KEYS.users, [{
                username: "admin", password: "admin",
                nama: "Pemilik Han Repair", role: "Admin"
            }]);
        }
        applyRemoteData();
    }

    /* --------------------------- Barang ---------------------------- */
    function listBarang() { return read(KEYS.barang, []); }
    function saveBarangList(list) { write(KEYS.barang, list); }
    function getBarang(kode) {
        var list = listBarang();
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].kode) === String(kode)) return list[i];
        }
        return null;
    }
    function isJasa(b) { return b && String(b.kategori || "").toLowerCase() === "jasa"; }
    function totalMasuk(kode) {
        return read(KEYS.masuk, []).reduce(function (s, m) {
            return String(m.kode) === String(kode) ? s + num(m.jumlah) : s;
        }, 0);
    }
    function totalKeluar(kode) {
        return read(KEYS.keluar, []).reduce(function (s, k) {
            return String(k.kode) === String(kode) ? s + num(k.jumlah) : s;
        }, 0);
    }
    function stokOf(kode) {
        var b = getBarang(kode);
        if (!b || isJasa(b)) return 0;
        return num(b.stokAwal) + totalMasuk(kode) - totalKeluar(kode);
    }
    function statusStok(b) {
        if (isJasa(b)) return { label: "Jasa", cls: "secondary" };
        var stok = stokOf(b.kode);
        if (stok <= 0) return { label: "Habis", cls: "danger" };
        if (stok <= num(b.stokMin)) return { label: "Menipis", cls: "warning" };
        return { label: "Aman", cls: "success" };
    }

    /* ------------------------- Transaksi --------------------------- */
    function listMasuk() { return read(KEYS.masuk, []); }
    function listKeluar() { return read(KEYS.keluar, []); }
    function listBeban() { return read(KEYS.beban, []); }

    /* --------------------------- Laporan --------------------------- */
    function inRange(tanggal, from, to) {
        if (from && tanggal < from) return false;
        if (to && tanggal > to) return false;
        return true;
    }
    function labaRugi(from, to) {
        var keluar = listKeluar().filter(function (k) { return inRange(k.tanggal, from, to); });
        var pendapatan = 0, hpp = 0;
        keluar.forEach(function (k) {
            pendapatan += num(k.jumlah) * num(k.hargaJual);
            hpp += num(k.jumlah) * num(k.hpp);
        });
        var beban = listBeban()
            .filter(function (b) { return inRange(b.tanggal, from, to); })
            .reduce(function (s, b) { return s + num(b.jumlah); }, 0);
        var labaKotor = pendapatan - hpp;
        return {
            pendapatan: pendapatan,
            hpp: hpp,
            labaKotor: labaKotor,
            beban: beban,
            labaBersih: labaKotor - beban,
            transaksi: keluar.length
        };
    }

    function monthlySeries(jumlahBulan) {
        var series = { labels: [], masuk: [], keluar: [] };
        var now = new Date();
        for (var i = jumlahBulan - 1; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            var key = toISO(d).slice(0, 7);
            series.labels.push(monthLabel(key));
            var masuk = listMasuk().filter(function (m) { return String(m.tanggal).slice(0, 7) === key; })
                .reduce(function (s, m) { return s + num(m.jumlah) * num(m.hargaBeli); }, 0);
            var keluar = listKeluar().filter(function (k) { return String(k.tanggal).slice(0, 7) === key; })
                .reduce(function (s, k) { return s + num(k.jumlah) * num(k.hargaJual); }, 0);
            series.masuk.push(masuk);
            series.keluar.push(keluar);
        }
        return series;
    }

    /* -------------------------- Autentikasi ------------------------ */
    function currentUser() { return read(KEYS.session, null); }
    function login(username, password) {
        var users = read(KEYS.users, []);
        for (var i = 0; i < users.length; i++) {
            if (users[i].username === username && users[i].password === password) {
                write(KEYS.session, {
                    username: users[i].username,
                    nama: users[i].nama,
                    role: users[i].role,
                    loginAt: new Date().toISOString()
                });
                return true;
            }
        }
        return false;
    }
    function logout() {
        localStorage.removeItem(KEYS.session);
        window.location.replace("login.html");
    }
    function requireLogin() {
        if (!currentUser()) {
            window.location.replace("login.html");
            return false;
        }
        return true;
    }

    /* ---------------------------- Layout --------------------------- */
    var MENU = [
        { type: "link", href: "index.html", icon: "fa-tachometer-alt", text: "Dashboard" },
        { type: "heading", text: "Transaksi" },
        { type: "link", href: "barang-masuk.html", icon: "fa-arrow-down", text: "Barang Masuk" },
        { type: "link", href: "barang-keluar.html", icon: "fa-arrow-up", text: "Barang Keluar" },
        { type: "heading", text: "Data & Stok" },
        { type: "link", href: "barang.html", icon: "fa-boxes", text: "Data Barang" },
        { type: "link", href: "stok.html", icon: "fa-warehouse", text: "Stok Barang" },
        { type: "heading", text: "Laporan" },
        { type: "link", href: "laporan.html", icon: "fa-file-invoice-dollar", text: "Laba Rugi" }
    ];

    /* Logo dibuat menempel (inline SVG) supaya tidak hilang walau file
       gambar/ikon eksternal gagal dimuat, mis. saat dipasang di WordPress. */
    var BRAND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" style="width:1.9rem;height:1.9rem;">' +
        '<circle cx="5.5" cy="17.5" r="3.5"></circle>' +
        '<circle cx="18.5" cy="17.5" r="3.5"></circle>' +
        '<path d="M5.5 17.5h4l3-6h4l2 3.5"></path>' +
        '<path d="M9 11.5 7.5 9h-2"></path>' +
        '<path d="M14.5 11.5 16 9h2.5"></path></svg>';

    var AVATAR_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="8" r="4" fill="#b7b9cc"/>' +
        '<path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" fill="#b7b9cc"/></svg>'
    );

    function buildSidebar(active) {
        var html = "";
        html += '<a class="sidebar-brand d-flex align-items-center justify-content-center" href="index.html">' +
            '<div class="sidebar-brand-icon">' + BRAND_SVG + '</div>' +
            '<div class="sidebar-brand-text mx-3">Han Repair</div></a>';
        html += '<hr class="sidebar-divider my-0">';
        MENU.forEach(function (item) {
            if (item.type === "heading") {
                html += '<div class="sidebar-heading">' + escapeHtml(item.text) + '</div>';
                return;
            }
            var isActive = item.href === active;
            html += '<li class="nav-item' + (isActive ? " active" : "") + '">' +
                '<a class="nav-link" href="' + item.href + '">' +
                '<i class="fas fa-fw ' + item.icon + '"></i>' +
                '<span>' + escapeHtml(item.text) + '</span></a></li>';
        });
        html += '<hr class="sidebar-divider d-none d-md-block">' +
            '<div class="text-center d-none d-md-inline">' +
            '<button class="rounded-circle border-0" id="sidebarToggle"></button></div>';
        return html;
    }

    function lowStockCount() {
        return listBarang().filter(function (b) {
            if (isJasa(b)) return false;
            return stokOf(b.kode) <= num(b.stokMin);
        }).length;
    }

    function buildTopbar(user) {
        var low = lowStockCount();
        var nama = user ? escapeHtml(user.nama || user.username) : "Pengguna";
        var role = user ? escapeHtml(user.role || "") : "";
        return '<button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">' +
            '<i class="fa fa-bars"></i></button>' +
            '<div class="d-none d-sm-inline-block mr-auto ml-md-3 my-2 my-md-0">' +
            '<span class="h6 mb-0 text-gray-800 font-weight-bold">Sistem Informasi Akuntansi &mdash; Bengkel Motor Han Repair</span></div>' +
            '<ul class="navbar-nav ml-auto">' +
            '<li class="nav-item dropdown no-arrow mx-1">' +
            '<a class="nav-link dropdown-toggle" href="stok.html" title="Peringatan stok">' +
            '<i class="fas fa-bell fa-fw"></i>' +
            (low > 0 ? '<span class="badge badge-danger badge-counter">' + low + '</span>' : '') +
            '</a></li>' +
            '<div class="topbar-divider d-none d-sm-block"></div>' +
            '<li class="nav-item dropdown no-arrow">' +
            '<a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown">' +
            '<span class="mr-2 d-none d-lg-inline text-gray-600 small">' + nama + '</span>' +
            '<img class="img-profile rounded-circle" src="' + AVATAR_SRC + '"></a>' +
            '<div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="userDropdown">' +
            '<a class="dropdown-item" href="#" data-toggle="modal" data-target="#logoutModal">' +
            '<i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>Logout</a></div></li></ul>';
    }

    function logoutModal(user) {
        return '<div class="modal fade" id="logoutModal" tabindex="-1" role="dialog" aria-hidden="true">' +
            '<div class="modal-dialog" role="document"><div class="modal-content">' +
            '<div class="modal-header"><h5 class="modal-title">Konfirmasi Logout</h5>' +
            '<button class="close" type="button" data-dismiss="modal"><span>&times;</span></button></div>' +
            '<div class="modal-body">Anda yakin ingin keluar dari sistem?</div>' +
            '<div class="modal-footer"><button class="btn btn-secondary" type="button" data-dismiss="modal">Batal</button>' +
            '<button class="btn btn-primary" type="button" id="btnLogout">Logout</button></div>' +
            '</div></div></div>';
    }

    function layout(active) {
        if (!requireLogin()) return;
        var user = currentUser();
        var $sidebar = $("#accordionSidebar");
        if (!$sidebar.children(".sidebar-brand").length) {
            $sidebar.html(buildSidebar(active));
        }
        $("#topbar").html(buildTopbar(user));
        $("#logout-modal").html(logoutModal(user));
        $("#footerYear").text(new Date().getFullYear());
        bindChrome();
    }

    function bindChrome() {
        $(document).on("click.han", "#sidebarToggle, #sidebarToggleTop", function () {
            $("body").toggleClass("sidebar-toggled");
            $(".sidebar").toggleClass("toggled");
        });
        $(document).on("click.han", "#btnLogout", function () { logout(); });
        $(document).on("scroll.han", function () {
            if ($(this).scrollTop() > 100) $(".scroll-to-top").fadeIn();
            else $(".scroll-to-top").fadeOut();
        });
        $(document).on("click.han", "a.scroll-to-top", function (e) {
            e.preventDefault();
            $("html, body").stop().animate({ scrollTop: 0 }, 400);
        });
    }

    /* -------------------- Helper untuk halaman --------------------- */
    function barangOptions(selected, hanyaStok) {
        var html = '<option value="">-- Pilih Barang --</option>';
        listBarang().forEach(function (b) {
            if (hanyaStok && isJasa(b)) { /* jasa tetap boleh */ }
            html += '<option value="' + escapeHtml(b.kode) + '"' +
                (String(b.kode) === String(selected) ? " selected" : "") + '>' +
                escapeHtml(b.kode + " - " + b.nama) + '</option>';
        });
        return html;
    }

    return {
        KEYS: KEYS,
        seed: seed,
        read: read,
        write: write,
        uid: uid,
        num: num,
        money: money,
        todayISO: todayISO,
        fmtDate: fmtDate,
        monthLabel: monthLabel,
        firstDayOfMonth: firstDayOfMonth,
        escapeHtml: escapeHtml,
        listBarang: listBarang,
        saveBarangList: saveBarangList,
        getBarang: getBarang,
        isJasa: isJasa,
        stokOf: stokOf,
        totalMasuk: totalMasuk,
        totalKeluar: totalKeluar,
        statusStok: statusStok,
        listMasuk: listMasuk,
        listKeluar: listKeluar,
        listBeban: listBeban,
        labaRugi: labaRugi,
        monthlySeries: monthlySeries,
        currentUser: currentUser,
        login: login,
        logout: logout,
        requireLogin: requireLogin,
        layout: layout,
        barangOptions: barangOptions
    };
})();

Han.seed();
