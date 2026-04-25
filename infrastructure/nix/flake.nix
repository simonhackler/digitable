{
  description = "Digitable studio server for local VM testing and NixOS Anywhere installs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    deploy-rs.url = "github:serokell/deploy-rs";
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
    envOr = name: fallback: let value = builtins.getEnv name; in if value == "" then fallback else value;
    infraRoot = let
      explicitInfraRoot = builtins.getEnv "DIGITABLE_INFRA_ROOT";
      pwd = builtins.getEnv "PWD";
    in
      if explicitInfraRoot != ""
      then /. + explicitInfraRoot
      else if pwd != ""
      then /. + pwd
      else throw ''
        Set DIGITABLE_INFRA_ROOT to the absolute infrastructure/nix path when evaluating this flake impurely.
        Example:
          DIGITABLE_INFRA_ROOT=/abs/path/to/repo/infrastructure/nix nixos-rebuild build-vm --flake .#studio-vm --impure
      '';
    repoRoot = /. + envOr "DIGITABLE_REPO_ROOT" "${builtins.toString infraRoot}/../..";

    adminPublicKeys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID3iigCfo016qrs9rlsr6uISm/3x6nOa5b66FcwjnnRF simonhackler@gmail.com"
    ];

    studioInstallDomain = let
      envDomain = builtins.getEnv "STUDIO_DOMAIN";
    in
      if envDomain == "" then "localhost" else envDomain;

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

    mkStudioSystem = {
      studioDomain,
      extraModules ? [],
    }:
      lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit adminPublicKeys studioDomain studioPackage studioPort;
        };
        modules =
          [
            (infraRoot + "/modules/locale.nix")
            (infraRoot + "/hosts/studio.nix")
          ]
          ++ extraModules;
      };

    studioInstall = mkStudioSystem {
      studioDomain = studioInstallDomain;
      extraModules = [
        disko.nixosModules.disko
        (infraRoot + "/disko/hetzner.nix")
      ];
    };

    studioVm = mkStudioSystem {
      studioDomain = "localhost";
      extraModules = [
        (infraRoot + "/hosts/studio-vm.nix")
      ];
    };
  in {
    packages.${system} = {
      default = studioPackage;
      studio = studioPackage;
    };

    nixosConfigurations = {
      studio = studioInstall;
      "studio-install" = studioInstall;
      "studio-vm" = studioVm;
    };

    deploy.nodes.studio = {
      hostname = "your-server-ip-or-dns";
      sshUser = "root";

      profiles.system = {
        user = "root";
        path = deploy-rs.lib.${system}.activate.nixos studioInstall;
      };
    };

    checks =
      builtins.mapAttrs
      (_: deployLib: deployLib.deployChecks self.deploy)
      deploy-rs.lib;
  };
}
