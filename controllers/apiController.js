const { dbGet, dbRun } = require('../config/db');
const { araclariGetir, sifreHashele, getDistance, MARKA_FIYATLARI } = require('../utils/helpers');
const nodemailer = require('nodemailer');

const dogrulamaKodlari = {};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'erota.node@gmail.com',
        pass: 'phyw ulre mkjp jevu'
    }
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
            from: 'EV Rota Planlayıcı <no-reply@evrota.com>',
            to: email,
            subject: 'EV Rota Planlayıcı - Doğrulama Kodunuz',
            text: `Merhaba!\n\nUygulamamıza kayıt olmak için doğrulama kodunuz: ${kod}\n\nBu kodu kimseyle paylaşmayın.`
        });
        res.json({ durum: "Başarılı", mesaj: "Doğrulama kodu e-posta adresinize gönderildi." });
    } catch (error) {
        console.log("Mail Hatası:", error);
        res.json({ durum: "Hata", mesaj: "E-posta gönderilemedi. Lütfen geçerli bir adres girin." });
    }
};

const kayitOl = async (req, res) => {
    const { ad_soyad, email, sifre, kod } = req.body;

    if (!kod || dogrulamaKodlari[email] !== kod) {
        return res.json({ durum: "Hata", mesaj: "Doğrulama kodu hatalı veya süresi dolmuş!" });
    }

    try {
        const result = await dbRun(
            "INSERT INTO kullanicilar (ad_soyad, email, sifre) VALUES (?, ?, ?)",
            [ad_soyad, email, sifreHashele(sifre)]
        );
        delete dogrulamaKodlari[email]; 
        res.json({ durum: "Başarılı", mesaj: "Kayıt tamamlandı!", user_id: result.lastID, ad_soyad });
    } catch (error) {
        res.json({ durum: "Hata", mesaj: "Kayıt sırasında bir hata oluştu." });
    }
};

const girisYap = async (req, res) => {
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
};

const profilGetir = async (req, res) => {
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
};

const araclariListele = async (req, res) => {
    const arabalar = await araclariGetir();
    const sirali = arabalar.sort((a, b) => a.marka.localeCompare(b.marka) || a.model.localeCompare(b.model));
    res.json(sirali);
};

