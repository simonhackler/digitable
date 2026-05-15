# Nix Infrastructure

Targets:

- `studio-install`: install with `nixos-anywhere`
- `studio-vm`: local VM
- `studio-prod`: deployed system used by `deploy-rs`

The flake builds both SvelteKit apps from source with Bun. It resolves the repo root relative to
`infrastructure/nix/flake.nix`, so no repo-root environment variable is required.

Secrets are read through `sops-nix` from `infrastructure/nix/secrets/secrets.yaml`. The host expects an age
identity derived from the server's SSH host key and currently declares:

- `replicate-api-token`, rendered into `app.env` as `REPLICATE_API_TOKEN`
- `s3-access-key-id`, rendered into `app.env` as `S3_ACCESS_KEY_ID`
- `s3-secret-access-key`, rendered into `app.env` as `S3_SECRET_ACCESS_KEY`

Make sure that encrypted key exists in `infrastructure/nix/secrets/secrets.yaml` before deploying.

The production app stores playtest project files in the private Backblaze B2 bucket `digitable`. Non-secret S3
settings are hardcoded in `hosts/studio.nix`:

- endpoint: `https://s3.eu-central-003.backblazeb2.com`
- region: `eu-central-003`
- bucket: `digitable`
- path-style requests: enabled

Use a bucket-scoped Backblaze Application Key for `s3-access-key-id` and `s3-secret-access-key`; do not use the
Backblaze master application key. Set `s3-access-key-id` to Backblaze's generated `keyID` value, not the key name
shown in the Backblaze UI. Set `s3-secret-access-key` to the generated `applicationKey` value.

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

The encrypted secrets file is tracked in Git and decrypted on the target through `sops-nix`.

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
nix -L run github:serokell/deploy-rs -- \
  "git+file://$(realpath ../..)?dir=infrastructure/nix&submodules=1#studio"
```
