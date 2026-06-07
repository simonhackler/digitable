import { captureExceptionWithAttributes } from '@tracewayapp/frontend';
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event, message, status }) => {
	captureExceptionWithAttributes(error instanceof Error ? error : new Error(message), {
		message,
		path: event.url.pathname,
		route: event.route.id ?? '',
		status: String(status)
	});

	return { message };
};
