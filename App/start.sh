#!/bin/bash
set -e

# Créer le répertoire logs si n'existe pas
mkdir -p /var/logs/crud

# Lancer l'application Node en arrière-plan
echo "Démarrage de Node.js..."
nohup node index.js > /var/logs/crud/app.log 2>&1 &

# Lancer Nginx au premier plan
echo "Démarrage de Nginx..."
nginx -g "daemon off;"