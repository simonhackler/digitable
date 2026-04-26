# Nix Infrastructure

Targets:

- `studio-install`: install with `nixos-anywhere`
- `studio-vm`: local VM
- `studio-prod`: deployed system used by `deploy-rs`

Build both SvelteKit apps first:

```bash
cd packages/app
bun run build

cd packages/studio
KIT_API_KEY=dummy KIT_FORM_ID=dummy bun run build
```

The flake reads `packages/app/build`, `packages/studio/build`, and `node_modules` from your checkout via
`DIGITABLE_REPO_ROOT`, so include it in the commands below.

## Install

Check the target disk in [disko/hetzner.nix](./disko/hetzner.nix), then run:

```bash
cd infrastructure/nix
DIGITABLE_REPO_ROOT="$(realpath ../..)" \
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
DIGITABLE_REPO_ROOT="$(realpath ../..)" \
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
DIGITABLE_REPO_ROOT="$(realpath ../..)" \
  nix run github:serokell/deploy-rs -- \
  "path:$(realpath ../..)?dir=infrastructure/nix#studio"
```
