const crypto = require('crypto');

// Yedek Araç Listesi
const DEV_YEDEK_LISTE = [
    {id: "1", marka: "BYD", model: "Sealion 7 (Arkadan İtişli)", batarya_kwh: 82.5, tuketim: 18},
    {id: "2", marka: "BYD", model: "Atto 3", batarya_kwh: 60.4, tuketim: 16},
    {id: "5", marka: "Togg", model: "T10X (Uzun Menzil)", batarya_kwh: 88.5, tuketim: 19},
    {id: "7", marka: "Tesla", model: "Model Y (Long Range)", batarya_kwh: 75.0, tuketim: 16}
];

const MARKA_FIYATLARI = { ZES: 10.49, Trugo: 9.99, Eşarj: 10.99, Voltrun: 9.95, Sharz: 10.00 };
let GUNCEL_ARAC_LISTESI = [];

// API'den Araçları Çeken Fonksiyon
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

// Güvenlik: Şifre Hasheleme
function sifreHashele(sifre) {
    return crypto.createHash('sha256').update(sifre).digest('hex');
}

// Kuş Uçuşu Mesafe Hesaplama (Haversine Formülü)
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// Diğer dosyalarda kullanabilmek için dışa aktarıyoruz
module.exports = {
    araclariGetir,
    sifreHashele,
    getDistance,
    MARKA_FIYATLARI
};