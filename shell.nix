{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  packages = with pkgs; [
    bun
    playwright-driver.browsers
  ];

  shellHook = ''
    export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
    export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true

    chromium_dir="$(echo ${pkgs.playwright-driver.browsers}/chromium-*)"

    if [ -x "$chromium_dir/chrome-linux/chrome" ]; then
      export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$chromium_dir/chrome-linux/chrome"
    elif [ -x "$chromium_dir/chrome-linux64/chrome" ]; then
      export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="$chromium_dir/chrome-linux64/chrome"
    fi
  '';
}

