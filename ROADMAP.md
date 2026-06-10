# MetaBun Roadmap

MetaBun, TypeScript ve Bun'ın gücünü Metamod:Source ekosistemine taşıyan, yüksek performanslı ve modern bir eklenti framework'üdür. Bu yol haritası, geliştirici deneyimini (DX) en üst düzeye çıkarmayı ve mimari sağlamlığı korumayı amaçlamaktadır.

## 🟢 Aşama 1: Sağlam Temeller ve Dokümantasyon (Şu Anki Odak)

Bu aşamanın temel amacı, bir geliştiricinin MetaBun ile eklenti geliştirmeye başlamasını sorunsuz hale getirmek ve kod tabanındaki tip güvenliğini (type-safety) mükemmelleştirmektir.

### 📚 Dokümantasyon ve Rehberler
- **Başlangıç Rehberi (Getting Started):** Kurulumdan ilk "Merhaba Dünya" eklentisine kadar olan süreci kapsayan adım adım rehber.
- **En İyi Pratikler (Best Practices):** Performanslı kod yazımı, bellek yönetimi ve MetaBun mimarisine uygun geliştirme standartları.
- **Natives & Events Kataloğu:** Mevcut tüm native fonksiyonların ve oyun olaylarının açıklamalı listesi.

### 🏗️ Çekirdek ve Tip Sistemi
- **Event Typing Overhaul:** Tüm Source Engine olaylarının (CS2, CSS, TF2) eksiksiz TypeScript arayüzlerinin oluşturulması.
- **Natives Standardizasyonu:** Mevcut native fonksiyonların (Player, Console, Timers) parametre ve dönüş tiplerinin tutarlı hale getirilmesi.
- **Hata Yönetimi:** Köprü (Bridge) ve eklenti seviyesindeki hatalar için daha açıklayıcı ve yakalanabilir hata sınıflarının eklenmesi.

## 🟡 Aşama 2: API Dokümantasyonu ve Native Genişletme (Yakında)

Bu aşamada, ilk aşamada attığımız temellerin üzerine eklenti geliştiricilerinin ihtiyaç duyacağı ileri seviye araçları ve otomatikleşmiş süreçleri inşa edeceğiz.

### 🌐 Otomatik API Dokümantasyonu
- **TypeDoc Entegrasyonu:** Kaynak kodundaki yorum satırlarından otomatik olarak web tabanlı, aranabilir bir API referansı oluşturulması.
- **Kapsamlı Örnekler:** Her native fonksiyonu için dokümantasyon içerisinde açıklayıcı kod örneklerinin bulunması.

### 🔌 Native Fonksiyonların Derinleşmesi
- **Entity Yönetimi:** Oyun içi nesnelerin (entities) oluşturulması, özelliklerinin (props) okunması ve değiştirilmesi için gelişmiş native desteği.
- **World Manipulation:** Harita üzerinde ışınlanma, efektler ve seslerin kontrolü için yeni fonksiyonlar.
- **Gelişmiş Menü Sistemi:** Dinamik ve çok sayfalı menü yapıları için daha esnek bir API.

### 🛠️ Geliştirici Araçları
- **Hata Ayıklama (Debugging) Modu:** Geliştirme aşamasında köprü üzerinden geçen tüm paketlerin izlenebileceği detaylı log sistemi.
- **Eklenti İzleyici (Watcher):** Eklenti dosyalarında yapılan değişikliklerin anında fark edilmesi ve geliştiriciye bildirilmesi (hot-reload öncesi hazırlık).

## 🔴 Aşama 3: Performans, Hot-Reload ve Test Ekosistemi (Gelecek)

Bu aşamada MetaBun'ı en üst seviyeye taşıyacak, büyük ölçekli sunucuların ve profesyonel geliştiricilerin hayatını kolaylaştıracak özelliklere odaklanacağız.

### ⚡ Performans ve Ölçeklenebilirlik
- **Binary Bridge Protocol:** JSON tabanlı iletişimden, MsgPack veya Protobuf gibi ikili (binary) formatlara tam geçiş yaparak köprü performansını maksimize etmek.
- **Worker Threads:** Yoğun hesaplama gerektiren eklenti işlemlerinin ana döngüyü (main loop) aksatmaması için Bun'ın worker thread desteğinin entegre edilmesi.

### 🔥 Gelişmiş Geliştirici Özellikleri
- **Hot-Reload:** Sunucuyu veya Bun uygulamasını kapatmaya gerek kalmadan, sadece değişen eklentinin anında yeniden yüklenmesi.

### 🧪 Test ve Kalite Kontrol
- **Mocking Framework:** Bir oyun sunucusuna ihtiyaç duymadan, eklenti mantığının bilgisayarınızda test edilebilmesi için sahte (mock) bir Source Engine ortamı.
- **Entegre Test Aracı:** `bun test` ile tam uyumlu, eklentiler için birim (unit) ve entegrasyon test şablonları.
