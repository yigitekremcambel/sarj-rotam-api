const express = require('express');
const router = express.Router();
const { kayitOl, girisYap, profilGetir, araclariListele, rotaHesapla, kodGonder, hesapSil } = require('../controllers/apiController');

router.post('/kod-gonder', kodGonder); 
router.post('/kayit-ol', kayitOl);
router.post('/giris-yap', girisYap);
router.get('/profil/:user_id', profilGetir);
router.get('/araclar', araclariListele);
router.get('/rota-hesapla', rotaHesapla);
router.delete('/hesap-sil/:user_id', hesapSil); // YENİ EKLENEN SİLME ROTASI

module.exports = router;