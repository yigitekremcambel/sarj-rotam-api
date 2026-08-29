const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ---------------- VERİTABANI BAĞLANTISI ----------------
const db = new sqlite3.Database('ev_rota.db');

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

// Veritabanı işlemleri için Promise sarmalayıcıları
const dbGet = (query, params) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (query, params) => new Promise((resolve, reject) => db.run(query, params, function(err) { err ? reject(err) : resolve(this) }));

// ---------------- YEDEK VERİLER VE YARDIMCI FONKSİYONLAR ----------------
const DEV_YEDEK_LISTE = [
    {id: "1", marka: "BYD", model: "Sealion 7 (Arkadan İtişli)", batarya_kwh: 82.5, tuketim: 18},
    {id: "2", marka: "BYD", model: "Atto 3", batarya_kwh: 60.4, tuketim: 16},
    {id: "5", marka: "Togg", model: "T10X (Uzun Menzil)", batarya_kwh: 88.5, tuketim: 19},
    {id: "7", marka: "Tesla", model: "Model Y (Long Range)", batarya_kwh: 75.0, tuketim: 16}
    // (Uzun olmaması için listeyi kısalttım, Python'daki tüm listeyi buraya ekleyebilirsin)
];

const MARKA_FIYATLARI = { ZES: 10.49, Trugo: 9.99, Eşarj: 10.99, Voltrun: 9.95, Sharz: 10.00 };
let GUNCEL_ARAC_LISTESI = [];

async function araclariGetir() {
    if (GUNCEL_ARAC_LISTESI.length > 0) return GUNCEL_ARAC_LISTESI;
    try {
        const response = await fetch("https://raw.githubusercontent.com/chargeprice/open-ev-data/master/data/vehicles.json");
        if (response.ok) {
            const arabalar = await response.json();
            const islenmis = arabalar
                .filter(a => a.usable_battery_size > 0)
                .map((a, idx) => ({
                    id: `gh_${idx}`,
                    marka: a.brand || "Bilinmeyen",
                    model: a.model || "Araç",
                    batarya_kwh: parseFloat(a.usable_battery_size),
                    tuketim: parseFloat(a.consumption || 18)
                }));
            if (islenmis.length > 0) {
                GUNCEL_ARAC_LISTESI = islenmis;
                return GUNCEL_ARAC_LISTESI;
            }
        }
    } catch (e) {}
    GUNCEL_ARAC_LISTESI = DEV_YEDEK_LISTE;
    return GUNCEL_ARAC_LISTESI;
}

function sifreHashele(sifre) {
    return crypto.createHash('sha256').update(sifre).digest('hex');
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ---------------- KULLANICI UÇ NOKTALARI (ENDPOINTS) ----------------
app.post('/kayit', async (req, res) => {
    const { ad_soyad, email, sifre } = req.body;
    try {
        const result = await dbRun(
            "INSERT INTO kullanicilar (ad_soyad, email, sifre) VALUES (?, ?, ?)",
            [ad_soyad, email, sifreHashele(sifre)]
        );
        res.json({ durum: "Başarılı", mesaj: "Kayıt tamamlandı!", user_id: result.lastID, ad_soyad });
    } catch (error) {
        res.json({ durum: "Hata", mesaj: "Bu e-posta adresi zaten kayıtlı." });
    }
});

app.post('/giris', async (req, res) => {
    const { email, sifre } = req.body;
    const user = await dbGet(
        "SELECT id, ad_soyad, favori_arac_id FROM kullanicilar WHERE email = ? AND sifre = ?",
        [email, sifreHashele(sifre)]
    );
    if (user) {
        res.json({ durum: "Başarılı", user });
    } else {
        res.json({ durum: "Hata", mesaj: "E-posta veya şifre hatalı." });
    }
});

app.get('/profil/:user_id', async (req, res) => {
    const user = await dbGet(
        "SELECT id, ad_soyad, email, favori_arac_id, toplam_km, kazanc_tl, kurtarilan_co2_kg FROM kullanicilar WHERE id = ?",
        [req.params.user_id]
    );
    if (user) {
        const agac_sayisi = (user.kurtarilan_co2_kg / 20).toFixed(1);
        res.json({
            durum: "Başarılı",
            profil: {
                id: user.id, ad_soyad: user.ad_soyad, email: user.email, favori_arac_id: user.favori_arac_id,
                toplam_km: user.toplam_km.toFixed(1), kazanc_tl: user.kazanc_tl.toFixed(2),
                kurtarilan_co2_kg: user.kurtarilan_co2_kg.toFixed(1), kurtarilan_agac: parseFloat(agac_sayisi)
            }
        });
    } else {
        res.json({ durum: "Hata", mesaj: "Kullanıcı bulunamadı." });
    }
});

app.get('/araclar', async (req, res) => {
    const arabalar = await araclariGetir();
    const sirali = arabalar.sort((a, b) => a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model));
    res.json(sirali);
});

