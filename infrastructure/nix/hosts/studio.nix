{
  config,
  adminPublicKeys,
  pkgs,
  lib,
  modulesPath,
  appPort,
  enableAppSecrets ? true,
  gameServerPort,
  gameServerPublicPort,
  studioDomain,
  studioPackage,
  studioPort,
  ...
}: let
  databaseName = "app";
  databaseUser = "app";
  databaseUrl = "postgresql:///${databaseName}?host=/run/postgresql&user=${databaseUser}";
  isDirectHost =
    studioDomain == "localhost"
    || builtins.match "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$" studioDomain != null;
  studioOrigin = "${if isDirectHost then "http" else "https"}://${studioDomain}";
  caddySiteAddress = if isDirectHost then ":80" else studioDomain;
  gameServerOrigin =
    if isDirectHost
    then "http://${studioDomain}:${toString gameServerPublicPort}"
    else "https://${studioDomain}:${toString gameServerPublicPort}";
  tracewayUrl = "https://traceway.digitable.ink";
  tracewayProjectToken = "d42d96c40edb48faa6a156375f48cc05";
  tracewayAppVersion = "0.0.1";
  authEnvironment =
    {
      DATABASE_URL = databaseUrl;
      BETTER_AUTH_URL = studioOrigin;
      WEB_ORIGIN = studioOrigin;
      SECOND_WEB_ORIGIN = "";
      AUTH_COOKIE_DOMAIN = "";
    }
    // lib.optionalAttrs (!enableAppSecrets) {
      BETTER_AUTH_SECRET = "vm-local-better-auth-secret-change-before-production";
    };
  appSecretServiceConfig = lib.optionalAttrs enableAppSecrets {
    EnvironmentFile = config.sops.templates."app.env".path;
  };
  studioSecretServiceConfig = lib.optionalAttrs enableAppSecrets {
    EnvironmentFile = config.sops.templates."studio.env".path;
  };
  mkNodeService = {
    description,
    port,
    workingDirectory,
    extraEnvironment ? {},
    extraServiceConfig ? {},
  }: {
    inherit description;
    wantedBy = ["multi-user.target"];
    after = ["network-online.target" "db-migrate.service"];
    wants = ["network-online.target"];
    requires = ["db-migrate.service"];

    environment = {
      HOST = "127.0.0.1";
      PORT = toString port;
      ORIGIN = studioOrigin;
      NODE_ENV = "production";
      BETTER_AUTH_SECRET = "%m";
      DATABASE_URL = databaseUrl;
      PUBLIC_GAME_SERVER_URL = gameServerOrigin;
      WEB_ORIGIN = studioOrigin;
      SECOND_WEB_ORIGIN = "${studioOrigin}/app";
    }
    // extraEnvironment;

    serviceConfig =
      {
        Type = "simple";
        WorkingDirectory = workingDirectory;
        ExecStart = "${pkgs.nodejs}/bin/node build";
        Restart = "on-failure";
        DynamicUser = true;
      }
      // extraServiceConfig;
  };
