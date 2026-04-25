{
  description = "Digitable studio server deployed with deploy-rs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    deploy-rs.url = "github:serokell/deploy-rs";
  };

  outputs = {
    self,
    nixpkgs,
    deploy-rs,
    ...
  }: let
    system = "x86_64-linux";
    lib = nixpkgs.lib;
    pkgs = import nixpkgs {inherit system;};
    repoRoot = /home/simon/projects/digitable/digitable-app/current-1;

    studioDomain = "localhost";
    studioPort = 3000;

    # This path-flake packages prebuilt studio artifacts from the local checkout.
    studioBuild = builtins.path {
      path = repoRoot + "/packages/studio/build";
      name = "studio-build";
    };

    studioPackageJson = builtins.path {
      path = repoRoot + "/packages/studio/package.json";
      name = "studio-package.json";
    };

    rootNodeModules = builtins.path {
      path = repoRoot + "/node_modules";
      name = "studio-node-modules";
    };

    studioPackage = pkgs.stdenv.mkDerivation {
      pname = "studio";
      version = "0.0.1";
      dontUnpack = true;

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/studio
        mkdir -p $out/packages/app
        mkdir -p $out/packages/game-server

        cp ${studioPackageJson} $out/packages/studio/package.json
        cp -r ${studioBuild} $out/packages/studio/build
        cp -r ${rootNodeModules} $out/node_modules
        cp ${repoRoot + "/packages/app/package.json"} $out/packages/app/package.json
        cp ${repoRoot + "/packages/game-server/package.json"} $out/packages/game-server/package.json

        runHook postInstall
      '';
    };

    server = lib.nixosSystem {
      inherit system;
      specialArgs = {
        inherit studioDomain studioPackage studioPort;
      };
      modules = [
        ./modules/locale.nix
        ({
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

          services.openssh.enable = true;

          users.users.demo = {
            isNormalUser = true;
            extraGroups = ["wheel"];
            initialPassword = "demo";
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

          virtualisation.vmVariant = {
            virtualisation.memorySize = 2048;
            virtualisation.cores = 2;
            virtualisation.forwardPorts = [
              {
                from = "host";
                host.port = 2222;
                guest.port = 22;
              }
              {
                from = "host";
                host.port = 5432;
                guest.port = 5432;
              }
              {
                from = "host";
                host.port = 8080;
                guest.port = 80;
              }
              {
                from = "host";
                host.port = 8443;
                guest.port = 443;
              }
            ];
          };
        })
      ];
    };
  in {
    packages.${system} = {
      default = studioPackage;
      studio = studioPackage;
    };

    nixosConfigurations.studio = server;

    deploy.nodes.studio = {
      hostname = "your-server-ip-or-dns";
      sshUser = "root";

      profiles.system = {
        user = "root";
        path = deploy-rs.lib.${system}.activate.nixos self.nixosConfigurations.studio;
      };
    };

    checks =
      builtins.mapAttrs
      (_: deployLib: deployLib.deployChecks self.deploy)
      deploy-rs.lib;
  };
}
