const sqlite3 = require('sqlite3').verbose();

// Veritabanı Bağlantısı
const db = new sqlite3.Database('ev_rota.db');

// Tabloları Oluştur
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS kullanicilar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ad_soyad TEXT,
            email TEXT UNIQUE,
            sifre TEXT,
            favori_arac_id TEXT DEFAULT '1',
            toplam_km REAL DEFAULT 0,
            kazanc_tl REAL DEFAULT 0,
            kurtarilan_co2_kg REAL DEFAULT 0
        )
    `);
});

// Veritabanı işlemleri için Promise sarmalayıcıları (Dışarı aktarılacak)
const dbGet = (query, params) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (query, params) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));

module.exports = { db, dbGet, dbRun };