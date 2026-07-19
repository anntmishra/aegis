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

## 2. Create the VM (Azure)

Using the Azure account you already have (Student or the standard 12-months-free
account both work the same way from here):

1. [portal.azure.com](https://portal.azure.com) → **Virtual machines** → **Create** → **Azure virtual machine**.
2. **Basics** tab:
   - Image: **Ubuntu Server 22.04 LTS** (or later LTS).
   - Size: click "See all sizes" and pick **`B1s`** (1 vCPU/1GB) if you want to
     stay inside the free-tier hours — it's enough for this stack, but tight.
     If you'd rather have headroom and don't mind it drawing down your credit
     instead, **`B1ms`** or **`B2s`** (2-4GB RAM) runs the 6 containers more
     comfortably. You can resize the VM later without recreating it if `B1s`
     turns out too tight.
   - Authentication type: **SSH public key** — either upload your own
     (`~/.ssh/id_ed25519.pub`) or let Azure generate a new pair for you to download.
3. **Networking** tab: leave the default new virtual network/subnet. Under
   "Public inbound ports", select **Allow selected ports** and add **HTTP (80)**,
   **HTTPS (443)**, and **SSH (22)** — this creates the Network Security Group
   rules for you, equivalent to Oracle's security list step.
4. **Review + create** → **Create**. Once it's deployed, note the VM's
   **public IP address** from the resource's overview page.

If you'd rather script this than click through the portal:
```bash
az vm create \
  --resource-group <your-resource-group> \
  --name aegis-vm \
  --image Ubuntu2204 \
  --size Standard_B1s \
  --admin-username azureuser \
  --generate-ssh-keys
az vm open-port --resource-group <your-resource-group> --name aegis-vm --port 80 --priority 900
az vm open-port --resource-group <your-resource-group> --name aegis-vm --port 443 --priority 901
```

## 3. Install Docker on the VM

```bash
ssh <the-admin-username-you-set>@<VM_PUBLIC_IP>

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version   # confirm the compose plugin is present
```

## 4. Clone the repo and configure secrets

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

## 5. Bring the stack up

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

## 6. Verify the safety layer

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

## 7. Redeploying after future changes

```bash
cd aegis
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Ongoing costs

- **Azure for Students**: ~$100 credit, valid 12 months, no card on file — a
  `B1s` VM running this stack 24/7 draws only a few dollars a month from that
  credit, so it'll last comfortably for the whole year. Check
  **Cost Management + Billing → Cost analysis** in the portal occasionally to
  see the burn rate.
- **Standard Azure free account**: the first 12 months include a free `B1s`
  Linux VM's hours — staying on that exact size keeps this at **$0/mo**;
  anything you provision beyond it draws from the $200 initial credit or your
  card once that's exhausted.
- `sslip.io` + Let's Encrypt via Caddy: **$0** either way.
- If you stop actively demoing it, `docker compose down` on the VM (or just
  deleting the VM resource) stops any further spend immediately.
