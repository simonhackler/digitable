import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { SpanStatusCode, trace } from '@opentelemetry/api';

const logger = logs.getLogger('sveltekit');

type Attrs = Record<string, boolean | number | string | null | undefined>;

function cleanAttributes(attrs: Attrs = {}) {
	return Object.fromEntries(
		Object.entries(attrs)
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => [key, String(value)])
	);
}

export function toError(error: unknown) {
	if (error instanceof Error) {
		return error;
	}

	if (typeof error === 'string') {
		return new Error(error);
	}

	return new Error(JSON.stringify(error));
}

export function logInfo(body: string, attributes: Attrs = {}) {
	logger.emit({
		attributes: cleanAttributes(attributes),
		body,
		severityNumber: SeverityNumber.INFO,
		severityText: 'INFO'
	});
}

export function logWarn(body: string, attributes: Attrs = {}) {
	logger.emit({
		attributes: cleanAttributes(attributes),
		body,
		severityNumber: SeverityNumber.WARN,
		severityText: 'WARN'
	});
}

export function logError(body: string, error: unknown, attributes: Attrs = {}) {
	const err = toError(error);
	const span = trace.getActiveSpan();

	if (span) {
		span.recordException(err);
		span.setStatus({
			code: SpanStatusCode.ERROR,
			message: err.message
		});
	}

	logger.emit({
		attributes: cleanAttributes({
			...attributes,
			'exception.message': err.message,
			'exception.stacktrace': err.stack,
			'exception.type': err.name
		}),
		body,
		severityNumber: SeverityNumber.ERROR,
		severityText: 'ERROR'
	});
}
