// Runs with "-r" option of the "node" command

const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
	getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
	OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");

const otel_auth_token = Buffer.from(
	`${process.env.GRAFANA_OTEL_USER}:${process.env.GRAFANA_OTEL_TOKEN}`,
).toString("base64");
const exporter = new OTLPTraceExporter({
	url: process.env.GRAFANA_OTEL_ENDPOINT,
	headers: {
		authorization: `Basic ${otel_auth_token}`,
	},
});

const sdk = new NodeSDK({
	traceExporter: exporter,
	instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
