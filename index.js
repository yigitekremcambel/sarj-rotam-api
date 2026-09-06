const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Gelen istekleri kabul etme ayarları
app.use(cors());
app.use(express.json());

// TÜM API YOLLARINI '/api' ÖNEKİNE BAĞLIYORUZ
app.use('/api', apiRoutes);

const PORT = 10000;
app.listen(PORT, () => {
    console.log(`Node.js Sunucusu ${PORT} portunda başarıyla çalışıyor! 🚀`);
});