# Tek Thread (Single-Threaded) Köprü Mimarisi Uygulama Planı

> **Gemini İçin:** GEREKLİ ALT YETENEK: Bu planı görev görev (task-by-task) uygulamak için superpowers:executing-plans kullanın.

**Hedef:** Arka plan thread'lerini ve kilit (mutex) mekanizmalarını kaldırarak, tüm ağ ve motor işlemlerini ana thread üzerinde "non-blocking" (engellemeyen) şekilde gerçekleştirmek.

**Mimari:** Sockets `O_NONBLOCK` moduna alınacak. `OnGameFrame` döngüsü her karede ağ verisini kontrol edecek ve motor API çağrılarını (komut kaydı vb.) anında yapacak.

**Teknoloji Yığını:** C++, Metamod:Source, Berkeley Sockets (Non-blocking).

---

### Görev 1: `plugin.h` Dosyasının Temizlenmesi ve Güncellenmesi

**Dosyalar:**
- Düzenle: `src/cpp/plugin.h`

**Adım 1: Threading ile ilgili üyeleri silin**
*   `m_ReceiveThread`, `m_TaskMutex`, `m_QueueMutex`, `m_CommandTaskQueue`, `m_CommandQueue` üyelerini kaldırın.

**Adım 2: Yeni yardımcı değişkenler ekleyin**
*   `std::vector<uint8_t> m_ReceiveBuffer;` ekleyerek kısmi gelen paketleri ana thread'de saklayın.

---

### Görev 2: Soketlerin Non-Blocking Yapılması (`plugin.cpp`)

**Dosyalar:**
- Düzenle: `src/cpp/plugin.cpp`

**Adım 1: `StartServer` içerisinde soketi engellemeyen moda alın**
```cpp
int flags = fcntl(m_ListenSocket, F_GETFL, 0);
fcntl(m_ListenSocket, F_SETFL, flags | O_NONBLOCK);
```

**Adım 2: `ReceiveThread` fonksiyonunu silin.**

---

### Görev 3: Ana Döngüde Köprü Güncelleme (`UpdateBridge`)

**Dosyalar:**
- Düzenle: `src/cpp/plugin.cpp`

**Adım 1: `UpdateBridge` fonksiyonunu oluşturun**
*   Bu fonksiyon `accept()` ve `recv()` çağrılarını `EWOULDBLOCK` hatasını kontrol ederek (bloklamadan) yapacak.
*   Gelen veriyi anında `ProcessMessage` fonksiyonuna gönderecek.

**Adım 2: `OnGameFrame` içerisinde `UpdateBridge` çağrısını ekleyin**
*   `OnGameFrame` fonksiyonunun başına `UpdateBridge();` ekleyin.
*   `OnGameFrame` kancasının (hook) çalıştığından emin olmak için başına bir log ekleyin.

---

### Görev 4: `ProcessMessage` Fonksiyonunda Doğrudan İşleme

**Dosyalar:**
- Düzenle: `src/cpp/plugin.cpp`

**Adım 1: Kuyruk işlemlerini kaldırın**
*   `register_command`, `server_cmd` gibi aksiyonlarda veriyi kuyruğa eklemek yerine doğrudan `icvar->RegisterConCommand` veya `engine->ServerCommand` çağrılarını yapın.
*   Zaten ana thread'de olduğumuz için `m_TaskMutex` kilidine ihtiyaç kalmayacak.

---

### Görev 5: Derleme ve Doğrulama

**Adım 1: Derleme**
Komut: `bun run build`

**Adım 2: Test**
Sunucuyu başlatın ve `sm_help` komutunun artık çalıştığını, konsolda `OnGameFrame` loglarının aktığını doğrulayın.
