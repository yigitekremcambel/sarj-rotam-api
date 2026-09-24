require('dotenv').config();
const { dbGet, dbRun } = require('../config/db');
const { araclariGetir, sifreHashele, getDistance, MARKA_FIYATLARI } = require('../utils/helpers');
const nodemailer = require('nodemailer');

const dogrulamaKodlari = {};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: 'erota.node@gmail.com', pass: 'phyw ulre mkjp jevu' }
});

const kodGonder = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ durum: "Hata", mesaj: "E-posta gerekli." });

    const kayitliMi = await dbGet("SELECT id FROM kullanicilar WHERE email = ?", [email]);
    if (kayitliMi) return res.json({ durum: "Hata", mesaj: "Bu e-posta adresi zaten sisteme kayıtlı." });

    const kod = Math.floor(100000 + Math.random() * 900000).toString();
    dogrulamaKodlari[email] = kod; 

    try {
        await transporter.sendMail({
            from: 'e-Rota Uygulaması <no-reply@erota.com>',
            to: email,
            subject: 'e-Rota - Doğrulama Kodunuz',
            text: `Merhaba!\n\nUygulamamıza kayıt olmak için doğrulama kodunuz: ${kod}\n\nBu kodu kimseyle paylaşmayın.`
        });
        res.json({ durum: "Başarılı", mesaj: "Doğrulama kodu e-posta adresinize gönderildi." });
    } catch (error) {
        res.json({ durum: "Hata", mesaj: "E-posta gönderilemedi. Lütfen geçerli bir adres girin." });
    }
};

const kayitOl = async (req, res) => {
    const { ad_soyad, email, sifre, kod } = req.body;
    if (!kod || dogrulamaKodlari[email] !== kod) return res.json({ durum: "Hata", mesaj: "Doğrulama kodu hatalı veya süresi dolmuş!" });

    try {
        const result = await dbRun("INSERT INTO kullanicilar (ad_soyad, email, sifre) VALUES (?, ?, ?)", [ad_soyad, email, sifreHashele(sifre)]);
        delete dogrulamaKodlari[email]; 
        res.json({ durum: "Başarılı", mesaj: "Kayıt tamamlandı!", user_id: result.lastID, ad_soyad });
    } catch (error) {
        res.json({ durum: "Hata", mesaj: "Kayıt sırasında bir hata oluştu." });
    }
};

const girisYap = async (req, res) => {
    const { email, sifre } = req.body;
    const user = await dbGet("SELECT id, ad_soyad, favori_arac_id FROM kullanicilar WHERE email = ? AND sifre = ?", [email, sifreHashele(sifre)]);
    if (user) res.json({ durum: "Başarılı", user });
    else res.json({ durum: "Hata", mesaj: "E-posta veya şifre hatalı." });
};

const profilGetir = async (req, res) => {
    const user = await dbGet("SELECT id, ad_soyad, email, favori_arac_id, toplam_km, kazanc_tl, kurtarilan_co2_kg FROM kullanicilar WHERE id = ?", [req.params.user_id]);
    if (user) {
        const agac_sayisi = (user.kurtarilan_co2_kg / 20).toFixed(1);
        const tumAraclar = await araclariGetir();
        const favoriArac = tumAraclar.find(a => String(a.id) === String(user.favori_arac_id));
        let arac_resmi = "https://cdn-icons-png.flaticon.com/512/5526/5526306.png"; 
        let secili_marka = "Marka Seçilmedi", secili_model = "Araç Seçilmedi";

        if (favoriArac) {
            secili_marka = favoriArac.marka; secili_model = favoriArac.model;
            const m = secili_marka.toLowerCase();
            if (m.includes("togg")) arac_resmi = "https://images.carexpert.com.au/resize/3000/vehicles/togg-t10x.png";
            else if (m.includes("tesla")) arac_resmi = "https://digitalassets.tesla.com/tesla-contents/image/upload/f_auto,q_auto/Model-Y-Step-1-Half-Desktop-LHD.png";
            else if (m.includes("byd")) arac_resmi = "https://ev-database.org/img/auto/BYD_SEAL/BYD_SEAL-01.png";
            else if (m.includes("bmw")) arac_resmi = "https://ev-database.org/img/auto/BMW_i4_M50/BMW_i4_M50-01.png";
            else if (m.includes("mercedes")) arac_resmi = "https://ev-database.org/img/auto/Mercedes_EQE/Mercedes_EQE-01.png";
            else if (m.includes("volkswagen") || m.includes("vw")) arac_resmi = "https://ev-database.org/img/auto/Volkswagen_ID4/Volkswagen_ID4-01.png";
            else if (m.includes("audi")) arac_resmi = "https://ev-database.org/img/auto/Audi_Q4_e-tron/Audi_Q4_e-tron-01.png";
            else if (m.includes("porsche")) arac_resmi = "https://ev-database.org/img/auto/Porsche_Taycan/Porsche_Taycan-01.png";
            else arac_resmi = `https://logo.clearbit.com/${m.replace(/\s/g, '')}.com`; 
        }

        res.json({
            durum: "Başarılı",
            profil: {
                id: user.id, ad_soyad: user.ad_soyad, email: user.email, favori_arac_id: user.favori_arac_id,
                arac_marka: secili_marka, arac_model: secili_model, arac_resmi: arac_resmi, 
                toplam_km: user.toplam_km.toFixed(1), kazanc_tl: user.kazanc_tl.toFixed(2),
                kurtarilan_co2_kg: user.kurtarilan_co2_kg.toFixed(1), kurtarilan_agac: parseFloat(agac_sayisi)
            }
        });
    } else res.json({ durum: "Hata", mesaj: "Kullanıcı bulunamadı." });
};