const rotaHesapla = async (req, res) => {
    let { kalkis, varis, sarj, arac_id, surus_modu = "normal", user_id } = req.query;

    // UYGULAMADAN GELEN TEKİL SICAKLIĞI BİLEREK SİLİYORUZ (Zorla 3 nokta hesabı yapmak için)
    if (kalkis && kalkis.includes('|')) {
        kalkis = kalkis.split('|')[0]; 
    }

    try {
        const kResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${kalkis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        const vResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${varis}&format=json&limit=1`, { headers: { 'User-Agent': 'ev_rota_app_yigit' }});
        
        const kData = await kResponse.json();
        const vData = await vResponse.json();

        if (kData.length === 0 || vData.length === 0) return res.json({ durum: "Hata", mesaj: "Şehirler haritada bulunamadı." });

        const kLat = parseFloat(kData[0].lat);
        const kLon = parseFloat(kData[0].lon);
        const vLat = parseFloat(vData[0].lat);
        const vLon = parseFloat(vData[0].lon);

        let mesafe_km = Math.floor(getDistance(kLat, kLon, vLat, vLon) * 1.2);
        let rota_koordinatlari = [];

        // ÖNCE OSRM'DEN ROTAYI ÇEKİYORUZ Kİ ORTA NOKTAYI BULALIM
        try {
            const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${kLon},${kLat};${vLon},${vLat}?geometries=geojson&overview=full`;
            const osrmCevap = await fetch(osrmUrl);
            const osrmVeri = await osrmCevap.json();
            if (osrmVeri.routes && osrmVeri.routes.length > 0) {
                mesafe_km = Math.floor(osrmVeri.routes[0].distance / 1000);
                rota_koordinatlari = osrmVeri.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] }));
            }
        } catch (e) {}

        // Orta noktanın koordinatlarını buluyoruz
        let mLat = kLat, mLon = kLon;
        if (rota_koordinatlari.length > 0) {
            const midIndex = Math.floor(rota_koordinatlari.length / 2);
            mLat = rota_koordinatlari[midIndex].latitude;
            mLon = rota_koordinatlari[midIndex].longitude;
        }

        let sicaklik = 22; // Varsayılan ideal sıcaklık
        let detayli_hava_mesaji = "";

        try {
            // 3 NOKTAYI AYNI ANDA ÇEKİYORUZ
            const [kCevap, mCevap, vCevap] = await Promise.all([
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${kLat}&longitude=${kLon}&current_weather=true&timezone=auto`),
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${mLat}&longitude=${mLon}&current_weather=true&timezone=auto`),
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${vLat}&longitude=${vLon}&current_weather=true&timezone=auto`)
            ]);

            const [kVeri, mVeri, vVeri] = await Promise.all([kCevap.json(), mCevap.json(), vCevap.json()]);

            const k_sicaklik = (kVeri && kVeri.current_weather) ? kVeri.current_weather.temperature : 22;
            const m_sicaklik = (mVeri && mVeri.current_weather) ? mVeri.current_weather.temperature : k_sicaklik;
            const v_sicaklik = (vVeri && vVeri.current_weather) ? vVeri.current_weather.temperature : 22;

            // Hassas Ortalama Sıcaklık Hesaplama
            sicaklik = Math.round((k_sicaklik + m_sicaklik + v_sicaklik) / 3);
            detayli_hava_mesaji = `(Kalkış: ${Math.round(k_sicaklik)}°C | Orta Nokta: ${Math.round(m_sicaklik)}°C | Varış: ${Math.round(v_sicaklik)}°C)\n`;
        } catch (e) { }

        // 1 DERECEYE BİLE DUYARLI DİNAMİK MENZİL HESABI
        let menzil_katsayisi = 1.0;
        let kayip_orani = 0;

        if (sicaklik > 22) {
            kayip_orani = (sicaklik - 22) * 0.006;
            menzil_katsayisi = 1.0 - kayip_orani;
        } else if (sicaklik < 22) {
            kayip_orani = (22 - sicaklik) * 0.008;
            menzil_katsayisi = 1.0 - kayip_orani;
        }

        if (menzil_katsayisi < 0.60) menzil_katsayisi = 0.60;

        const kayip_yuzdesi = Math.round((1.0 - menzil_katsayisi) * 100);
        let hava_mesaji = detayli_hava_mesaji;
        if (kayip_yuzdesi === 0) {
            hava_mesaji += `Hava sıcaklığı rota boyunca ideal (${sicaklik}°C). Batarya %100 verimle çalışıyor.`;
        } else {
            hava_mesaji += `Rota ortalaması ${sicaklik}°C. İklimlendirme ve batarya kondisyonu sebebiyle menzilde yaklaşık %${kayip_yuzdesi} kayıp yaşanacak.`;
        }

        const tumAraclar = await araclariGetir();
        const secilenArac = tumAraclar.find(a => String(a.id) === String(arac_id)) || tumAraclar[0];
        const mevcut_enerji = (secilenArac.batarya_kwh * parseInt(sarj)) / 100;
        
        let mod_metni = "🚙 Normal";
        let gercek_tuketim = secilenArac.tuketim;
        
        if (surus_modu === "eco") { gercek_tuketim = secilenArac.tuketim * 0.85; mod_metni = "🌱 Eco"; }
        else if (surus_modu === "hizli") { gercek_tuketim = secilenArac.tuketim * 1.25; mod_metni = "🚀 Hızlı"; }

        const kalan_menzil = Math.floor(((mevcut_enerji / gercek_tuketim) * 100) * menzil_katsayisi);
        const tam_sarj_menzili = Math.floor(((secilenArac.batarya_kwh / gercek_tuketim) * 100) * menzil_katsayisi);
        const pratik_menzil = Math.floor(tam_sarj_menzili * 0.75);
        const eksik_mesafe = mesafe_km - kalan_menzil;
        const ort_fiyat = Object.values(MARKA_FIYATLARI).reduce((a, b) => a + b) / Object.values(MARKA_FIYATLARI).length;
        const maliyet = Math.floor(Math.max(0, (mesafe_km / 100) * (gercek_tuketim / menzil_katsayisi) - mevcut_enerji) * ort_fiyat);
        const tasarruf_tl = parseFloat((mesafe_km * 2.6).toFixed(2));
        const tasarruf_co2_kg = parseFloat((mesafe_km * 0.14).toFixed(1));

        if (user_id) {
            await dbRun("UPDATE kullanicilar SET toplam_km = toplam_km + ?, kazanc_tl = kazanc_tl + ?, kurtarilan_co2_kg = kurtarilan_co2_kg + ?, favori_arac_id = ? WHERE id = ?", [mesafe_km, tasarruf_tl, tasarruf_co2_kg, String(arac_id), user_id]);
        }

        let gercek_istasyonlar = [];
        let gerekli_sarj_noktalari_km = [];

        if (eksik_mesafe > 0 && rota_koordinatlari.length > 0) {
            let guncel_hedef_km = Math.max(5, kalan_menzil * 0.9);
            while (guncel_hedef_km < mesafe_km) {
                gerekli_sarj_noktalari_km.push(guncel_hedef_km);
                guncel_hedef_km += pratik_menzil;
            }

            for (let i = 0; i < gerekli_sarj_noktalari_km.length; i++) {
                let nokta_index = Math.floor(rota_koordinatlari.length * Math.min(0.99, gerekli_sarj_noktalari_km[i] / mesafe_km));
                let hedef_nokta = rota_koordinatlari[nokta_index];
                try {
                    const ocmVeri = await (await fetch(`https://api.openchargemap.io/v3/poi/?output=json&latitude=${hedef_nokta.latitude}&longitude=${hedef_nokta.longitude}&distance=75&distanceunit=KM&maxresults=50&levelid=3`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
                    if (ocmVeri.length > 0) {
                        const st = ocmVeri[0];
                        let guc_kw = 50;
                        if (st.Connections) st.Connections.forEach(c => { if (c.PowerKW) guc_kw = Math.max(guc_kw, c.PowerKW); });
                        gercek_istasyonlar.push({
                            id: `${i}_0`, isim: st.AddressInfo.Title || `${i+1}. Şarj İstasyonu`, marka: (st.OperatorInfo && st.OperatorInfo.Title) ? st.OperatorInfo.Title : "Farklı Operatör",
                            guc_kw: Math.floor(guc_kw), beklenen_sarj_suresi_dk: Math.floor((secilenArac.batarya_kwh * 0.7) / guc_kw * 60),
                            koordinat: { enlem: st.AddressInfo.Latitude, boylam: st.AddressInfo.Longitude }
                        });
                    }
                } catch (e) {
                    gercek_istasyonlar.push({ id: `yedek_${i}`, isim: `${i+1}. Mola Bölgesi`, marka: "Bölge İstasyonu", guc_kw: 120, beklenen_sarj_suresi_dk: 30, koordinat: { enlem: hedef_nokta.latitude, boylam: hedef_nokta.longitude }});
                }
            }
        }

        let tavsiye = `${kalkis.charAt(0).toUpperCase() + kalkis.slice(1)} ile ${varis.charAt(0).toUpperCase() + varis.slice(1)} arası karayoluyla tahmini ${mesafe_km} km sürüyor.\n\n🌡️ Yapay Zeka Hava Durumu Analizi:\n${hava_mesaji}\n\nSeçtiğin ${mod_metni} sürüş tarzıyla aracının şu anki şarjı sana tahmini ${kalan_menzil} km menzil sağlıyor.\n\n`;
        tavsiye += kalan_menzil >= mesafe_km ? `Yolda hiç şarj etmeden rahatlıkla ulaşabilirsin! 🎉` : `Bu yolculukta yolda en az ${gerekli_sarj_noktalari_km.length} defa şarj molası vermen gerekecek. İşte şarjının biteceği bölgelerdeki istasyon alternatifleri: ⚡`;

        res.json({ durum: "Başarılı", tavsiye, istasyonlar: gercek_istasyonlar, rota: { kalkis: { enlem: kLat, boylam: kLon }, varis: { enlem: vLat, boylam: vLon } }, rota_cizgisi: rota_koordinatlari, maliyet_tl: maliyet, tasarruf_tl, tasarruf_co2_kg });
    } catch (e) {
        res.json({ durum: "Hata", mesaj: "Sunucu hatası." });
    }
};

module.exports = { kayitOl, girisYap, profilGetir, araclariListele, rotaHesapla, kodGonder };