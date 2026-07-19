# Deploy runbook: hosting the Aegis live demo

Everything here runs on infrastructure you control — a cloud account, a
domain-free DNS trick, and a small VM. Nothing in this repo can provision
these for you, so follow the steps below in order.

Estimated time: 30-45 minutes the first time.

## 1. Push the repo to GitHub

```bash
git add -A
git commit -m "Initial commit"
gh repo create aegis --public --source=. --push
# or: create the repo on github.com, then
#   git remote add origin git@github.com:<you>/aegis.git
#   git push -u origin main
```

## 2. Create the free VM (Oracle Cloud "Always Free")

1. Sign up at https://signup.oraclecloud.com (needs a card for identity
   verification only — the Always Free shapes are never billed).
2. Compute → Instances → Create Instance.
3. Shape: pick an **Ampere (ARM) `VM.Standard.A1.Flex`** shape — the free tier
   includes up to 4 OCPUs / 24GB RAM total across your Ampere instances.
   (If Ampere capacity is unavailable in your region, the `VM.Standard.E2.1.Micro`
   x86 shape is also Always Free, just smaller — this stack will still run on it.)
4. Image: Ubuntu 22.04 (or later LTS).
5. Add your SSH public key under "Add SSH keys".
6. Create the instance and note its **public IP address**.

## 3. Open ports 80 and 443

Oracle's default security list blocks inbound traffic beyond SSH. Two places
to open, both required:

- **Oracle Console**: Networking → Virtual Cloud Networks → your VCN →
  Security Lists → default security list → Add Ingress Rules:
  - Source `0.0.0.0/0`, TCP, destination port `80`
  - Source `0.0.0.0/0`, TCP, destination port `443`
- **On the VM itself** (Oracle's Ubuntu images also run `iptables`/`ufw`):
  ```bash
  sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save   # if installed; otherwise the rule is enough for this session
  ```

## 4. Install Docker on the VM

```bash
ssh ubuntu@<VM_PUBLIC_IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version   # confirm the compose plugin is present
```

## 5. Clone the repo and configure secrets

```bash
git clone https://github.com/<you>/aegis.git
cd aegis

ADMIN_TOKEN=$(openssl rand -hex 24)
cat > .env <<EOF
DOMAIN=aegis.$(curl -s ifconfig.me | tr '.' '-').sslip.io
ADMIN_TOKEN=${ADMIN_TOKEN}
EOF
cat .env
```

`sslip.io` resolves `aegis.<A>-<B>-<C>-<D>.sslip.io` to the IP `A.B.C.D`
automatically — no domain purchase, and it's a real public DNS name so Caddy
can still get you a genuine Let's Encrypt certificate.

**Save the printed `ADMIN_TOKEN` somewhere private** — it's what you'll use to
call the manual `/heal` override yourself later; nobody else can trigger it
without this value.

## 6. Bring the stack up

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps
```

Give Caddy 10-20 seconds to obtain its certificate on first boot, then visit:

```
https://<the DOMAIN value from your .env>
```

You should see the dashboard, live metrics updating every 3 seconds, and an
"Inject Chaos" button row.

## 7. Verify the safety layer

```bash
# Should be rate-limited/cooldown-protected, not open season:
curl -X POST https://<domain>/api/healer/chaos/trigger \
  -H 'Content-Type: application/json' -d '{"scenario":"kill-random"}'

# Should 401 without the token:
curl -X POST https://<domain>/api/healer/heal/service-a \
  -H 'Content-Type: application/json' -d '{"action":"restart"}'

# Should succeed with it:
curl -X POST https://<domain>/api/healer/heal/service-a \
  -H 'Content-Type: application/json' -H "X-Admin-Token: ${ADMIN_TOKEN}" \
  -d '{"action":"restart"}'
```

## 8. Redeploying after future changes

```bash
cd aegis
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Ongoing costs

- Oracle Always Free VM: **$0/mo**, no expiry, as long as you stay within the
  free-tier shape limits.
- `sslip.io` + Let's Encrypt via Caddy: **$0**.
- The only real cost risk is Oracle's identity-verification card being
  charged if you exceed free-tier resources — this stack (6 small containers)
  stays comfortably inside them.