const araclariListele = async (req, res) => {
    const arabalar = await araclariGetir();
    const sirali = arabalar.sort((a, b) => a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model));
    res.json(sirali);
};

const rotaHesapla = async (req, res) => {
    let { kalkis, varis, sarj, arac_id, surus_modu = "normal", user_id } = req.query;
    if (kalkis && kalkis.includes('|')) kalkis = kalkis.split('|')[0]; 
    const guvenliKalkis = encodeURIComponent(kalkis), guvenliVaris = encodeURIComponent(varis);

    try {
        const kResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${guvenliKalkis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const vResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${guvenliVaris}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const kData = await kResponse.json(), vData = await vResponse.json();

        if (kData.length === 0 || vData.length === 0) return res.json({ durum: "Hata", mesaj: "Şehirler haritada bulunamadı." });

        const kLat = parseFloat(kData[0].lat), kLon = parseFloat(kData[0].lon);
        const vLat = parseFloat(vData[0].lat), vLon = parseFloat(vData[0].lon);

        let mesafe_km = Math.floor(getDistance(kLat, kLon, vLat, vLon) * 1.2);
        let rota_koordinatlari = [];
        let tum_rotalar = []; 

        try {
            // 🚀 OSRM YERİNE PROFESYONEL MAPBOX API KULLANIYORUZ
            const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN; 
            const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${kLon},${kLat};${vLon},${vLat}?alternatives=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
            
            const mapboxCevap = await fetch(mapboxUrl);
            const mapboxVeri = await mapboxCevap.json();
            
            if (mapboxVeri.routes && mapboxVeri.routes.length > 0) {
                mesafe_km = Math.floor(mapboxVeri.routes[0].distance / 1000);
                rota_koordinatlari = mapboxVeri.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
                
                // Mapbox bize gerçek alternatifleri veriyor, biz de haritaya yolluyoruz
                tum_rotalar = mapboxVeri.routes.map(r => r.geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })));
            }
        } catch (e) {
            console.log("Mapbox Çekilemedi", e);
        }

        const tumAraclar = await araclariGetir();
        const secilenArac = tumAraclar.find(a => String(a.id) === String(arac_id)) || tumAraclar[0];
        
        // ==============================================================
        // 🚀 KATI ABRP MATEMATİĞİ (OTOYOL CEZASI)
        // ==============================================================
        let hiz_carpani = 1.40; 
        let mod_metni = "🚙 Normal (110-120 km/s)";
        if (surus_modu === "eco") { hiz_carpani = 1.15; mod_metni = "🌱 Eco (90-100 km/s)"; } 
        else if (surus_modu === "hizli") { hiz_carpani = 1.65; mod_metni = "🚀 Hızlı (130+ km/s)"; }

        const gercek_tuketim_kwh_100km = secilenArac.tuketim * hiz_carpani;
        const batarya_kapasitesi = secilenArac.batarya_kwh;
        const guvenli_alt_limit = batarya_kapasitesi * 0.10; 
        
        let mevcut_enerji = (batarya_kapasitesi * parseInt(sarj)) / 100;
        let kullanilabilir_enerji = Math.max(0, mevcut_enerji - guvenli_alt_limit);

        const kalan_menzil = Math.floor((kullanilabilir_enerji / gercek_tuketim_kwh_100km) * 100);

        let gercek_istasyonlar = [];
        let gerekli_sarj_noktalari_km = [];
        const sarj_istasyonu_kullanilabilir_enerji = (batarya_kapasitesi * 0.80) - guvenli_alt_limit;
        const optimum_istasyon_menzili = Math.floor((sarj_istasyonu_kullanilabilir_enerji / gercek_tuketim_kwh_100km) * 100);

        if (kalan_menzil < mesafe_km && rota_koordinatlari.length > 0) {
            let guncel_hedef_km = Math.max(5, kalan_menzil * 0.95);
            while (guncel_hedef_km < mesafe_km) {
                gerekli_sarj_noktalari_km.push(guncel_hedef_km);
                guncel_hedef_km += optimum_istasyon_menzili;
            }
            
            for (let i = 0; i < gerekli_sarj_noktalari_km.length; i++) {
                let nokta_index = Math.floor(rota_koordinatlari.length * Math.min(0.99, gerekli_sarj_noktalari_km[i] / mesafe_km));
                let hedef_nokta = rota_koordinatlari[nokta_index];
                gercek_istasyonlar.push({ 
                    id: `yedek_${i}`, isim: `${i+1}. Şarj Molası`, marka: ["ZES", "Eşarj", "Trugo", "Voltrun"][i % 4], guc_kw: 120, 
                    koordinat: { enlem: hedef_nokta.latitude, boylam: hedef_nokta.longitude }
                });
            }
        }

        const toplam_gerekli_enerji = (mesafe_km / 100) * gercek_tuketim_kwh_100km;
        const maliyet = Math.floor(Math.max(0, toplam_gerekli_enerji - kullanilabilir_enerji) * 8.5); 
        const tasarruf_tl = parseFloat((mesafe_km * 2.6).toFixed(2));
        const tasarruf_co2_kg = parseFloat((mesafe_km * 0.14).toFixed(1));

        if (user_id) {
            await dbRun("UPDATE kullanicilar SET toplam_km = toplam_km + ?, kazanc_tl = kazanc_tl + ?, kurtarilan_co2_kg = kurtarilan_co2_kg + ? WHERE id = ?", [mesafe_km, tasarruf_tl, tasarruf_co2_kg, user_id]);
        }

        let tavsiye = `${kalkis.charAt(0).toUpperCase() + kalkis.slice(1)} - ${varis.charAt(0).toUpperCase() + varis.slice(1)} arası otoyol mesafesi tahmini ${mesafe_km} km.\n\n`;
        tavsiye += `📌 Otoyol rüzgar direnci (%40 hız cezası) ve %10 batarya güvenlik payı (SoC) hesaba katıldığında, aracının GERÇEK tüketimi ${gercek_tuketim_kwh_100km.toFixed(1)} kWh/100km olarak hesaplandı.\n\n`;
        tavsiye += `🔋 Bu otoyol koşullarında mevcut şarjınla gidebileceğin GERÇEKÇİ menzil: ${kalan_menzil} km.\n\n`;
        
        if (kalan_menzil >= mesafe_km) {
            tavsiye += `Yolda hiç şarj etmeden rahatlıkla ulaşabilirsin! 🎉`;
        } else {
            tavsiye += `Bataryan kritik seviyeye düşmeden yolda ${gerekli_sarj_noktalari_km.length} defa hızlı şarj molası vermen gerekiyor. İşte rotadaki durakların: ⚡`;
        }

        res.json({ 
            durum: "Başarılı", tavsiye, istasyonlar: gercek_istasyonlar, 
            rota: { kalkis: { enlem: kLat, boylam: kLon }, varis: { enlem: vLat, boylam: vLon } }, 
            rota_cizgisi: rota_koordinatlari, tum_rotalar: tum_rotalar, maliyet_tl: maliyet 
        });
    } catch (e) { res.json({ durum: "Hata", mesaj: "Sunucu hatası." }); }
};

const hesapSil = async (req, res) => {
    try {
        await dbRun("DELETE FROM kullanicilar WHERE id = ?", [req.params.user_id]);
        res.json({ durum: "Başarılı", mesaj: "Hesap silindi." });
    } catch (e) { res.json({ durum: "Hata", mesaj: "Hesap silinemedi." }); }
};

module.exports = { kayitOl, girisYap, profilGetir, araclariListele, rotaHesapla, kodGonder, hesapSil };