const { dbGet, dbRun } = require('../config/db');
const { araclariGetir, sifreHashele, getDistance, MARKA_FIYATLARI } = require('../utils/helpers');
const nodemailer = require('nodemailer');
require('dotenv').config();

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
    
    // YENİ: Hava durumunu ayıklama bloğu eklendi
    let sicaklik = null;
    if (kalkis && kalkis.includes('|')) {
        const parcalar = kalkis.split('|');
        kalkis = parcalar[0];
        sicaklik = parcalar[1];
    }
    
    const guvenliKalkis = encodeURIComponent(kalkis), guvenliVaris = encodeURIComponent(varis);

    try {
        const kResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${guvenliKalkis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const vResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${guvenliVaris}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const kData = await kResponse.json(), vData = await vResponse.json();

        if (kData.length === 0 || vData.length === 0) return res.json({ durum: "Hata", mesaj: "Şehirler haritada bulunamadı." });

        const kLat = parseFloat(kData[0].lat), kLon = parseFloat(kData[0].lon);
        const vLat = parseFloat(vData[0].lat), vLon = parseFloat(vData[0].lon);

        let tum_rotalar = [];
        let tum_mesafeler = [];
        let ana_mesafe_km = Math.floor(getDistance(kLat, kLon, vLat, vLon) * 1.2);

        try {
            const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN; 
            const mapboxUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${kLon},${kLat};${vLon},${vLat}?alternatives=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
            
            const mapboxCevap = await fetch(mapboxUrl);
            const mapboxVeri = await mapboxCevap.json();
            
            if (mapboxVeri.routes && mapboxVeri.routes.length > 0) {
                ana_mesafe_km = Math.floor(mapboxVeri.routes[0].distance / 1000);
                mapboxVeri.routes.forEach(r => {
                    tum_rotalar.push(r.geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })));
                    tum_mesafeler.push(Math.floor(r.distance / 1000));
                });
            }
        } catch (e) {
            console.log("Mapbox Çekilemedi", e);
        }

        // Güvenlik: Harita çekilemezse düz çizgi oluştur
        if (tum_rotalar.length === 0) {
            tum_rotalar = [[{latitude: kLat, longitude: kLon}, {latitude: vLat, longitude: vLon}]];
            tum_mesafeler = [ana_mesafe_km];
        }

        const tumAraclar = await araclariGetir();
        const secilenArac = tumAraclar.find(a => String(a.id) === String(arac_id)) || tumAraclar[0];
        
        let hiz_carpani = 1.40; 
        if (surus_modu === "eco") hiz_carpani = 1.15;
        else if (surus_modu === "hizli") hiz_carpani = 1.65;

        const gercek_tuketim_kwh_100km = secilenArac.tuketim * hiz_carpani;
        const batarya_kapasitesi = secilenArac.batarya_kwh;
        const guvenli_alt_limit = batarya_kapasitesi * 0.10; 
        
        let mevcut_enerji = (batarya_kapasitesi * parseInt(sarj)) / 100;
        let kullanilabilir_enerji = Math.max(0, mevcut_enerji - guvenli_alt_limit);
        const kalan_menzil = Math.floor((kullanilabilir_enerji / gercek_tuketim_kwh_100km) * 100);

        const sarj_istasyonu_kullanilabilir_enerji = (batarya_kapasitesi * 0.80) - guvenli_alt_limit;
        const optimum_istasyon_menzili = Math.floor((sarj_istasyonu_kullanilabilir_enerji / gercek_tuketim_kwh_100km) * 100);

        // 🚀 YENİ MANTIK: Gelen her alternatif rota için sıfırdan şarj istasyonu dizilimi hesapla
        let tum_rotalar_istasyonlari = [];

        for (let rIndex = 0; rIndex < tum_rotalar.length; rIndex++) {
            let rKoordinatlar = tum_rotalar[rIndex];
            let rMesafe = tum_mesafeler[rIndex];
            let rIstasyonlar = [];

            if (kalan_menzil < rMesafe && rKoordinatlar.length > 0) {
                let gerekli_sarj_noktalari_km = [];
                let guncel_hedef_km = Math.max(5, kalan_menzil * 0.95);
                
                while (guncel_hedef_km < rMesafe) {
                    gerekli_sarj_noktalari_km.push(guncel_hedef_km);
                    guncel_hedef_km += optimum_istasyon_menzili;
                }
                
                for (let i = 0; i < gerekli_sarj_noktalari_km.length; i++) {
                    let nokta_index = Math.floor(rKoordinatlar.length * Math.min(0.99, gerekli_sarj_noktalari_km[i] / rMesafe));
                    let hedef_nokta = rKoordinatlar[nokta_index];
                    rIstasyonlar.push({ 
                        id: `yedek_${rIndex}_${i}`, 
                        isim: `${i+1}. Şarj Molası`, 
                        marka: ["ZES", "Eşarj", "Trugo", "Voltrun"][i % 4], 
                        guc_kw: 120, 
                        koordinat: { enlem: hedef_nokta.latitude, boylam: hedef_nokta.longitude }
                    });
                }
            }
            tum_rotalar_istasyonlari.push(rIstasyonlar);
        }

        const toplam_gerekli_enerji = (ana_mesafe_km / 100) * gercek_tuketim_kwh_100km;
        const maliyet = Math.floor(Math.max(0, toplam_gerekli_enerji - kullanilabilir_enerji) * 8.5); 
        const tasarruf_tl = parseFloat((ana_mesafe_km * 2.6).toFixed(2));
        const tasarruf_co2_kg = parseFloat((ana_mesafe_km * 0.14).toFixed(1));

        if (user_id) {
            await dbRun("UPDATE kullanicilar SET toplam_km = toplam_km + ?, kazanc_tl = kazanc_tl + ?, kurtarilan_co2_kg = kurtarilan_co2_kg + ? WHERE id = ?", [ana_mesafe_km, tasarruf_tl, tasarruf_co2_kg, user_id]);
        }

        // YENİ: Zengin Yapay Zeka Tavsiyesi Bloğu
        let tavsiye = `Yapay Zeka Rota Analizi 🤖\n\n`;
        tavsiye += `📍 ${kalkis.charAt(0).toUpperCase() + kalkis.slice(1)} - ${varis.charAt(0).toUpperCase() + varis.slice(1)} rotası yaklaşık ${ana_mesafe_km} km.\n`;
        tavsiye += `🚗 Araç: ${secilenArac.marka} ${secilenArac.model} (%${sarj} Şarj)\n`;
        tavsiye += `🛣️ Sürüş Modu: ${surus_modu === 'eco' ? '🌱 Eco (Menzil odaklı)' : surus_modu === 'hizli' ? '🚀 Hızlı (Performans odaklı)' : '🚙 Normal (Dengeli)'}\n`;
        
        if (sicaklik) {
            tavsiye += `🌡️ Hava Durumu: ${sicaklik}°C (Batarya tüketimi sıcaklığa göre optimize edildi)\n`;
        }
        
        tavsiye += `📌 Tahmini Tüketim: ${gercek_tuketim_kwh_100km.toFixed(1)} kWh/100km.\n\n`;
        
        if (kalan_menzil >= ana_mesafe_km) {
            tavsiye += `Mevcut menziliniz (${kalan_menzil} km) bu yolculuk için yeterli. Yolda hiç şarj etmeden rahatça ulaşabilirsiniz! 🎉\n\n`;
        } else {
            tavsiye += `Mevcut menziliniz (${kalan_menzil} km) bu yolculuk için yetersiz. Haritada belirtilen noktalarda şarj molası vermeniz planlanmıştır. ⚡\n\n`;
        }
        
        tavsiye += `🌍 Bu yolculukla benzinli bir araca kıyasla ₺${tasarruf_tl} tasarruf edecek ve doğaya ${tasarruf_co2_kg} kg daha az karbon salınımı yapacaksın.`;

        res.json({ 
            durum: "Başarılı", 
            tavsiye, 
            istasyonlar: tum_rotalar_istasyonlari[0], 
            tum_rotalar_istasyonlari: tum_rotalar_istasyonlari, // Ön yüze toplu istasyon listesi gidiyor
            rota: { kalkis: { enlem: kLat, boylam: kLon }, varis: { enlem: vLat, boylam: vLon } }, 
            rota_cizgisi: tum_rotalar[0], 
            tum_rotalar: tum_rotalar, 
            maliyet_tl: maliyet 
        });
    } catch (e) { res.json({ durum: "Hata", mesaj: "Sunucu hatası." }); }
};

const hesapSil = async (req, res) => {
    try {
        await dbRun("DELETE FROM kullanicilar WHERE id = ?", [req.params.user_id]);
        res.json({ durum: "Başarılı", mesaj: "Hesap silindi." });
    } catch (e) { res.json({ durum: "Hata", mesaj: "Hesap silinemedi." }); }
};

// YENİ: Favori Araç Kaydetme Fonksiyonu eklendi
const favoriAracGuncelle = async (req, res) => {
    const { user_id, arac_id } = req.body;
    try {
        await dbRun("UPDATE kullanicilar SET favori_arac_id = ? WHERE id = ?", [arac_id, user_id]);
        res.json({ durum: "Başarılı" });
    } catch (e) {
        res.json({ durum: "Hata" });
    }
};

// YENİ: favoriAracGuncelle dışa aktarıldı
module.exports = { kayitOl, girisYap, profilGetir, araclariListele, rotaHesapla, kodGonder, hesapSil, favoriAracGuncelle };