#!/bin/bash

# ============================================================
#  PulseMsg — DigitalOcean VPS Full Setup Script
#  Run this as root on a fresh Ubuntu 24.04 Droplet
#  Usage: bash setup.sh
# ============================================================

set -e  # Exit immediately on any error

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()     { echo -e "${GREEN}[✔]${RESET} $1"; }
info()    { echo -e "${CYAN}[→]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[!]${RESET} $1"; }
error()   { echo -e "${RED}[✘]${RESET} $1"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${RESET}"; echo -e "${BOLD}  $1${RESET}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════${RESET}\n"; }

# ── Collect user input ────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ██████╗ ██╗   ██╗██╗     ███████╗███████╗"
echo "  ██╔══██╗██║   ██║██║     ██╔════╝██╔════╝"
echo "  ██████╔╝██║   ██║██║     ███████╗█████╗  "
echo "  ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  "
echo "  ██║     ╚██████╔╝███████╗███████║███████╗"
echo "  ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝"
echo -e "${RESET}"
echo -e "${CYAN}  PulseMsg — VPS Setup Script${RESET}"
echo -e "${CYAN}  DigitalOcean Ubuntu 24.04${RESET}\n"

# Prompt for GitHub repo
read -p "$(echo -e ${YELLOW})Enter your GitHub repo URL (e.g. https://github.com/you/pulsemsg): $(echo -e ${RESET})" GITHUB_REPO
[ -z "$GITHUB_REPO" ] && error "GitHub repo URL is required."

# Prompt for domain or IP
read -p "$(echo -e ${YELLOW})Enter your domain or server IP (e.g. yourdomain.com or 167.99.10.123): $(echo -e ${RESET})" SERVER_HOST
[ -z "$SERVER_HOST" ] && error "Domain or IP is required."

# Prompt for Twilio credentials
echo ""
info "Enter your Twilio credentials (from https://console.twilio.com):"
read -p "  Twilio Account SID: " TWILIO_SID
read -p "  Twilio Auth Token:  " TWILIO_TOKEN
read -p "  Twilio Phone Number (e.g. +15551234567): " TWILIO_PHONE

[ -z "$TWILIO_SID" ]   && error "Twilio Account SID is required."
[ -z "$TWILIO_TOKEN" ] && error "Twilio Auth Token is required."
[ -z "$TWILIO_PHONE" ] && error "Twilio Phone Number is required."

# Optional: ask about SSL
echo ""
read -p "$(echo -e ${YELLOW})Enable free HTTPS/SSL with Let's Encrypt? (requires a domain, not an IP) [y/N]: $(echo -e ${RESET})" ENABLE_SSL

APP_DIR="/var/www/pulsemsg"

echo ""
info "Starting setup with:"
echo "   Repo:   $GITHUB_REPO"
echo "   Host:   $SERVER_HOST"
echo "   Dir:    $APP_DIR"
echo ""
read -p "$(echo -e ${YELLOW})Press ENTER to continue or Ctrl+C to cancel...$(echo -e ${RESET})"

# ── Step 1: System update ─────────────────────────────────
section "Step 1/8 — System Update"
info "Updating package lists..."
apt update -y
info "Upgrading installed packages..."
apt upgrade -y
log "System updated."

# ── Step 2: Install Node.js 20 ────────────────────────────
section "Step 2/8 — Install Node.js 20 LTS"
info "Adding NodeSource repo..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
info "Installing Node.js..."
apt install -y nodejs
log "Node.js $(node -v) installed."
log "NPM $(npm -v) installed."

# ── Step 3: Install tools ─────────────────────────────────
section "Step 3/8 — Install PM2, Nginx & Git"
info "Installing PM2 (process manager)..."
npm install -g pm2 > /dev/null 2>&1
log "PM2 $(pm2 -v) installed."

info "Installing Nginx..."
apt install -y nginx
log "Nginx installed."

info "Installing Git..."
apt install -y git
log "Git $(git --version) installed."

# ── Step 4: Clone repo ────────────────────────────────────
section "Step 4/8 — Clone GitHub Repository"
info "Cloning $GITHUB_REPO into $APP_DIR..."
mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
  warn "Directory $APP_DIR already exists — pulling latest instead."
  cd $APP_DIR && git pull origin main
else
  git clone "$GITHUB_REPO" "$APP_DIR"
fi
cd $APP_DIR
log "Repository ready at $APP_DIR"

# ── Step 5: Install dependencies ─────────────────────────
section "Step 5/8 — Install Node Dependencies"
info "Running npm install..."
npm install --production
log "Dependencies installed."

# ── Step 6: Create .env file ──────────────────────────────
section "Step 6/8 — Configure Environment Variables"
info "Writing .env file..."
cat > $APP_DIR/.env << EOF
TWILIO_ACCOUNT_SID=$TWILIO_SID
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN
TWILIO_PHONE_NUMBER=$TWILIO_PHONE
PORT=3000
EOF
chmod 600 $APP_DIR/.env
log ".env file created (permissions: 600 — owner only)."

# ── Step 7: Start with PM2 ────────────────────────────────
section "Step 7/8 — Start App with PM2"
info "Starting PulseMsg with PM2..."
cd $APP_DIR
pm2 delete pulsemsg 2>/dev/null || true
pm2 start server.js --name pulsemsg
pm2 save

info "Configuring PM2 to start on boot..."
PM2_STARTUP=$(pm2 startup systemd -u root --hp /root | tail -1)
eval "$PM2_STARTUP" > /dev/null 2>&1

log "PulseMsg is running!"
pm2 status pulsemsg

# ── Step 8: Configure Nginx ───────────────────────────────
section "Step 8/8 — Configure Nginx Reverse Proxy"
info "Writing Nginx config for $SERVER_HOST..."
cat > /etc/nginx/sites-available/pulsemsg << EOF
server {
    listen 80;
    server_name $SERVER_HOST;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 90;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/pulsemsg /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t && systemctl restart nginx && systemctl enable nginx
log "Nginx configured and running."

# ── Firewall ──────────────────────────────────────────────
info "Configuring UFW firewall..."
ufw allow OpenSSH    > /dev/null
ufw allow 'Nginx Full' > /dev/null
ufw --force enable   > /dev/null
log "Firewall enabled (SSH + HTTP + HTTPS allowed)."

# ── Optional: SSL ─────────────────────────────────────────
if [[ "$ENABLE_SSL" =~ ^[Yy]$ ]]; then
  section "Bonus — HTTPS SSL Certificate (Let's Encrypt)"
  info "Installing Certbot..."
  apt install -y certbot python3-certbot-nginx > /dev/null 2>&1
  info "Requesting SSL certificate for $SERVER_HOST..."
  certbot --nginx -d "$SERVER_HOST" --non-interactive --agree-tos --register-unsafely-without-email
  log "SSL certificate installed! Auto-renewal is active."
fi

# ── Create deploy script ──────────────────────────────────
info "Writing deploy.sh for future updates..."
cat > $APP_DIR/deploy.sh << 'DEPLOYEOF'
#!/bin/bash
# Run this anytime you push new code to GitHub
set -e
echo "🚀 Deploying PulseMsg..."
cd /var/www/pulsemsg
git pull origin main
npm install --production
pm2 restart pulsemsg
pm2 save
echo "✅ Deploy complete at $(date)"
pm2 status pulsemsg
DEPLOYEOF
chmod +x $APP_DIR/deploy.sh
log "deploy.sh ready — run it anytime: bash /var/www/pulsemsg/deploy.sh"

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  ✅  SETUP COMPLETE!${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${RESET}"
echo ""
if [[ "$ENABLE_SSL" =~ ^[Yy]$ ]]; then
  echo -e "  🌐  App URL:    ${BOLD}https://$SERVER_HOST${RESET}"
else
  echo -e "  🌐  App URL:    ${BOLD}http://$SERVER_HOST${RESET}"
fi
echo -e "  📋  PM2 logs:  ${BOLD}pm2 logs pulsemsg${RESET}"
echo -e "  🔄  Update:    ${BOLD}bash $APP_DIR/deploy.sh${RESET}"
echo -e "  📁  App dir:   ${BOLD}$APP_DIR${RESET}"
echo ""
warn "Keep your .env file safe — it contains your Twilio secret keys."
echo ""
