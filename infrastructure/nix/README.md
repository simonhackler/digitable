# Nix VM

This flake packages the prebuilt `packages/studio/build` output from the local
checkout, so build Studio first from the repo root:

```bash
cd packages/studio
KIT_API_KEY=dummy KIT_FORM_ID=dummy bun run build
```

Then build the VM from `infrastructure/nix`:

```bash
cd infrastructure/nix
sudo nixos-rebuild build-vm --flake .#studio --impure
```

Start the VM:

```bash
./result/bin/run-studio-vm
```

Forwarded ports:

- `http://localhost:8080` redirects to HTTPS
- `https://localhost:8443` serves Studio
- `ssh demo@localhost -p 2222` connects to the VM
- `localhost:5432` forwards PostgreSQL
```
