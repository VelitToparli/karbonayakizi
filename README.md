# karbonayakizi

Kurumsal karbon ayak izi hesaplama uygulamasi.

## Ozellikler

- 3 ana tedarik grubu ve adim bazli hesaplama (Miktar x Katsayi)
- Detayli sonuc sayfasi (grup kirilimi + en etkili adimlar)
- Sonuclari PDF ve Excel olarak disa aktarma
- Aylik ve yillik karsilastirma grafikleri
- Basit backend ile kayitlari kalici saklama
- Katsayilari otomatik olarak `public/factors.json` (ve varsa `public/factors.xlsx`) dosyasindan yukleme

## Gereksinimler

- Node.js 18+
- npm

## Scriptler

- `npm run dev`: Sadece frontend (Vite)
- `npm run server`: Sadece backend API (Express)
- `npm run dev:full`: Frontend + backend birlikte
- `npm run build`: Production build
- `npm run preview`: Build cikisini lokal sunma

## Lokal Calistirma

1. Bagimliliklari kurun:
   `npm install`
2. Frontend + backend birlikte calistirin:
   `npm run dev:full`
3. Tarayicida Vite adresini acin (varsayilan: http://localhost:5173)

## API Uclari

- `GET /api/records`: Kayitli hesaplamalar
- `POST /api/records`: Yeni hesaplama kaydi
- `GET /api/analytics?year=YYYY`: Aylik/yillik analiz verisi

## Notlar

- Backend verisi `server/db.json` dosyasinda saklanir.
- Vite proxy ayari ile frontend tarafinda `/api` cagrilari otomatik olarak backend'e yonlenir.
- Katsayi alanlari arayuzde salt-okunur durumdadir, kullanici tarafindan degistirilemez.
