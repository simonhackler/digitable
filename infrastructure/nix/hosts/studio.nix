{
  adminPublicKeys,
  pkgs,
  lib,
  studioDomain,
  studioPackage,
  studioPort,
  ...
}: {
  networking.hostName = "studio";
  system.stateVersion = "25.11";

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
    virtualHosts.${studioDomain}.extraConfig = ''
      encode zstd gzip
      reverse_proxy 127.0.0.1:${toString studioPort}
    '';
  };

  systemd.services.studio = {
    description = "Digitable Studio";
    wantedBy = ["multi-user.target"];
    after = ["network-online.target"];
    wants = ["network-online.target"];

    environment = {
      HOST = "127.0.0.1";
      PORT = toString studioPort;
      ORIGIN = "http://${studioDomain}";
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
