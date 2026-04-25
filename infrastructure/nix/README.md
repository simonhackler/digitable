# Nix Infrastructure

Targets:

- `studio-install`: install with `nixos-anywhere`
- `studio-vm`: local VM
- `studio-prod`: deployed system used by `deploy-rs`

Build Studio first:

```bash
cd packages/studio
KIT_API_KEY=dummy KIT_FORM_ID=dummy bun run build
```

## Install

Check the target disk in [disko/hetzner.nix](./disko/hetzner.nix), then run:

```bash
cd infrastructure/nix
STUDIO_DOMAIN=your-domain.example \
  nix run github:nix-community/nixos-anywhere -- \
  --flake "path:$(realpath ../..)?dir=infrastructure/nix#studio-install" \
  --target-host root@YOUR_SERVER_IP
```

For IP-only testing, use the server IP as `STUDIO_DOMAIN`.
For a real domain install, set `STUDIO_DOMAIN` to that domain.

## VM

```bash
cd infrastructure/nix
nixos-rebuild build-vm --flake "path:$(realpath ../..)?dir=infrastructure/nix#studio-vm"
./result/bin/run-studio-vm
```

VM ports:

- `http://localhost:18080`
- `https://localhost:8443`
- `ssh demo@localhost -p 2222`
- `localhost:15432`

## Deploy

`studio-prod` is fixed to `digitable.ink`. Deploy with:

```bash
cd infrastructure/nix
nix run github:serokell/deploy-rs -- \
  "path:$(realpath ../..)?dir=infrastructure/nix#studio"
```
