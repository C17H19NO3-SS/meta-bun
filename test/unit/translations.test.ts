import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { TranslationManager } from "../../src/ts/shared/translations";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("Çeviri Yöneticisi (TranslationManager) Birim Testleri", () => {
  const translationsDir = join(process.cwd(), "translations_test_unit");

  beforeEach(() => {
    try {
      mkdirSync(translationsDir, { recursive: true });
    } catch (e) {}
  });

  afterEach(() => {
    try {
      rmSync(translationsDir, { recursive: true, force: true });
    } catch (e) {}
  });

  it("JSON dosyalarından çevirileri başarıyla yükleyebilmelidir", () => {
    const enContent = {
      "Welcome": "Welcome to the server",
      "Hello": "Hello {0}"
    };
    const trContent = {
      "Welcome": "Sunucuya hoş geldiniz",
      "Hello": "Merhaba {0}"
    };

    writeFileSync(join(translationsDir, "en.json"), JSON.stringify(enContent));
    writeFileSync(join(translationsDir, "tr.json"), JSON.stringify(trContent));

    const manager = new TranslationManager(translationsDir);
    manager.LoadTranslations("test_plugin");

    expect(manager.GetTranslation("test_plugin", "Welcome", "en")).toBe("Welcome to the server");
    expect(manager.GetTranslation("test_plugin", "Welcome", "tr")).toBe("Sunucuya hoş geldiniz");
  });

  it("Çeviri metinlerindeki biçimlendirme argümanlarını doğru şekilde işlemelidir", () => {
    const enContent = {
      "Hello": "Hello {0}"
    };
    writeFileSync(join(translationsDir, "en.json"), JSON.stringify(enContent));

    const manager = new TranslationManager(translationsDir);
    manager.LoadTranslations("test_plugin");

    expect(manager.GetTranslation("test_plugin", "Hello", "en")).toBe("Hello {0}");
  });

  it("İstenen dile ait çeviri bulunamadığında varsayılan İngilizce (en) diline dönmelidir", () => {
    const enContent = {
      "Welcome": "Welcome"
    };
    writeFileSync(join(translationsDir, "en.json"), JSON.stringify(enContent));

    const manager = new TranslationManager(translationsDir);
    manager.LoadTranslations("test_plugin");

    expect(manager.GetTranslation("test_plugin", "Welcome", "fr")).toBe("Welcome");
  });

  it("Hiçbir dilde karşılığı olmayan bir çeviri istendiğinde anahtarın (key) kendisini döndürmelidir", () => {
    const manager = new TranslationManager(translationsDir);
    expect(manager.GetTranslation("test_plugin", "NonExistent", "en")).toBe("NonExistent");
  });
});
