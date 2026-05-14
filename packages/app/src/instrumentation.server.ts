import { register } from 'node:module';
import { createAddHookMessageChannel } from 'import-in-the-middle';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

const token = process.env.TRACEWAY_PROJECT_TOKEN;
const url = (process.env.TRACEWAY_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');

if (!token) {
	console.warn('[otel] TRACEWAY_PROJECT_TOKEN is missing; server telemetry will not be exported');
}

if (token) {
	if (!process.versions.bun) {
		const { registerOptions } = createAddHookMessageChannel();
		register('import-in-the-middle/hook.mjs', import.meta.url, registerOptions);
	}

	const headers = {
		Authorization: `Bearer ${token}`
	};
	const version =
		process.env.OTEL_SERVICE_VERSION ??
		process.env.PUBLIC_APP_VERSION ??
		process.env.npm_package_version ??
		'dev';

	const sdk = new NodeSDK({
		instrumentations: [
			getNodeAutoInstrumentations({
				'@opentelemetry/instrumentation-fs': {
					enabled: false
				}
			})
		],
		logRecordProcessors: [
			new BatchLogRecordProcessor(
				new OTLPLogExporter({
					headers,
					url: `${url}/api/otel/v1/logs`
				})
			)
		],
		metricReaders: [
			new PeriodicExportingMetricReader({
				exporter: new OTLPMetricExporter({
					headers,
					url: `${url}/api/otel/v1/metrics`
				}),
				exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? '30000')
			})
		],
		resource: resourceFromAttributes({
			'deployment.environment': process.env.NODE_ENV ?? 'development',
			'service.name': process.env.OTEL_SERVICE_NAME ?? 'digitable-app',
			'service.version': version
		}),
		traceExporter: new OTLPTraceExporter({
			headers,
			url: `${url}/api/otel/v1/traces`
		})
	});

	sdk.start();

	process.on('SIGTERM', () => {
		sdk.shutdown().finally(() => process.exit(0));
	});
}
