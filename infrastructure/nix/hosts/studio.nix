{
  adminPublicKeys,
  pkgs,
  lib,
  modulesPath,
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
in {
  imports = [
    (modulesPath + "/profiles/qemu-guest.nix")
  ];

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

  users.users.demo = {
    isNormalUser = true;
    extraGroups = ["wheel"];
    initialPassword = "demo";
    openssh.authorizedKeys.keys = adminPublicKeys;
  };

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
          reverse_proxy 127.0.0.1:${toString studioPort}
        '';
      }
      // lib.optionalAttrs (!isDirectHost) {
        "www.${studioDomain}".extraConfig = ''
          redir https://${studioDomain}{uri} permanent
        '';
      };
  };

  systemd.services.studio = {
    description = "Digitable Studio";
    wantedBy = ["multi-user.target"];
    after = ["network-online.target"];
    wants = ["network-online.target"];

    environment = {
      HOST = "127.0.0.1";
      PORT = toString studioPort;
      ORIGIN = studioOrigin;
      NODE_ENV = "production";
    };

    serviceConfig = {
      Type = "simple";
      WorkingDirectory = "${studioPackage}/packages/studio";
      ExecStart = "${pkgs.nodejs}/bin/node build";
      Restart = "on-failure";
      DynamicUser = true;
    };
  };

  networking.firewall.allowedTCPPorts = [22 80 443];
}
