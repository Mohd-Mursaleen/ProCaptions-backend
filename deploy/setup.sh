#!/bin/bash

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
sudo apt-get install nginx -y

# Configure Nginx
sudo tee /etc/nginx/sites-available/procaptions <<EOF
server {
    listen 80;
    server_name md.geteniac.tech;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/procaptions /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Install Certbot for SSL
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Get SSL certificate
sudo certbot --nginx -d md.geteniac.tech --non-interactive --agree-tos --email mhdpope@example.com

# Create upload directories
mkdir -p uploads/{original,processed,temp,public}
chmod -R 755 uploads

echo "Setup completed successfully!"
