# Update system
apt update && apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 (process manager — keeps app alive after reboot)
npm install -g pm2

# Install Nginx (reverse proxy — serves app on port 80/443)
apt install -y nginx

# Install Git
apt install -y git

# Verify installations
echo "Node: $(node -v)"
echo "NPM:  $(npm -v)"
echo "PM2:  $(pm2 -v)"
echo "Nginx: $(nginx -v)"