// ---------------- YZ HAVA DURUMU VE ROTA ALGORİTMASI ----------------
app.get('/rota-hesapla', async (req, res) => {
    const { kalkis, varis, sarj, arac_id, surus_modu = "normal", user_id } = req.query;

    try {
        // 1. Nominatim ile Koordinat Bulma
        const kResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${kalkis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const vResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${varis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        
        const kData = await kResponse.json();
        const vData = await vResponse.json();

        if (kData.length === 0 || vData.length === 0) {
            return res.json({ durum: "Hata", mesaj: "Şehirler haritada bulunamadı." });
        }

        const kLat = parseFloat(kData[0].lat);
        const kLon = parseFloat(kData[0].lon);
        const vLat = parseFloat(vData[0].lat);
        const vLon = parseFloat(vData[0].lon);

        let mesafe_km = Math.floor(getDistance(kLat, kLon, vLat, vLon) * 1.2);
        let rota_koordinatlari = [];

        // 2. OSRM API ile Gerçek Yol Rotası
        try {
            const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${kLon},${kLat};${vLon},${vLat}?geometries=geojson&overview=full`;
            const osrmCevap = await fetch(osrmUrl);
            const osrmVeri = await osrmCevap.json();
            
            if (osrmVeri.routes && osrmVeri.routes.length > 0) {
                mesafe_km = Math.floor(osrmVeri.routes[0].distance / 1000);
                const coords = osrmVeri.routes[0].geometry.coordinates;
                rota_koordinatlari = coords.map(c => ({ latitude: c[1], longitude: c[0] }));
            }
        } catch (e) {}

        // 3. Yapay Zeka Hava Durumu Simülasyonu
        const kalkisKucuk = kalkis.toLowerCase();
        let sicaklik = Math.floor(Math.random() * 41) - 5; // -5 ile 35 arası

        if (kalkisKucuk.includes("kayseri")) sicaklik = Math.floor(Math.random() * 11) - 8; // -8 ile 2 arası
        else if (kalkisKucuk.includes("antalya")) sicaklik = Math.floor(Math.random() * 15) + 28; // 28 ile 42 arası

        let menzil_katsayisi = 1.0;
        let hava_mesaji = "";

        if (sicaklik > 35) {
            menzil_katsayisi = 0.90;
            hava_mesaji = `Hava aşırı sıcak (${sicaklik}°C). Klima tam güçte çalıştığı için menzil %10 düştü.`;
        } else if (sicaklik >= 20) {
            menzil_katsayisi = 1.0;
            hava_mesaji = `Hava sıcaklığı ideal (${sicaklik}°C). Batarya kimyası %100 verimle çalışıyor.`;
        } else if (sicaklik >= 10) {
            menzil_katsayisi = 0.95;
            hava_mesaji = `Hava serin (${sicaklik}°C). Menzilde %5'lik ufak bir kayıp var.`;
        } else if (sicaklik >= 0) {
            menzil_katsayisi = 0.85;
            hava_mesaji = `Hava soğuk (${sicaklik}°C). Isıtıcılar sebebiyle menzil %15 düştü.`;
        } else {
            menzil_katsayisi = 0.70;
            hava_mesaji = `Hava dondurucu soğuk (${sicaklik}°C). Batarya kimyası yavaşladı, menzil %30 oranında azaldı!`;
        }

        // 4. Araç ve Menzil Hesaplamaları
        const tumAraclar = await araclariGetir();
        const secilenArac = tumAraclar.find(a => String(a.id) === String(arac_id)) || tumAraclar[0];
        const mevcut_enerji = (secilenArac.batarya_kwh * parseInt(sarj)) / 100;
        
        let mod_metni = "🚙 Normal";
        let gercek_tuketim = secilenArac.tuketim;
        
        if (surus_modu === "eco") {
            gercek_tuketim = secilenArac.tuketim * 0.85;
            mod_metni = "🌱 Eco";
        } else if (surus_modu === "hizli") {
            gercek_tuketim = secilenArac.tuketim * 1.25;
            mod_metni = "🚀 Hızlı";
        }

        const kalan_menzil = Math.floor(((mevcut_enerji / gercek_tuketim) * 100) * menzil_katsayisi);
        const tam_sarj_menzili = Math.floor(((secilenArac.batarya_kwh / gercek_tuketim) * 100) * menzil_katsayisi);
        const pratik_menzil = Math.floor(tam_sarj_menzili * 0.75);
        const eksik_mesafe = mesafe_km - kalan_menzil;

        const ort_fiyat = Object.values(MARKA_FIYATLARI).reduce((a, b) => a + b) / Object.values(MARKA_FIYATLARI).length;
        const toplam_enerji = (mesafe_km / 100) * (gercek_tuketim / menzil_katsayisi);
        const alinacak_enerji = Math.max(0, toplam_enerji - mevcut_enerji);
        const maliyet = Math.floor(alinacak_enerji * ort_fiyat);
        
        const tasarruf_tl = parseFloat((mesafe_km * 2.6).toFixed(2));
        const tasarruf_co2_kg = parseFloat((mesafe_km * 0.14).toFixed(1));

        // 5. Profil Güncelleme
        if (user_id) {
            await dbRun(
                "UPDATE kullanicilar SET toplam_km = toplam_km + ?, kazanc_tl = kazanc_tl + ?, kurtarilan_co2_kg = kurtarilan_co2_kg + ?, favori_arac_id = ? WHERE id = ?",
                [mesafe_km, tasarruf_tl, tasarruf_co2_kg, String(arac_id), user_id]
            );
        }

        // 6. Şarj İstasyonu Algoritması
        let gercek_istasyonlar = [];
        let gerekli_sarj_noktalari_km = [];

        if (eksik_mesafe > 0 && rota_koordinatlari.length > 0) {
            let ilk_sarj_km = Math.max(5, kalan_menzil * 0.9);
            let guncel_hedef_km = ilk_sarj_km;

            while (guncel_hedef_km < mesafe_km) {
                gerekli_sarj_noktalari_km.push(guncel_hedef_km);
                guncel_hedef_km += pratik_menzil;
            }

            for (let i = 0; i < gerekli_sarj_noktalari_km.length; i++) {
                let oran = Math.min(0.99, gerekli_sarj_noktalari_km[i] / mesafe_km);
                let nokta_index = Math.floor(rota_koordinatlari.length * oran);
                let hedef_nokta = rota_koordinatlari[nokta_index];

                try {
                    const apiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${hedef_nokta.latitude}&longitude=${hedef_nokta.longitude}&distance=75&distanceunit=KM&maxresults=50&levelid=3`;
                    const ocmCevap = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const ocmVeri = await ocmCevap.json();

                    if (ocmVeri.length > 0) {
                        for (let j = 0; j < Math.min(1, ocmVeri.length); j++) {
                            const st = ocmVeri[j];
                            let guc_kw = 50;
                            if (st.Connections) {
                                st.Connections.forEach(c => { if (c.PowerKW) guc_kw = Math.max(guc_kw, c.PowerKW); });
                            }
                            gercek_istasyonlar.push({
                                id: `${i}_${j}`,
                                isim: st.AddressInfo.Title || `${i+1}. Şarj İstasyonu`,
                                marka: (st.OperatorInfo && st.OperatorInfo.Title) ? st.OperatorInfo.Title : "Farklı Operatör",
                                guc_kw: Math.floor(guc_kw),
                                beklenen_sarj_suresi_dk: Math.floor((secilenArac.batarya_kwh * 0.7) / guc_kw * 60),
                                koordinat: { enlem: st.AddressInfo.Latitude, boylam: st.AddressInfo.Longitude }
                            });
                        }
                    }
                } catch (e) {
                    gercek_istasyonlar.push({
                        id: `yedek_${i}`, isim: `${i+1}. Mola Bölgesi`, marka: "Bölge İstasyonu", guc_kw: 120,
                        beklenen_sarj_suresi_dk: 30, koordinat: { enlem: hedef_nokta.latitude, boylam: hedef_nokta.longitude }
                    });
                }
            }
        }

        // 7. Tavsiye Metni
        let tavsiye = `${kalkis.charAt(0).toUpperCase() + kalkis.slice(1)} ile ${varis.charAt(0).toUpperCase() + varis.slice(1)} arası karayoluyla tahmini ${mesafe_km} km sürüyor.\n\n`;
        tavsiye += `🌡️ Yapay Zeka Hava Durumu Analizi: ${hava_mesaji}\n\n`;
        tavsiye += `Seçtiğin ${mod_metni} sürüş tarzıyla aracının şu anki şarjı sana tahmini ${kalan_menzil} km menzil sağlıyor.\n\n`;

        if (kalan_menzil >= mesafe_km) {
            tavsiye += `Yolda hiç şarj etmeden rahatlıkla ulaşabilirsin! 🎉`;
        } else {
            tavsiye += `Bu yolculukta yolda en az ${gerekli_sarj_noktalari_km.length} defa şarj molası vermen gerekecek. İşte şarjının biteceği bölgelerdeki istasyon alternatifleri: ⚡`;
        }

        res.json({
            durum: "Başarılı",
            tavsiye,
            istasyonlar: gercek_istasyonlar,
            rota: { kalkis: { enlem: kLat, boylam: kLon }, varis: { enlem: vLat, boylam: vLon } },
            rota_cizgisi: rota_koordinatlari,
            maliyet_tl: maliyet,
            tasarruf_tl,
            tasarruf_co2_kg
        });

    } catch (e) {
        res.json({ durum: "Hata", mesaj: "Sunucu hatası." });
    }
});

// ---------------- SUNUCUYU BAŞLAT ----------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Node.js Sunucusu ${PORT} portunda canlı!`);
});