FROM node:20-slim

# Instalar dependencias del sistema y Deno para que yt-dlp pueda ejecutar JS
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# Añadir Deno al PATH
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Instalar yt-dlp globalmente
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copiar archivos de dependencias e instalar
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Eliminar el .exe de Windows para que no moleste en el contenedor
RUN rm -f yt-dlp.exe

# Construir la aplicación Astro
RUN npm run build

# Exponer el puerto
ENV HOST=0.0.0.0
ENV PORT=10000
EXPOSE 10000

# Arrancar la app (usando el servidor de Astro node)
CMD ["node", "./dist/server/entry.mjs"]
