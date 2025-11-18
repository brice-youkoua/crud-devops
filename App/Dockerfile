FROM node:20

# Installer Nginx
RUN apt-get update && \
    apt-get install -y nginx && \
    rm -rf /var/lib/apt/lists/*

# Création répertoire app
WORKDIR /usr/src/app

# Copier package.json et installer dépendances
COPY package*.json ./
RUN npm install

# Copier le code source
COPY . .

# Copier config Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Donner les droits d'exécution à start.sh
RUN chmod +x start.sh

# Expose port 80 pour Nginx
EXPOSE 80

# Commande de démarrage
CMD ["/bin/bash", "./start.sh"]
