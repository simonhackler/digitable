{
  description = "Digitable studio server for install, VM testing, and deploy-rs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    deploy-rs.url = "github:serokell/deploy-rs";
    deploy-rs.inputs.nixpkgs.follows = "nixpkgs";
    disko.url = "github:nix-community/disko";
    disko.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    deploy-rs,
    disko,
    ...
  }: let
    system = "x86_64-linux";
    lib = nixpkgs.lib;
    pkgs = import nixpkgs {inherit system;};
    repoRoot = let
      envRepoRoot = builtins.getEnv "DIGITABLE_REPO_ROOT";
    in
      if envRepoRoot == "" then ../.. else /. + envRepoRoot;
    adminPublicKeys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID3iigCfo016qrs9rlsr6uISm/3x6nOa5b66FcwjnnRF simonhackler@gmail.com"
    ];
    studioProdDomain = "digitable.ink";

    studioInstallDomain = let
      envDomain = builtins.getEnv "STUDIO_DOMAIN";
    in
      if envDomain == "" then "localhost" else envDomain;

    studioPort = 3000;
    appPort = 3001;

    # This path-flake packages prebuilt app artifacts from the local checkout.
    appBuild = builtins.path {
      path = repoRoot + "/packages/app/build";
      name = "app-build";
    };

    appPackageJson = builtins.path {
      path = repoRoot + "/packages/app/package.json";
      name = "app-package.json";
    };

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
        cp ${appPackageJson} $out/packages/app/package.json
        cp -r ${appBuild} $out/packages/app/build
        cp ${repoRoot + "/packages/game-server/package.json"} $out/packages/game-server/package.json

        runHook postInstall
      '';
    };

    mkStudioSystem = {
      studioDomain,
      extraModules ? [],
    }:
      lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit adminPublicKeys appPort studioDomain studioPackage studioPort;
        };
        modules =
          [
            ./modules/locale.nix
            ./hosts/studio.nix
          ]
          ++ extraModules;
      };

    studioDiskoModules = [
      disko.nixosModules.disko
      ./disko/hetzner.nix
    ];

    studioInstall = mkStudioSystem {
      studioDomain = studioInstallDomain;
      extraModules = studioDiskoModules;
    };

    studioVm = mkStudioSystem {
      studioDomain = "localhost";
      extraModules = [
        ./hosts/studio-vm.nix
      ];
    };

    studioProd = mkStudioSystem {
      studioDomain = studioProdDomain;
      extraModules = studioDiskoModules;
    };
  in {
    packages.${system} = {
      default = studioPackage;
      studio = studioPackage;
    };

    nixosConfigurations = {
      "studio-install" = studioInstall;
      "studio-vm" = studioVm;
      "studio-prod" = studioProd;
    };

    deploy.nodes.studio = {
      hostname = "digitable.ink";
      sshUser = "root";

      profiles.system = {
        user = "root";
        path = deploy-rs.lib.${system}.activate.nixos studioProd;
      };
    };

    checks =
      builtins.mapAttrs
      (_: deployLib: deployLib.deployChecks self.deploy)
      deploy-rs.lib;
  };
}
