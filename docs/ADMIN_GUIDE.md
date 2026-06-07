# MetaBun Admin Yönetim Sistemi

Bu doküman, MetaBun framework'ü üzerindeki yetki sisteminin nasıl yapılandırılacağını ve yönetileceğini açıklar.

## 📂 Dosya Yapısı

Tüm admin ayarları `configs/admins/` klasörü altında toplanmıştır:

1.  **`list.json`**: Adminlerin listesi ve bireysel yetkileri.
2.  **`groups.json`**: Yetki grupları (VIP, Admin, Root vb.) ve kalıtım ayarları.
3.  **`presets.json`**: Ban/Kick sebepleri ve süreleri.
4.  **`overrides.json`**: Komut bazlı özel yetki atamaları.

---

## 1. Admin Ekleme (`list.json`)

Adminleri SteamID (SteamID2 formatı önerilir) kullanarak ekleyebilirsiniz.

```json
{
  "STEAM_1:0:123456": {
    "flags": "abcdefg",
    "immunity": 50,
    "groups": ["Admin"],
    "expires_at": 0
  },
  "STEAM_1:1:654321": "z" 
}
```

*   **`flags`**: Sahip olduğu yetki harfleri.
*   **`immunity`**: Bağışıklık seviyesi. Daha düşük seviyeli bir admin, daha yüksek seviyeli bir admini kickleyemez/banlayamaz.
*   **`groups`**: `groups.json` içinde tanımlı gruplara dahil eder.
*   **`expires_at`**: Unix timestamp formatında bitiş süresi (0 = sınırsız).
*   **"z" (Root)**: Tüm yetkilere sahip en üst düzey yetki harfidir.

---

## 2. Grupları Yapılandırma (`groups.json`)

Gruplar, toplu yetki yönetimini kolaylaştırır ve kalıtımı (inheritance) destekler.

```json
{
  "VIP": {
    "flags": "ao",
    "immunity": 10
  },
  "Admin": {
    "flags": "bcdefg",
    "immunity": 50,
    "inherit": "VIP"
  },
  "Root": {
    "flags": "z",
    "immunity": 99,
    "inherit": "Admin"
  }
}
```

*   **`inherit`**: Belirtilen grubun tüm yetkilerini otomatik olarak devralır.

---

## 3. Yetki Harfleri (Flags)

| Harf | Açıklama |
| :---: | :--- |
| **a** | Rezervasyon (Dolu sunucuya giriş) |
| **b** | Genel admin yetkisi |
| **c** | Kick yetkisi |
| **d** | Ban yetkisi |
| **e** | Unban yetkisi |
| **f** | Slay/Slap yetkisi |
| **g** | Harita değiştirme yetkisi |
| **h** | Cvar değiştirme yetkisi |
| **i** | Config çalıştırma yetkisi |
| **j** | Özel chat yetkileri |
| **k** | Oylama başlatma yetkisi |
| **l** | Şifre koyma yetkisi |
| **m** | RCON yetkisi |
| **o** | Özel eklenti yetkisi 1 (VIP vb.) |
| **z** | **Root (Tüm yetkiler)** |

---

## 4. Komut Bazlı Yetki Değişimi (`overrides.json`)

Bir eklentinin komutunun yetkisini değiştirmek için kullanılır.

```json
{
  "commands": {
    "sm_slap": "z",
    "sm_map": "g",
    "meta-bun": "z"
  }
}
```

---

## 5. Oyun İçi ve Konsol Komutları

Admin yönetimi için sunucu konsolundan veya oyundan şu komutları kullanabilirsiniz:

*   `sm_reloadadmins`: Tüm admin dosyalarını yeniden yükler.
*   `meta-bun list`: Yüklü eklentileri ve durumlarını gösterir.
*   `sm_who`: Oyundaki oyuncuların yetki durumlarını listeler.
