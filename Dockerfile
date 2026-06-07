# Temel imaj olarak Ubuntu kullanıyoruz
FROM ubuntu:22.04

# Gerekli temel paketleri yükle
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    ca-certificates \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Bun kurulumu
RUN curl -fsSL https://bun.sh/install | bash

# Bun yolunu tanımla
ENV PATH="/root/.bun/bin:${PATH}"

# Antigravity CLI kurulumu
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash

# Çalışma dizinini ayarla
WORKDIR /app

# Konteyner başladığında bash kabuğunu aç
CMD ["/bin/bash"]
