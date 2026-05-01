{
  description = "Digitable studio server for install, VM testing, and deploy-rs";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    deploy-rs.url = "github:serokell/deploy-rs";
    deploy-rs.inputs.nixpkgs.follows = "nixpkgs";
    disko.url = "github:nix-community/disko";
    disko.inputs.nixpkgs.follows = "nixpkgs";

    sops-nix = {
      url = "github:Mic92/sops-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    deploy-rs,
    disko,
    sops-nix,
    ...
  }: let
    system = "x86_64-linux";
    lib = nixpkgs.lib;
    pkgs = import nixpkgs {inherit system;};
    repoRoot = builtins.toString ../..;
    repoRootPath = /. + repoRoot;
    adminPublicKeys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID3iigCfo016qrs9rlsr6uISm/3x6nOa5b66FcwjnnRF simonhackler@gmail.com"
    ];
    studioProdDomain = "digitable.ink";

    studioInstallDomain = let
      envDomain = builtins.getEnv "STUDIO_DOMAIN";
    in
      if envDomain == ""
      then "localhost"
      else envDomain;

    studioPort = 3000;
    appPort = 3001;

    packageDirs = [
      "packages/app"
      "packages/game-server"
      "packages/studio"
    ];

    packageSource = builtins.path {
      path = repoRootPath;
      name = "digitable-source";
      filter = path: type: let
        rel = lib.removePrefix "${repoRoot}/" (toString path);
        parts = lib.splitString "/" rel;
        isPackagePath =
          builtins.any
          (dir: rel == dir || lib.hasPrefix "${dir}/" rel)
          packageDirs;
        isRootFile = builtins.elem rel [
          ""
          "bun.lock"
          "package.json"
          "tsconfig.json"
        ];
      in
        (isRootFile || rel == "packages" || isPackagePath)
        && !(builtins.any (part: builtins.elem part [
            ".git"
            ".svelte-kit"
            "build"
            "node_modules"
          ])
          parts);
    };

    bunDependencies = pkgs.stdenv.mkDerivation {
      pname = "digitable-bun-dependencies";
      version = "0.0.1";
      src = packageSource;

      nativeBuildInputs = [
        pkgs.bun
        pkgs.nodejs
        pkgs.python3
      ];

      dontConfigure = true;
      dontBuild = true;
      dontFixup = true;
      outputHashAlgo = "sha256";
      outputHashMode = "recursive";
      outputHash = "sha256-6NRvn1Prbt/co31/6xA5OOtH1cG6yIMjvQ0JfuUAREI=";

      installPhase = ''
        runHook preInstall

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"

        bun install --frozen-lockfile
        rm -f node_modules/studio node_modules/boardgame-server node_modules/@svg-table/app
        find node_modules -xtype l -delete

        mkdir -p "$out"
        cp -a node_modules "$out/node_modules"

        runHook postInstall
      '';
    };

    studioPackage = pkgs.stdenv.mkDerivation {
      pname = "studio";
      version = "0.0.1";
      src = packageSource;

      nativeBuildInputs = [
        pkgs.bun
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"

        cp -a ${bunDependencies}/node_modules ./node_modules
        chmod -R u+w ./node_modules
        rm -f node_modules/studio node_modules/boardgame-server node_modules/@svg-table/app
        ln -s ../packages/studio node_modules/studio
        ln -s ../packages/game-server node_modules/boardgame-server
        mkdir -p node_modules/@svg-table
        ln -s ../../packages/app node_modules/@svg-table/app
        patchShebangs node_modules

        bun run --filter=@svg-table/app build
        bun run --filter=studio build

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/studio
        mkdir -p $out/packages/app
        mkdir -p $out/packages/game-server

        cp packages/studio/package.json $out/packages/studio/package.json
        cp -r packages/studio/build $out/packages/studio/build
        cp packages/app/package.json $out/packages/app/package.json
        cp -r packages/app/build $out/packages/app/build
        cp packages/game-server/package.json $out/packages/game-server/package.json
        cp -a node_modules $out/node_modules

        runHook postInstall
      '';
    };

    mkStudioSystem = {
      studioDomain,
      enableAppSecrets ? true,
      extraModules ? [],
    }:
      lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit adminPublicKeys appPort enableAppSecrets studioDomain studioPackage studioPort;
        };
        modules =
          [
            ./modules/locale.nix
            ./hosts/studio.nix
            sops-nix.nixosModules.sops
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
      enableAppSecrets = false;
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
