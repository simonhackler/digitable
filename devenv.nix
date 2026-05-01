{
  pkgs,
  config,
  lib,
  ...
}: let
  dbName = "svg_table";
  dbUser = "svg_table";
  dbPass = "svg_table";
  dbPort = 54329;
  sitePort = config.processes.proxy.ports.http.value;
  appPort = config.processes.app.ports.http.value;
  studioPort = config.processes.studio.ports.http.value;
  serverPort = config.processes.game-server.ports.http.value;
  postgresPort = config.processes.postgres.ports.main.value;
  databaseUrl = "postgres://${dbUser}:${dbPass}@127.0.0.1:${toString postgresPort}/${dbName}";
  studioOrigin = "http://localhost:${toString sitePort}";
  playwrightChromium = pkgs.runCommand "playwright-chromium-executable" {} ''
    chromium_dir="$(echo ${pkgs.playwright-driver.browsers}/chromium-*)"

    if [ -x "$chromium_dir/chrome-linux/chrome" ]; then
      ln -s "$chromium_dir/chrome-linux/chrome" "$out"
    elif [ -x "$chromium_dir/chrome-linux64/chrome" ]; then
      ln -s "$chromium_dir/chrome-linux64/chrome" "$out"
    else
      echo "Could not find Playwright Chromium executable in $chromium_dir" >&2
      exit 1
    fi
  '';
  caddyfile = pkgs.writeText "digitable-devenv.Caddyfile" ''
    {
      admin off
    }

    http://127.0.0.1:${toString sitePort}, http://localhost:${toString sitePort} {
      encode zstd gzip

      handle /app* {
        reverse_proxy 127.0.0.1:${toString appPort}
      }

      handle {
        reverse_proxy 127.0.0.1:${toString studioPort}
      }
    }
  '';
in {
  dotenv.disableHint = true;

  packages = with pkgs; [
    bun
    caddy
    postgresql_16
    playwright-driver.browsers
  ];

  env = {
    PORT = toString sitePort;
    DATABASE_URL = databaseUrl;
    POSTGRES_DB = dbName;
    POSTGRES_USER = dbUser;
    POSTGRES_PASSWORD = dbPass;
    POSTGRES_PORT = toString postgresPort;

    BETTER_AUTH_URL = studioOrigin;
    BETTER_AUTH_SECRET = "devenv-local-auth-secret-change-before-production";
    WEB_ORIGIN = studioOrigin;
    SECOND_WEB_ORIGIN = "";
    AUTH_COOKIE_DOMAIN = "";
    REPLICATE_API_TOKEN = "tmp";

    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
    PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH = "${playwrightChromium}";
  };

  services.postgres = {
    enable = true;
    package = pkgs.postgresql_16;
    listen_addresses = "127.0.0.1";
    port = dbPort;

    initialDatabases = [
      {
        name = dbName;
        user = dbUser;
        pass = dbPass;
      }
    ];
  };

  processes.postgres.ready = lib.mkForce null;

  tasks."db:migrate" = {
    exec = ''
      until ${pkgs.postgresql_16}/bin/pg_isready \
        --host=127.0.0.1 \
        --port=${toString postgresPort} \
        --dbname=${dbName} \
        --username=${dbUser} >/dev/null 2>&1; do
        sleep 1
      done

      bun run --filter=@svg-table/db db:migrate
    '';
    showOutput = true;
    after = ["devenv:processes:postgres@started"];
    before = [
      "devenv:processes:studio"
      "devenv:processes:app"
      "devenv:processes:game-server"
      "devenv:processes:proxy"
    ];
  };

  processes = {
    studio = {
      ports.http.allocate = 5174;
      exec = "bun run --filter=studio dev -- --host 127.0.0.1 --port ${toString studioPort} --strictPort";
      env.ORIGIN = studioOrigin;
    };

    app = {
      ports.http.allocate = 5173;
      exec = "bun run --filter=@svg-table/app dev -- --host 127.0.0.1 --port ${toString appPort} --strictPort";
      env.PORT = toString appPort;
      env.ORIGIN = studioOrigin;
    };

    game-server = {
      ports.http.allocate = 2567;
      exec = "bun run --filter=boardgame-server start";
      env.PORT = toString serverPort;
    };

    proxy = {
      ports.http.allocate = 5180;
      exec = ''
        mkdir -p .devenv
        {
          printf 'PORT=%s\n' '${toString sitePort}'
          printf 'PLAYWRIGHT_BASE_URL=%s\n' 'http://localhost:${toString sitePort}'
        } > .devenv/playwright.env
        trap 'rm -f .devenv/playwright.env' EXIT
        exec ${pkgs.caddy}/bin/caddy run --config ${caddyfile} --adapter caddyfile
      '';
      after = [
        "devenv:processes:studio@started"
        "devenv:processes:app@started"
      ];
    };
  };
}
