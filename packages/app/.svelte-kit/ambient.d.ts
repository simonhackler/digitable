
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * Environment variables [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env`. Like [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), this module cannot be imported into client-side code. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * _Unlike_ [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), the values exported from this module are statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * ```ts
 * import { API_KEY } from '$env/static/private';
 * ```
 * 
 * Note that all environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * 
 * ```
 * MY_FEATURE_FLAG=""
 * ```
 * 
 * You can override `.env` values from the command line like so:
 * 
 * ```sh
 * MY_FEATURE_FLAG="enabled" npm run dev
 * ```
 */
declare module '$env/static/private' {
	export const SHELL: string;
	export const npm_command: string;
	export const WINDOWID: string;
	export const COLORTERM: string;
	export const NVM_INC: string;
	export const TERM_PROGRAM_VERSION: string;
	export const TMUX: string;
	export const NODE: string;
	export const DOTNET_ROOT: string;
	export const SSH_AUTH_SOCK: string;
	export const DOTNET_CLI_TELEMETRY_OPTOUT: string;
	export const AWS_PROFILE: string;
	export const npm_config_local_prefix: string;
	export const SSH_AGENT_PID: string;
	export const XDG_SEAT: string;
	export const PWD: string;
	export const LOGNAME: string;
	export const XDG_SESSION_TYPE: string;
	export const _: string;
	export const XAUTHORITY: string;
	export const TERMINAL: string;
	export const WINDOWPATH: string;
	export const MOTD_SHOWN: string;
	export const VIRTUALENVWRAPPER_SCRIPT: string;
	export const HOME: string;
	export const LANG: string;
	export const npm_package_version: string;
	export const VIRTUALENVWRAPPER_WORKON_CD: string;
	export const FORCE_COLOR: string;
	export const DOTNET_BUNDLE_EXTRACT_BASE_DIR: string;
	export const npm_lifecycle_script: string;
	export const NVM_DIR: string;
	export const WORKON_HOME: string;
	export const XDG_SESSION_CLASS: string;
	export const TERM: string;
	export const npm_package_name: string;
	export const USER: string;
	export const TMUX_PANE: string;
	export const COLORFGBG: string;
	export const VIRTUALENVWRAPPER_PROJECT_FILENAME: string;
	export const DISPLAY: string;
	export const npm_lifecycle_event: string;
	export const SHLVL: string;
	export const NVM_CD_FLAGS: string;
	export const XDG_VTNR: string;
	export const XDG_SESSION_ID: string;
	export const npm_config_user_agent: string;
	export const npm_execpath: string;
	export const XDG_RUNTIME_DIR: string;
	export const DEBUGINFOD_URLS: string;
	export const npm_package_json: string;
	export const BUN_INSTALL: string;
	export const QT_AUTO_SCREEN_SCALE_FACTOR: string;
	export const PATH: string;
	export const VIRTUALENVWRAPPER_HOOK_DIR: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const MAIL: string;
	export const NVM_BIN: string;
	export const npm_node_execpath: string;
	export const LOCKSCREEN: string;
	export const OLDPWD: string;
	export const TERM_PROGRAM: string;
	export const NODE_ENV: string;
}

/**
 * Similar to [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private), except that it only includes environment variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Values are replaced statically at build time.
 * 
 * ```ts
 * import { PUBLIC_BASE_URL } from '$env/static/public';
 * ```
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to runtime environment variables, as defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`. This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured).
 * 
 * This module cannot be imported into client-side code.
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * console.log(env.DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` always includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 */
declare module '$env/dynamic/private' {
	export const env: {
		SHELL: string;
		npm_command: string;
		WINDOWID: string;
		COLORTERM: string;
		NVM_INC: string;
		TERM_PROGRAM_VERSION: string;
		TMUX: string;
		NODE: string;
		DOTNET_ROOT: string;
		SSH_AUTH_SOCK: string;
		DOTNET_CLI_TELEMETRY_OPTOUT: string;
		AWS_PROFILE: string;
		npm_config_local_prefix: string;
		SSH_AGENT_PID: string;
		XDG_SEAT: string;
		PWD: string;
		LOGNAME: string;
		XDG_SESSION_TYPE: string;
		_: string;
		XAUTHORITY: string;
		TERMINAL: string;
		WINDOWPATH: string;
		MOTD_SHOWN: string;
		VIRTUALENVWRAPPER_SCRIPT: string;
		HOME: string;
		LANG: string;
		npm_package_version: string;
		VIRTUALENVWRAPPER_WORKON_CD: string;
		FORCE_COLOR: string;
		DOTNET_BUNDLE_EXTRACT_BASE_DIR: string;
		npm_lifecycle_script: string;
		NVM_DIR: string;
		WORKON_HOME: string;
		XDG_SESSION_CLASS: string;
		TERM: string;
		npm_package_name: string;
		USER: string;
		TMUX_PANE: string;
		COLORFGBG: string;
		VIRTUALENVWRAPPER_PROJECT_FILENAME: string;
		DISPLAY: string;
		npm_lifecycle_event: string;
		SHLVL: string;
		NVM_CD_FLAGS: string;
		XDG_VTNR: string;
		XDG_SESSION_ID: string;
		npm_config_user_agent: string;
		npm_execpath: string;
		XDG_RUNTIME_DIR: string;
		DEBUGINFOD_URLS: string;
		npm_package_json: string;
		BUN_INSTALL: string;
		QT_AUTO_SCREEN_SCALE_FACTOR: string;
		PATH: string;
		VIRTUALENVWRAPPER_HOOK_DIR: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		MAIL: string;
		NVM_BIN: string;
		npm_node_execpath: string;
		LOCKSCREEN: string;
		OLDPWD: string;
		TERM_PROGRAM: string;
		NODE_ENV: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * Similar to [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private), but only includes variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`), and can therefore safely be exposed to client-side code.
 * 
 * Note that public dynamic environment variables must all be sent from the server to the client, causing larger network requests — when possible, use `$env/static/public` instead.
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.PUBLIC_DEPLOYMENT_SPECIFIC_VARIABLE);
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
