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
    gameServerPort = 3002;
    gameServerPublicPort = 2567;

    workspacePackageDirs = [
      "packages/app"
      "packages/auth"
      "packages/db"
      "packages/game-server"
      "packages/svgeditor"
      "packages/studio"
      "svgedit"
      "svgedit/packages/svgcanvas"
      "vendor/svelte-lexical/packages/svelte-lexical"
    ];

    sourceParentDirs = [
      ""
      "packages"
      "svgedit"
      "svgedit/packages"
      "vendor"
      "vendor/svelte-lexical"
      "vendor/svelte-lexical/packages"
    ];

    mkSource = {
      name,
      dirs ? [],
      files ? [],
      parentDirs ? sourceParentDirs,
    }:
      builtins.path {
        path = repoRootPath;
        inherit name;
        filter = path: type: let
          rel = lib.removePrefix "${repoRoot}/" (toString path);
          parts = lib.splitString "/" rel;
          isSourcePath =
            builtins.any
            (dir: rel == dir || lib.hasPrefix "${dir}/" rel)
            dirs;
          isSourceParent = builtins.elem rel parentDirs;
          isSourceFile = builtins.elem rel files;
        in
          (isSourceFile || isSourceParent || isSourcePath)
          && !(builtins.any (part: builtins.elem part [
            ".git"
            ".svelte-kit"
            "build"
            "node_modules"
          ])
          parts);
      };

    dependencySource = mkSource {
      name = "digitable-dependency-source";
      parentDirs =
        sourceParentDirs
        ++ workspacePackageDirs
        ++ [
          "svgedit/packages/react-test"
        ];
      files = [
        "bun.lock"
        "package.json"
        "packages/app/package.json"
        "packages/auth/package.json"
        "packages/db/package.json"
        "packages/game-server/package.json"
        "packages/studio/package.json"
        "packages/svgeditor/package.json"
        "svgedit/bun.lock"
        "svgedit/package.json"
        "svgedit/packages/react-test/package.json"
        "svgedit/packages/svgcanvas/package.json"
        "vendor/svelte-lexical/packages/svelte-lexical/package.json"
      ];
    };

    runtimeWorkspaceSource = mkSource {
      name = "digitable-runtime-workspace-source";
      dirs = [
        "packages/auth"
        "packages/db"
        "packages/svgeditor"
      ];
      files = [
        "package.json"
        "svgedit/package.json"
      ];
    };

    svgcanvasSource = mkSource {
      name = "digitable-svgcanvas-source";
      dirs = [
        "svgedit/packages/svgcanvas"
      ];
      files = [
        "svgedit/package.json"
      ];
    };

    svelteLexicalSource = mkSource {
      name = "digitable-svelte-lexical-source";
      dirs = [
        "vendor/svelte-lexical/packages/svelte-lexical"
      ];
    };

    gameServerSource = mkSource {
      name = "digitable-game-server-source";
      dirs = [
        "packages/db"
        "packages/game-server"
      ];
      files = [
        "package.json"
        "tsconfig.json"
      ];
    };

    appSource = mkSource {
      name = "digitable-app-source";
      dirs = [
        "packages/app"
        "packages/auth"
        "packages/db"
        "packages/game-server"
        "packages/svgeditor"
      ];
      files = [
        "bun.lock"
        "package.json"
        "tsconfig.json"
        "svgedit/package.json"
      ];
    };

    studioWebSource = mkSource {
      name = "digitable-studio-web-source";
      dirs = [
        "packages/auth"
        "packages/db"
        "packages/studio"
      ];
      files = [
        "bun.lock"
        "package.json"
      ];
    };

    dependencySourceFingerprint =
      builtins.substring 0 12
      (builtins.hashString "sha256" (
        builtins.unsafeDiscardStringContext (toString dependencySource)
      ));

    bunDependencies = pkgs.stdenv.mkDerivation {
      pname = "digitable-bun-dependencies";
      version = "0.0.1-${dependencySourceFingerprint}";
      src = dependencySource;

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
      outputHash = "sha256-EMirVHrc5VO0ztbUPa7y/eIu37y6SZGSDYH8AHJSznU=";

      installPhase = ''
        runHook preInstall

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"

        bun install --frozen-lockfile --ignore-scripts
        (cd svgedit && bun install --frozen-lockfile --ignore-scripts)
        rm -f node_modules/studio node_modules/boardgame-server
        rm -f node_modules/@svg-table/app node_modules/@svg-table/auth node_modules/@svg-table/db
        rm -f node_modules/@svg-table/svgeditor
        rm -f node_modules/@svgedit/svgcanvas
        find node_modules -xtype l -delete

        mkdir -p "$out"
        cp -a node_modules "$out/node_modules"
        for packageDir in ${lib.escapeShellArgs workspacePackageDirs}; do
          if [ -d "$packageDir/node_modules" ]; then
            mkdir -p "$out/$packageDir"
            cp -a "$packageDir/node_modules" "$out/$packageDir/node_modules"
          fi
        done

        runHook postInstall
      '';
    };

    runtimeBunDependencies = pkgs.stdenv.mkDerivation {
      pname = "digitable-runtime-bun-dependencies";
      version = "0.0.1-${dependencySourceFingerprint}";
      src = dependencySource;

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
      outputHash = "sha256-u+ijHa3Y0bLZOxgV1rlnWtldt/LnODkdPzAWA6Pe9SM=";

      installPhase = ''
        runHook preInstall

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"

        node <<'EOF'
        const fs = require("node:fs");
        const manifests = [
          "package.json",
          "packages/app/package.json",
          "packages/auth/package.json",
          "packages/db/package.json",
          "packages/game-server/package.json",
          "packages/studio/package.json",
          "packages/svgeditor/package.json",
          "svgedit/packages/svgcanvas/package.json",
          "vendor/svelte-lexical/packages/svelte-lexical/package.json",
        ];

        for (const manifest of manifests) {
          const packageJson = JSON.parse(fs.readFileSync(manifest, "utf8"));
          delete packageJson.devDependencies;
          fs.writeFileSync(manifest, JSON.stringify(packageJson, null, 2) + "\n");
        }
        EOF

        bun install --ignore-scripts --cpu=x64 --os=linux --no-save
        rm -f node_modules/studio node_modules/boardgame-server
        rm -f node_modules/@svg-table/app node_modules/@svg-table/auth node_modules/@svg-table/db
        rm -f node_modules/@svg-table/svgeditor
        rm -f node_modules/@svgedit/svgcanvas
        find node_modules -xtype l -delete

        mkdir -p "$out"
        cp -a node_modules "$out/node_modules"
        for packageDir in ${lib.escapeShellArgs workspacePackageDirs}; do
          if [ -d "$packageDir/node_modules" ]; then
            mkdir -p "$out/$packageDir"
            cp -a "$packageDir/node_modules" "$out/$packageDir/node_modules"
          fi
        done

        runHook postInstall
      '';
    };

    setupNodeModules = {
      packageNodeModuleDirs ? [],
      linkRootWorkspaces ? true,
    }: ''
      cp -a ${bunDependencies}/node_modules ./node_modules
      chmod -R u+w ./node_modules
      for packageDir in ${lib.escapeShellArgs packageNodeModuleDirs}; do
        if [ -d "${bunDependencies}/$packageDir/node_modules" ]; then
          mkdir -p "$packageDir"
          cp -a "${bunDependencies}/$packageDir/node_modules" "$packageDir/node_modules"
          chmod -R u+w "$packageDir/node_modules"
        fi
      done
      ${lib.optionalString linkRootWorkspaces ''
        rm -f node_modules/studio node_modules/boardgame-server
        rm -f node_modules/@svg-table/app node_modules/@svg-table/auth node_modules/@svg-table/db
        rm -f node_modules/@svg-table/svgeditor
        rm -f node_modules/@svgedit/svgcanvas
        ln -s ../packages/studio node_modules/studio
        ln -s ../packages/game-server node_modules/boardgame-server
        mkdir -p node_modules/@svg-table
        ln -s ../../packages/app node_modules/@svg-table/app
        ln -s ../../packages/auth node_modules/@svg-table/auth
        ln -s ../../packages/db node_modules/@svg-table/db
        ln -s ../../packages/svgeditor node_modules/@svg-table/svgeditor
        mkdir -p node_modules/@svgedit
        ln -s ../../svgedit/packages/svgcanvas node_modules/@svgedit/svgcanvas
      ''}
      patchShebangs node_modules
      for packageDir in ${lib.escapeShellArgs packageNodeModuleDirs}; do
        if [ -d "$packageDir/node_modules" ]; then
          patchShebangs "$packageDir/node_modules"
        fi
      done
    '';

    svgcanvasPackage = pkgs.stdenv.mkDerivation {
      pname = "digitable-svgcanvas";
      version = "0.0.1";
      src = svgcanvasSource;

      nativeBuildInputs = [
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        export CI=1

        ${setupNodeModules {
        packageNodeModuleDirs = [
          "svgedit"
          "svgedit/packages/svgcanvas"
        ];
        linkRootWorkspaces = false;
      }}

        (cd svgedit/packages/svgcanvas && ../../node_modules/.bin/vite build)

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/svgedit/packages/svgcanvas
        cp svgedit/packages/svgcanvas/package.json $out/svgedit/packages/svgcanvas/package.json
        cp svgedit/packages/svgcanvas/svgcanvas.d.ts $out/svgedit/packages/svgcanvas/svgcanvas.d.ts
        cp -r svgedit/packages/svgcanvas/dist $out/svgedit/packages/svgcanvas/dist

        runHook postInstall
      '';
    };

    svelteLexicalPackage = pkgs.stdenv.mkDerivation {
      pname = "digitable-svelte-lexical";
      version = "0.0.1";
      src = svelteLexicalSource;

      nativeBuildInputs = [
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        export CI=1

        ${setupNodeModules {
        packageNodeModuleDirs = [
          "vendor/svelte-lexical/packages/svelte-lexical"
        ];
        linkRootWorkspaces = false;
      }}

        packageDir=vendor/svelte-lexical/packages/svelte-lexical
        test -d "$packageDir/src/lib"
        (cd "$packageDir" && node ./node_modules/.bin/svelte-kit sync)
        (cd "$packageDir" && node ./node_modules/.bin/svelte-package --input src/lib --output dist --tsconfig tsconfig.json)

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/vendor/svelte-lexical/packages/svelte-lexical
        cp vendor/svelte-lexical/packages/svelte-lexical/package.json $out/vendor/svelte-lexical/packages/svelte-lexical/package.json
        cp -r vendor/svelte-lexical/packages/svelte-lexical/dist $out/vendor/svelte-lexical/packages/svelte-lexical/dist

        runHook postInstall
      '';
    };

    gameServerPackage = pkgs.stdenv.mkDerivation {
      pname = "digitable-game-server";
      version = "0.0.1";
      src = gameServerSource;

      nativeBuildInputs = [
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        export CI=1

        ${setupNodeModules {
        packageNodeModuleDirs = [
          "packages/db"
          "packages/game-server"
        ];
      }}

        (cd packages/game-server && ./node_modules/.bin/rimraf build && ./node_modules/.bin/tsc)

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/game-server
        cp packages/game-server/package.json $out/packages/game-server/package.json
        cp packages/game-server/tsconfig.json $out/packages/game-server/tsconfig.json
        cp -r packages/game-server/src $out/packages/game-server/src
        cp -r packages/game-server/build $out/packages/game-server/build

        runHook postInstall
      '';
    };

    appPackage = pkgs.stdenv.mkDerivation {
      pname = "digitable-app";
      version = "0.0.1";
      src = appSource;

      nativeBuildInputs = [
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        export CI=1
        export BETTER_AUTH_URL="http://localhost"
        export BETTER_AUTH_SECRET="nix-build-only"

        mkdir -p svgedit/packages
        rm -rf svgedit/packages/svgcanvas
        cp -r ${svgcanvasPackage}/svgedit/packages/svgcanvas svgedit/packages/svgcanvas
        mkdir -p vendor/svelte-lexical/packages
        rm -rf vendor/svelte-lexical/packages/svelte-lexical
        cp -r ${svelteLexicalPackage}/vendor/svelte-lexical/packages/svelte-lexical vendor/svelte-lexical/packages/svelte-lexical
        chmod -R u+w vendor/svelte-lexical/packages/svelte-lexical

        ${setupNodeModules {
        packageNodeModuleDirs = [
          "packages/app"
          "packages/auth"
          "packages/db"
          "packages/game-server"
          "packages/svgeditor"
          "vendor/svelte-lexical/packages/svelte-lexical"
        ];
      }}

        (cd packages/game-server && ./node_modules/.bin/rimraf build && ./node_modules/.bin/tsc)
        (cd packages/app && ./node_modules/.bin/vite build)

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/app
        cp packages/app/package.json $out/packages/app/package.json
        cp -r packages/app/build $out/packages/app/build

        runHook postInstall
      '';
    };

    studioWebPackage = pkgs.stdenv.mkDerivation {
      pname = "digitable-studio-web";
      version = "0.0.1";
      src = studioWebSource;

      nativeBuildInputs = [
        pkgs.nodejs
      ];

      dontConfigure = true;

      buildPhase = ''
        runHook preBuild

        export HOME="$TMPDIR"
        export XDG_CACHE_HOME="$TMPDIR/.cache"
        export CI=1
        export BETTER_AUTH_URL="http://localhost"
        export BETTER_AUTH_SECRET="nix-build-only"

        ${setupNodeModules {
        packageNodeModuleDirs = [
          "packages/auth"
          "packages/db"
          "packages/studio"
        ];
      }}

        (cd packages/studio && ./node_modules/.bin/vite build)

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/studio
        mkdir -p $out/packages/app
        mkdir -p $out/packages/game-server
        mkdir -p $out/vendor/svelte-lexical/packages

        cp packages/studio/package.json $out/packages/studio/package.json
        cp -r packages/studio/build $out/packages/studio/build

        runHook postInstall
      '';
    };

    studioPackage = pkgs.stdenv.mkDerivation {
      pname = "studio";
      version = "0.0.1";
      src = runtimeWorkspaceSource;

      nativeBuildInputs = [
        pkgs.bun
        pkgs.nodejs
      ];

      dontConfigure = true;
      dontBuild = true;
      dontFixup = true;

      installPhase = ''
        runHook preInstall

        mkdir -p $out/packages/studio
        mkdir -p $out/packages/app
        mkdir -p $out/packages/game-server

        cp ${studioWebPackage}/packages/studio/package.json $out/packages/studio/package.json
        cp -r ${studioWebPackage}/packages/studio/build $out/packages/studio/build
        cp ${appPackage}/packages/app/package.json $out/packages/app/package.json
        cp -r ${appPackage}/packages/app/build $out/packages/app/build
        cp -r packages/auth $out/packages/auth
        cp -r packages/db $out/packages/db
        cp ${gameServerPackage}/packages/game-server/package.json $out/packages/game-server/package.json
        cp ${gameServerPackage}/packages/game-server/tsconfig.json $out/packages/game-server/tsconfig.json
        cp -r ${gameServerPackage}/packages/game-server/src $out/packages/game-server/src
        cp -r ${gameServerPackage}/packages/game-server/build $out/packages/game-server/build
        cp -r packages/svgeditor $out/packages/svgeditor
        mkdir -p $out/vendor/svelte-lexical/packages/svelte-lexical
        cp ${svelteLexicalPackage}/vendor/svelte-lexical/packages/svelte-lexical/package.json $out/vendor/svelte-lexical/packages/svelte-lexical/package.json
        cp -r ${svelteLexicalPackage}/vendor/svelte-lexical/packages/svelte-lexical/dist $out/vendor/svelte-lexical/packages/svelte-lexical/dist
        mkdir -p $out/svgedit/packages
        cp svgedit/package.json $out/svgedit/package.json
        cp -r ${svgcanvasPackage}/svgedit/packages/svgcanvas $out/svgedit/packages/svgcanvas
        chmod -R u+w $out/svgedit/packages/svgcanvas

        cp -as ${runtimeBunDependencies}/node_modules $out/node_modules
        find $out/node_modules -type d -exec chmod u+w {} +
        rm -f $out/node_modules/studio $out/node_modules/boardgame-server
        rm -f $out/node_modules/@svg-table/app $out/node_modules/@svg-table/auth $out/node_modules/@svg-table/db
        rm -f $out/node_modules/@svg-table/svgeditor
        rm -f $out/node_modules/@svgedit/svgcanvas
        ln -s ../packages/studio $out/node_modules/studio
        ln -s ../packages/game-server $out/node_modules/boardgame-server
        mkdir -p $out/node_modules/@svg-table
        ln -s ../../packages/app $out/node_modules/@svg-table/app
        ln -s ../../packages/auth $out/node_modules/@svg-table/auth
        ln -s ../../packages/db $out/node_modules/@svg-table/db
        ln -s ../../packages/svgeditor $out/node_modules/@svg-table/svgeditor
        mkdir -p $out/node_modules/@svgedit
        ln -s ../../svgedit/packages/svgcanvas $out/node_modules/@svgedit/svgcanvas

        for packageDir in ${lib.escapeShellArgs workspacePackageDirs}; do
          if [ -d "${runtimeBunDependencies}/$packageDir/node_modules" ]; then
            mkdir -p "$out/$packageDir"
            cp -as "${runtimeBunDependencies}/$packageDir/node_modules" "$out/$packageDir/node_modules"
            find "$out/$packageDir/node_modules" -type d -exec chmod u+w {} +
          fi
        done
        rm -f $out/svgedit/node_modules/@svgedit/react-test

        brokenSymlink="$(find "$out" -xtype l -print -quit)"
        if [ -n "$brokenSymlink" ]; then
          echo "ERROR: broken symlink in studio package: $brokenSymlink"
          exit 1
        fi
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
          inherit
            adminPublicKeys
            appPort
            enableAppSecrets
            gameServerPort
            gameServerPublicPort
            studioDomain
            studioPackage
            studioPort
            ;
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
