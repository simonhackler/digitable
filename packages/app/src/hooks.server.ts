import { building } from '$app/environment';
import { base, resolve as resolvePath } from '$app/paths';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getMissingCurrentPolicies } from '@svg-table/db/policies';

import { auth } from '$lib/server/auth';
import { logError, logInfo, toError } from '$lib/server/otel-log';

const publicPathPrefixes = [
	`${base}/api/auth`,
	resolvePath('/legal/accept'),
	resolvePath('/sign-in'),
	resolvePath('/sign-up')
];

function isPublicPath(pathname: string) {
	return publicPathPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function routeName(event: Parameters<Handle>[0]['event']) {
	return event.route.id ?? event.url.pathname;
}

function addTracewayHeader(response: Response, traceId: string | null) {
	if (!traceId) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set('traceway-trace-id', traceId);

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	const route = routeName(event);
	const method = event.request.method;
	const frontendTraceId = event.request.headers.get('traceway-trace-id');
	const span = trace.getActiveSpan();

	const session = process.env.DATABASE_URL
		? await auth.api.getSession({
				headers: event.request.headers
			})
		: null;

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	if (event.locals.user && !isPublicPath(event.url.pathname)) {
		const missingPolicies = await getMissingCurrentPolicies(event.locals.user.id);

		if (missingPolicies.length > 0) {
			redirect(303, resolvePath('/legal/accept'));
		}
	}

	if (span) {
		span.setAttribute('http.route', route);
		span.setAttribute('sveltekit.route.id', route);
		span.setAttribute('url.path', event.url.pathname);

		if (frontendTraceId) {
			span.setAttribute('traceway.distributed_trace_id', frontendTraceId);
		}

		if (event.locals.user?.id) {
			span.setAttribute('user.id', event.locals.user.id);
		}
	}

	if (event.tracing.enabled) {
		event.tracing.root.setAttribute('http.route', route);
		event.tracing.root.setAttribute('sveltekit.route.id', route);
		event.tracing.root.setAttribute('url.path', event.url.pathname);

		if (frontendTraceId) {
			event.tracing.root.setAttribute('traceway.distributed_trace_id', frontendTraceId);
		}
	}

	const response = await svelteKitHandler({
		event,
		resolve,
		auth,
		building
	});

	logInfo('http request completed', {
		method,
		path: event.url.pathname,
		route,
		status: response.status
	});

	return addTracewayHeader(response, frontendTraceId);
};

export const handleError: HandleServerError = ({ error, event, message, status }) => {
	const route = routeName(event);
	const span = trace.getActiveSpan();
	const err = toError(error);

	if (span) {
		span.setAttribute('http.route', route);
		span.setAttribute('sveltekit.route.id', route);
		span.setAttribute('http.response.status_code', status);
		span.recordException(err);
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message
		});
	}

	logError('sveltekit server error', err, {
		message,
		path: event.url.pathname,
		route,
		status
	});

	return { message };
};
