import { json } from '@sveltejs/kit';

import { logInfo } from '$lib/server/otel-log';

export function GET() {
	logInfo('traceway test endpoint hit', {
		feature: 'traceway-test'
	});

	return json({
		message: 'Traceway server telemetry test',
		ok: true
	});
}
