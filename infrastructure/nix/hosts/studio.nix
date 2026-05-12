{
  config,
  adminPublicKeys,
  pkgs,
  lib,
  modulesPath,
  appPort,
  enableAppSecrets ? true,
  studioDomain,
  studioPackage,
  studioPort,
  ...
}: let
  isDirectHost =
    studioDomain == "localhost"
    || builtins.match "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$" studioDomain != null;
  studioOrigin = "${if isDirectHost then "http" else "https"}://${studioDomain}";
  caddySiteAddress = if isDirectHost then ":80" else studioDomain;
  databaseUrl = "postgresql://app@localhost/app?host=/run/postgresql";
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
  appSecretsServiceConfig = lib.optionalAttrs enableAppSecrets {
    EnvironmentFile = config.sops.templates."app.env".path;
  };
  mkNodeService = {
    description,
    port,
    workingDirectory,
    extraServiceConfig ? {},
  }: {
    inherit description;
    wantedBy = ["multi-user.target"];
    after = ["network-online.target"];
    wants = ["network-online.target"];

    environment = {
      HOST = "127.0.0.1";
      PORT = toString port;
      ORIGIN = studioOrigin;
      NODE_ENV = "production";
    } // authEnvironment;

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

    secrets.better-auth-secret = {};
    secrets.replicate-api-token = {};

    templates."app.env".content = ''
      BETTER_AUTH_SECRET=${config.sops.placeholder.better-auth-secret}
      REPLICATE_API_TOKEN=${config.sops.placeholder.replicate-api-token}
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
    ensureDatabases = ["app"];
    ensureUsers = [
      {
        name = "app";
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
      // lib.optionalAttrs (!isDirectHost) {
        "www.${studioDomain}".extraConfig = ''
          redir https://${studioDomain}{uri} permanent
        '';
      };
  };

  systemd.services.studio = mkNodeService {
    description = "Digitable Studio";
    port = studioPort;
    workingDirectory = "${studioPackage}/packages/studio";
    extraServiceConfig = appSecretsServiceConfig;
  };

  systemd.services.app = mkNodeService {
    description = "Digitable App";
    port = appPort;
    workingDirectory = "${studioPackage}/packages/app";
    extraServiceConfig = appSecretsServiceConfig;
  };

  networking.firewall.allowedTCPPorts = [22 80 443];
}
