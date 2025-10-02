#!/bin/bash
# Script para configurar Railway Volume e persistir sessão WhatsApp

echo "🚂 Configurando Railway Volume para persistir sessão WhatsApp..."
echo ""

# Step 1: Login
echo "1️⃣ Fazendo login no Railway (vai abrir o navegador)..."
railway login

if [ $? -ne 0 ]; then
    echo "❌ Erro no login. Tente novamente."
    exit 1
fi

# Step 2: Link project
echo ""
echo "2️⃣ Conectando ao projeto..."
railway link

if [ $? -ne 0 ]; then
    echo "❌ Erro ao conectar ao projeto. Tente novamente."
    exit 1
fi

# Step 3: Create volume
echo ""
echo "3️⃣ Criando volume para /app/data..."
railway volume create --mount /app/data --size 1

if [ $? -ne 0 ]; then
    echo "❌ Erro ao criar volume. Verifique se já existe um volume."
    exit 1
fi

echo ""
echo "✅ Volume configurado com sucesso!"
echo "🎯 A partir de agora, a sessão WhatsApp será persistida entre deploys."
echo "📱 Você só precisará escanear o QR code UMA VEZ!"
echo ""
echo "🚀 O Railway vai fazer redeploy automaticamente."
echo "⏳ Aguarde ~2-3 minutos e escaneie o QR code pela última vez!"
