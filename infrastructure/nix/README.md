# Nix Infrastructure

Targets:

- `studio-install`: install with `nixos-anywhere`
- `studio-vm`: local VM
- `studio-prod`: deployed system used by `deploy-rs`

The flake builds both SvelteKit apps from source with Bun. It resolves the repo root relative to
`infrastructure/nix/flake.nix`, so no repo-root environment variable is required.

Secrets are read through `sops-nix` from `infrastructure/nix/secrets/secrets.yaml`. The host expects an age
identity derived from the server's SSH host key and currently declares `replicate-api-token`, which is rendered
into `app.env` as `REPLICATE_API_TOKEN`.
Make sure that encrypted key exists in `infrastructure/nix/secrets/secrets.yaml` before deploying.

To add a new secret:

1. Edit `infrastructure/nix/secrets/secrets.yaml` with `sops`, for example:

   ```bash
   sops infrastructure/nix/secrets/secrets.yaml
   ```

   Then add a new top-level key such as:

   ```yaml
   replicate-api-token: your-secret-value
   ```

   and save the file so `sops` re-encrypts it.

2. Declare it in `infrastructure/nix/hosts/studio.nix` as `sops.secrets.<name> = {};`.
3. If a service needs it as an environment variable, add it to a `sops.templates.*.content` block and wire that
   template into `systemd.services.<name>.serviceConfig.EnvironmentFile`.

Because the secrets file is currently untracked, `deploy-rs` must be run with `-- --impure`.

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
  "path:$(realpath ../..)?dir=infrastructure/nix#studio" \
  -- --impure
```