in {
  imports = [
    (modulesPath + "/profiles/qemu-guest.nix")
  ];

  sops = lib.mkIf enableAppSecrets {
    defaultSopsFile = ../secrets/secrets.yaml;
    defaultSopsFormat = "yaml";

    secrets.replicate-api-token = {};
    secrets.s3-access-key-id = {};
    secrets.s3-secret-access-key = {};
    secrets.kit-api-key = {};

    templates."app.env".content = ''
      REPLICATE_API_TOKEN=${config.sops.placeholder.replicate-api-token}
      S3_ACCESS_KEY_ID=${config.sops.placeholder.s3-access-key-id}
      S3_SECRET_ACCESS_KEY=${config.sops.placeholder.s3-secret-access-key}
    '';

    templates."studio.env".content = ''
      KIT_API_KEY=${config.sops.placeholder.kit-api-key}
    '';
  };

  networking.hostName = "studio";
  networking.useDHCP = lib.mkDefault true;
  system.stateVersion = "25.11";

  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";

  nix.settings.experimental-features = ["nix-command" "flakes"];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "prohibit-password";
    };
  };

  users.users.root.openssh.authorizedKeys.keys = adminPublicKeys;

  services.postgresql = {
    enable = true;
    ensureDatabases = [databaseName];
    ensureUsers = [
      {
        name = databaseUser;
        ensureDBOwnership = true;
      }
    ];

    authentication = lib.mkOverride 10 ''
      local all all trust
    '';
  };

  services.caddy = {
    enable = true;
    globalConfig = lib.optionalString isDirectHost ''
      auto_https off
    '';
    virtualHosts =
      {
        ${caddySiteAddress}.extraConfig = ''
          encode zstd gzip

          handle /app* {
            reverse_proxy 127.0.0.1:${toString appPort}
          }

          handle {
            reverse_proxy 127.0.0.1:${toString studioPort}
          }
        '';
      }
      // lib.optionalAttrs isDirectHost {
        ":${toString gameServerPublicPort}".extraConfig = ''
          reverse_proxy 127.0.0.1:${toString gameServerPort}
        '';
      }
      // lib.optionalAttrs (!isDirectHost) {
        "${studioDomain}:${toString gameServerPublicPort}".extraConfig = ''
          encode zstd gzip
          reverse_proxy 127.0.0.1:${toString gameServerPort}
        '';

        "www.${studioDomain}".extraConfig = ''
          redir https://${studioDomain}{uri} permanent
        '';
      };
  };

  systemd.services.db-migrate = {
    description = "Digitable database migrations";
    wantedBy = ["multi-user.target"];
    after = ["postgresql.service"];
    wants = ["postgresql.service"];
    before = ["studio.service" "app.service"];

    environment = {
      DATABASE_URL = databaseUrl;
      NODE_ENV = "production";
    };

    serviceConfig = {
      Type = "oneshot";
      WorkingDirectory = "${studioPackage}/packages/db";
      ExecStart = "${pkgs.bun}/bin/bun run db:migrate";
      RemainAfterExit = true;
    };
  };

  systemd.services.studio = mkNodeService {
    description = "Digitable Studio";
    port = studioPort;
    workingDirectory = "${studioPackage}/packages/studio";
    extraEnvironment = {
      BETTER_AUTH_URL = studioOrigin;
      OTEL_SERVICE_NAME = "digitable-studio";
      OTEL_SERVICE_VERSION = tracewayAppVersion;
      PUBLIC_APP_VERSION = tracewayAppVersion;
      PUBLIC_TRACEWAY_CONNECTION = "${tracewayProjectToken}@${tracewayUrl}/api/report";
      TRACEWAY_PROJECT_TOKEN = tracewayProjectToken;
      TRACEWAY_URL = tracewayUrl;
    };
    extraServiceConfig = studioSecretServiceConfig;
  };

  systemd.services.app = mkNodeService {
    description = "Digitable App";
    port = appPort;
    workingDirectory = "${studioPackage}/packages/app";
    extraServiceConfig = appSecretServiceConfig;
    extraEnvironment =
      {
        BETTER_AUTH_URL = "${studioOrigin}/app";
        OTEL_SERVICE_NAME = "digitable-app";
        OTEL_SERVICE_VERSION = tracewayAppVersion;
        PUBLIC_APP_VERSION = tracewayAppVersion;
        PUBLIC_TRACEWAY_CONNECTION = "${tracewayProjectToken}@${tracewayUrl}/api/report";
        TRACEWAY_PROJECT_TOKEN = tracewayProjectToken;
        TRACEWAY_URL = tracewayUrl;
        BODY_SIZE_LIMIT = "256M";
      }
      // lib.optionalAttrs enableAppSecrets {
        S3_BUCKET = "digitable";
        S3_ENDPOINT = "https://s3.eu-central-003.backblazeb2.com";
        S3_FORCE_PATH_STYLE = "true";
        S3_REGION = "eu-central-003";
      };
  };

  systemd.services.game-server = mkNodeService {
    description = "Digitable Game Server";
    port = gameServerPort;
    workingDirectory = "${studioPackage}/packages/game-server";
    extraEnvironment = {
      BETTER_AUTH_URL = "${studioOrigin}/app";
    };
    extraServiceConfig = {
      ExecStart = "${studioPackage}/packages/game-server/node_modules/.bin/tsx src/index.ts";
    };
  };

  networking.firewall.allowedTCPPorts = [22 80 443 gameServerPublicPort];
}
