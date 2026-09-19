const crypto = require('crypto');

// Yedek Araç Listesi
const DEV_YEDEK_LISTE = [
    { id: "1", marka: "Togg", model: "T10X V1 RWD (Standart Menzil)", batarya_kwh: 52.4, tuketim: 16.7 },
    { id: "2", marka: "Togg", model: "T10X V2 RWD (Uzun Menzil)", batarya_kwh: 88.5, tuketim: 16.9 },
    { id: "3", marka: "Tesla", model: "Model Y RWD", batarya_kwh: 60.0, tuketim: 15.7 },
    { id: "4", marka: "Tesla", model: "Model Y Long Range AWD", batarya_kwh: 75.0, tuketim: 16.9 },
    { id: "5", marka: "Tesla", model: "Model Y Performance", batarya_kwh: 75.0, tuketim: 17.3 },
    { id: "6", marka: "Tesla", model: "Model 3 RWD", batarya_kwh: 60.0, tuketim: 14.4 },
    { id: "7", marka: "Tesla", model: "Model 3 Long Range AWD", batarya_kwh: 75.0, tuketim: 15.0 },
    { id: "8", marka: "Tesla", model: "Model 3 Performance", batarya_kwh: 75.0, tuketim: 16.5 },
    { id: "9", marka: "Tesla", model: "Model S Long Range", batarya_kwh: 100.0, tuketim: 17.5 },
    { id: "10", marka: "Tesla", model: "Model S Plaid", batarya_kwh: 100.0, tuketim: 18.7 },
    { id: "11", marka: "Tesla", model: "Model X Long Range", batarya_kwh: 100.0, tuketim: 19.1 },
    { id: "12", marka: "BYD", model: "Atto 3 Design", batarya_kwh: 60.4, tuketim: 15.6 },
    { id: "13", marka: "BYD", model: "Dolphin Design", batarya_kwh: 60.4, tuketim: 15.9 },
    { id: "14", marka: "BYD", model: "Seal Design RWD", batarya_kwh: 82.5, tuketim: 16.6 },
    { id: "15", marka: "BYD", model: "Seal Excellence AWD", batarya_kwh: 82.5, tuketim: 18.2 },
    { id: "16", marka: "BYD", model: "Sealion 7 RWD", batarya_kwh: 82.5, tuketim: 18.0 },
    { id: "17", marka: "BYD", model: "Sealion 7 AWD", batarya_kwh: 82.5, tuketim: 20.0 },
    { id: "18", marka: "BYD", model: "Tang AWD", batarya_kwh: 86.4, tuketim: 23.8 },
    { id: "19", marka: "BYD", model: "Han AWD", batarya_kwh: 85.4, tuketim: 18.5 },
    { id: "20", marka: "BMW", model: "i3 (120 Ah)", batarya_kwh: 42.2, tuketim: 15.3 },
    { id: "21", marka: "BMW", model: "i4 eDrive35", batarya_kwh: 70.2, tuketim: 15.8 },
    { id: "22", marka: "BMW", model: "i4 eDrive40", batarya_kwh: 83.9, tuketim: 16.1 },
    { id: "23", marka: "BMW", model: "i4 M50", batarya_kwh: 83.9, tuketim: 18.0 },
    { id: "24", marka: "BMW", model: "iX1 eDrive20", batarya_kwh: 64.7, tuketim: 15.4 },
    { id: "25", marka: "BMW", model: "iX1 xDrive30", batarya_kwh: 64.7, tuketim: 17.3 },
    { id: "26", marka: "BMW", model: "iX2 eDrive20", batarya_kwh: 64.7, tuketim: 15.3 },
    { id: "27", marka: "BMW", model: "iX2 xDrive30", batarya_kwh: 64.7, tuketim: 16.3 },
    { id: "28", marka: "BMW", model: "iX3", batarya_kwh: 80.0, tuketim: 18.5 },
    { id: "29", marka: "BMW", model: "i5 eDrive40", batarya_kwh: 81.2, tuketim: 16.3 },
    { id: "30", marka: "BMW", model: "i5 M60 xDrive", batarya_kwh: 81.2, tuketim: 18.2 },
    { id: "31", marka: "BMW", model: "iX xDrive40", batarya_kwh: 76.6, tuketim: 20.1 },
    { id: "32", marka: "BMW", model: "iX xDrive50", batarya_kwh: 111.5, tuketim: 21.2 },
    { id: "33", marka: "BMW", model: "i7 xDrive60", batarya_kwh: 105.7, tuketim: 18.4 },
    { id: "34", marka: "Mercedes-Benz", model: "EQA 250+", batarya_kwh: 70.5, tuketim: 15.4 },
    { id: "35", marka: "Mercedes-Benz", model: "EQA 350 4MATIC", batarya_kwh: 66.5, tuketim: 17.5 },
    { id: "36", marka: "Mercedes-Benz", model: "EQB 250+", batarya_kwh: 70.5, tuketim: 16.1 },
    { id: "37", marka: "Mercedes-Benz", model: "EQB 350 4MATIC", batarya_kwh: 66.5, tuketim: 18.1 },
    { id: "38", marka: "Mercedes-Benz", model: "EQC 400 4MATIC", batarya_kwh: 80.0, tuketim: 22.2 },
    { id: "39", marka: "Mercedes-Benz", model: "EQE 300", batarya_kwh: 89.0, tuketim: 15.9 },
    { id: "40", marka: "Mercedes-Benz", model: "EQE 350+", batarya_kwh: 90.6, tuketim: 16.5 },
    { id: "41", marka: "Mercedes-Benz", model: "EQE 350 4MATIC SUV", batarya_kwh: 90.6, tuketim: 18.5 },
    { id: "42", marka: "Mercedes-Benz", model: "EQE 500 4MATIC SUV", batarya_kwh: 90.6, tuketim: 18.8 },
    { id: "43", marka: "Mercedes-Benz", model: "EQS 450+", batarya_kwh: 108.4, tuketim: 17.3 },
    { id: "44", marka: "Mercedes-Benz", model: "EQS 580 4MATIC", batarya_kwh: 108.4, tuketim: 18.3 },
    { id: "45", marka: "Mercedes-Benz", model: "EQS 450 4MATIC SUV", batarya_kwh: 108.4, tuketim: 20.0 },
    { id: "46", marka: "Volkswagen", model: "ID.3 Pro", batarya_kwh: 58.0, tuketim: 15.4 },
    { id: "47", marka: "Volkswagen", model: "ID.4 Pro", batarya_kwh: 77.0, tuketim: 16.5 },
    { id: "48", marka: "Volkswagen", model: "ID.4 GTX", batarya_kwh: 77.0, tuketim: 17.6 },
    { id: "49", marka: "Volkswagen", model: "ID.5 Pro", batarya_kwh: 77.0, tuketim: 16.2 },
    { id: "50", marka: "Volkswagen", model: "ID.6 Crozz/X", batarya_kwh: 84.8, tuketim: 17.0 },
    { id: "51", marka: "Volkswagen", model: "ID.7 Pro", batarya_kwh: 77.0, tuketim: 14.1 },
    { id: "52", marka: "Volkswagen", model: "e-Golf", batarya_kwh: 35.8, tuketim: 13.8 },
    { id: "53", marka: "Audi", model: "Q4 40 e-tron", batarya_kwh: 82.0, tuketim: 17.3 },
    { id: "54", marka: "Audi", model: "Q4 45 e-tron", batarya_kwh: 82.0, tuketim: 16.7 },
    { id: "55", marka: "Audi", model: "Q8 50 e-tron", batarya_kwh: 95.0, tuketim: 20.1 },
    { id: "56", marka: "Audi", model: "Q8 55 e-tron", batarya_kwh: 114.0, tuketim: 20.6 },
    { id: "57", marka: "Audi", model: "e-tron GT quattro", batarya_kwh: 93.4, tuketim: 19.9 },
    { id: "58", marka: "Audi", model: "RS e-tron GT", batarya_kwh: 93.4, tuketim: 20.6 },
    { id: "59", marka: "Porsche", model: "Taycan RWD", batarya_kwh: 89.0, tuketim: 19.6 },
    { id: "60", marka: "Porsche", model: "Taycan 4S", batarya_kwh: 93.4, tuketim: 21.0 },
    { id: "61", marka: "Porsche", model: "Taycan Turbo", batarya_kwh: 93.4, tuketim: 21.6 },
    { id: "62", marka: "Porsche", model: "Macan 4 Electric", batarya_kwh: 100.0, tuketim: 17.9 },
    { id: "63", marka: "Hyundai", model: "Ioniq 5 Standart Menzil", batarya_kwh: 58.0, tuketim: 16.7 },
    { id: "64", marka: "Hyundai", model: "Ioniq 5 Uzun Menzil RWD", batarya_kwh: 77.4, tuketim: 17.0 },
    { id: "65", marka: "Hyundai", model: "Ioniq 5 Uzun Menzil AWD", batarya_kwh: 77.4, tuketim: 17.9 },
    { id: "66", marka: "Hyundai", model: "Ioniq 6 RWD", batarya_kwh: 77.4, tuketim: 14.3 },
    { id: "67", marka: "Hyundai", model: "Ioniq 6 AWD", batarya_kwh: 77.4, tuketim: 15.1 },
    { id: "68", marka: "Hyundai", model: "Kona Elektrik (48.4 kWh)", batarya_kwh: 48.4, tuketim: 14.6 },
    { id: "69", marka: "Hyundai", model: "Kona Elektrik (65.4 kWh)", batarya_kwh: 65.4, tuketim: 14.7 },
    { id: "70", marka: "Kia", model: "Niro EV", batarya_kwh: 64.8, tuketim: 15.7 },
    { id: "71", marka: "Kia", model: "EV6 RWD", batarya_kwh: 77.4, tuketim: 16.5 },
    { id: "72", marka: "Kia", model: "EV6 GT-Line AWD", batarya_kwh: 77.4, tuketim: 17.2 },
    { id: "73", marka: "Kia", model: "EV9 AWD", batarya_kwh: 99.8, tuketim: 22.8 },
    { id: "74", marka: "MG", model: "MG4 Comfort (51 kWh)", batarya_kwh: 51.0, tuketim: 17.0 },
    { id: "75", marka: "MG", model: "MG4 Luxury (64 kWh)", batarya_kwh: 64.0, tuketim: 16.0 },
    { id: "76", marka: "MG", model: "MG4 XPOWER", batarya_kwh: 64.0, tuketim: 18.7 },
    { id: "77", marka: "MG", model: "ZS EV Luxury", batarya_kwh: 72.6, tuketim: 17.8 },
    { id: "78", marka: "MG", model: "Marvel R Performance", batarya_kwh: 70.0, tuketim: 19.4 },
    { id: "79", marka: "Volvo", model: "EX30 Single Motor", batarya_kwh: 51.0, tuketim: 16.7 },
    { id: "80", marka: "Volvo", model: "EX30 Extended Range", batarya_kwh: 69.0, tuketim: 15.7 },
    { id: "81", marka: "Volvo", model: "EX30 Twin Motor Performance", batarya_kwh: 69.0, tuketim: 16.3 },
    { id: "82", marka: "Volvo", model: "XC40/EX40 Recharge Single Motor", batarya_kwh: 69.0, tuketim: 17.1 },
    { id: "83", marka: "Volvo", model: "C40/EC40 Recharge Single Motor", batarya_kwh: 69.0, tuketim: 16.5 },
    { id: "84", marka: "Polestar", model: "Polestar 2 Long Range Dual Motor", batarya_kwh: 82.0, tuketim: 16.0 },
    { id: "85", marka: "Renault", model: "Megane E-Tech (60 kWh)", batarya_kwh: 60.0, tuketim: 15.8 },
    { id: "86", marka: "Renault", model: "Zoe E-Tech (52 kWh)", batarya_kwh: 52.0, tuketim: 17.2 },
    { id: "87", marka: "Renault", model: "Scenic E-Tech (87 kWh)", batarya_kwh: 87.0, tuketim: 16.8 },
    { id: "88", marka: "Dacia", model: "Spring Extreme", batarya_kwh: 26.8, tuketim: 13.9 },
    { id: "89", marka: "Peugeot", model: "e-208", batarya_kwh: 50.0, tuketim: 15.4 },
    { id: "90", marka: "Peugeot", model: "e-2008", batarya_kwh: 54.0, tuketim: 15.4 },
    { id: "91", marka: "Peugeot", model: "e-308", batarya_kwh: 54.0, tuketim: 15.1 },
    { id: "92", marka: "Peugeot", model: "e-3008", batarya_kwh: 73.0, tuketim: 16.7 },
    { id: "93", marka: "Opel", model: "Corsa Elektrik", batarya_kwh: 50.0, tuketim: 15.8 },
    { id: "94", marka: "Opel", model: "Mokka Elektrik", batarya_kwh: 54.0, tuketim: 15.2 },
    { id: "95", marka: "Opel", model: "Astra Elektrik", batarya_kwh: 54.0, tuketim: 14.8 },
    { id: "96", marka: "Citroën", model: "e-C4", batarya_kwh: 50.0, tuketim: 15.3 },
    { id: "97", marka: "Citroën", model: "e-C4 X", batarya_kwh: 54.0, tuketim: 15.0 },
    { id: "98", marka: "Fiat", model: "500e (42 kWh)", batarya_kwh: 42.0, tuketim: 14.0 },
    { id: "99", marka: "Fiat", model: "600e", batarya_kwh: 54.0, tuketim: 15.1 },
    { id: "100", marka: "Jeep", model: "Avenger", batarya_kwh: 54.0, tuketim: 15.4 },
    { id: "101", marka: "Cupra", model: "Born (58 kWh)", batarya_kwh: 58.0, tuketim: 15.5 },
    { id: "102", marka: "Mini", model: "Cooper SE", batarya_kwh: 54.2, tuketim: 14.1 },
    { id: "103", marka: "Mini", model: "Countryman SE", batarya_kwh: 66.4, tuketim: 17.5 },
    { id: "104", marka: "Skywell", model: "ET5", batarya_kwh: 72.0, tuketim: 19.3 },
    { id: "105", marka: "KG Mobility", model: "Torres EVX", batarya_kwh: 73.4, tuketim: 18.7 },
    { id: "106", marka: "Leapmotor", model: "T03", batarya_kwh: 41.3, tuketim: 15.7 },
    { id: "107", marka: "Leapmotor", model: "C10", batarya_kwh: 69.9, tuketim: 16.5 },
    { id: "108", marka: "Ford", model: "Mustang Mach-E RWD", batarya_kwh: 75.7, tuketim: 17.2 },
    { id: "109", marka: "Nissan", model: "Leaf (40 kWh)", batarya_kwh: 40.0, tuketim: 17.1 },
    { id: "110", marka: "Nissan", model: "Ariya (87 kWh)", batarya_kwh: 87.0, tuketim: 18.5 },
    { id: "111", marka: "Skoda", model: "Enyaq iV 80", batarya_kwh: 82.0, tuketim: 16.0 },
    { id: "112", marka: "Toyota", model: "bZ4X AWD", batarya_kwh: 71.4, tuketim: 15.8 },
    { id: "113", marka: "Subaru", model: "Solterra AWD", batarya_kwh: 71.4, tuketim: 16.0 },
    { id: "114", marka: "Smart", model: "#1", batarya_kwh: 66.0, tuketim: 16.7 },
    { id: "115", marka: "Seres", model: "Seres 3", batarya_kwh: 53.6, tuketim: 18.0 }
];

const MARKA_FIYATLARI = { ZES: 10.49, Trugo: 9.99, Eşarj: 10.99, Voltrun: 9.95, Sharz: 10.00 };

// API'den Araçları Çeken Fonksiyon (Güncellendi: Sadece yerel listeyi döndürür)
async function araclariGetir() {
    return DEV_YEDEK_LISTE;
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