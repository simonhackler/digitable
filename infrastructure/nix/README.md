# Nix Infrastructure

This flake supports two workflows:

- local VM testing with `build-vm`
- fresh-server installation with `nixos-anywhere` and Disko

Both workflows package the prebuilt `packages/studio/build` output from the
local checkout, so build Studio first from the repo root:

```bash
cd packages/studio
KIT_API_KEY=dummy KIT_FORM_ID=dummy bun run build
```

## Local VM

Build the VM from `infrastructure/nix`:

```bash
cd infrastructure/nix
nixos-rebuild build-vm --flake .#studio-vm --impure
```

Start it:

```bash
./result/bin/run-studio-vm
```

Forwarded host ports:

- `http://localhost:18080` redirects to HTTPS
- `https://localhost:8443` serves Studio
- `ssh demo@localhost -p 2222` connects to the VM
- `localhost:15432` forwards PostgreSQL

## NixOS Anywhere

The install target is `.#studio`. It imports Disko and uses
[disko/hetzner.nix](./disko/hetzner.nix) for the disk layout.

Before installing:

1. Verify the target disk path in `disko/hetzner.nix`.
2. Set `STUDIO_DOMAIN` if the host should not serve `localhost`.
3. Ensure the root SSH key in `hosts/studio.nix` matches the machine you will
   install from.

Install with:

```bash
cd infrastructure/nix
STUDIO_DOMAIN=your-domain.example \
  nix run github:nix-community/nixos-anywhere -- \
  --flake .#studio \
  --target-host root@YOUR_SERVER_IP
```

After the machine is installed, the same `.#studio` config is the one used by
`deploy-rs`.
