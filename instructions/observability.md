## Logging With Traceway

Use the existing Traceway/OpenTelemetry integration instead of adding direct SDK setup in feature code.

### Server

Use `logInfo`, `logWarn`, and `logError` from `$lib/server/otel-log` in server-only code:

```ts
import { logError, logInfo } from '$lib/server/otel-log';

logInfo('deck export started', {
	gameName,
	deckName
});

try {
	// server work
} catch (error) {
	logError('deck export failed', error, {
		gameName,
		deckName
	});

	throw error;
}
```

`logError` records the exception on the active OpenTelemetry span and emits an OTEL log, so logs can show up with related Traceway traces.

For request-level metadata, prefer adding attributes to the active span:

```ts
import { trace } from '@opentelemetry/api';

trace.getActiveSpan()?.setAttribute('game.name', gameName);
```

Do not import browser Traceway packages from server files. Server telemetry is configured once in `packages/app/src/instrumentation.server.ts`.

### Client

Use `@tracewayapp/frontend` for explicit client-side events:

```ts
import { captureException, captureMessage } from '@tracewayapp/frontend';

captureMessage('deck editor opened');
captureException(new Error('client-side export preview failed'));
```

For extra context on client errors, use attributes:

```ts
import { captureExceptionWithAttributes } from '@tracewayapp/frontend';

captureExceptionWithAttributes(error, {
	gameName,
	route: '/games/[gameName]'
});
```

The root layout already initializes the browser SDK and syncs known user attributes. Do not call `setupTraceway` outside `packages/app/src/routes/+layout.svelte`.

### Local Testing

Traceway runs at:

```text
http://127.0.0.1:18081
```

The app runs at:

```text
http://127.0.0.1:5180/app
```

Use these routes to generate test telemetry:

```text
http://127.0.0.1:5180/app/traceway-test
http://127.0.0.1:5180/app/api/traceway-test
http://127.0.0.1:5180/app/api/traceway-error
```

If logs or metrics do not appear, confirm the app process was started with `TRACEWAY_PROJECT_TOKEN`, `TRACEWAY_URL`, `PUBLIC_TRACEWAY_CONNECTION`, and `PUBLIC_APP_VERSION`.
