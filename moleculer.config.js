"use strict"

module.exports = {
	namespace: "trysts",
	//transporter: "TCP",
	logger: {
		type: "Console",
		options: {
			// Using colors on the output
			colors: true,
			// Print module names with different colors (like docker-compose for containers)
			moduleColors: false,
			// Line formatter. It can be "json", "short", "simple", "full", a `Function` or a template string like "{timestamp} {level} {nodeID}/{mod}: {msg}"
			formatter: "full",
			// Custom object printer. If not defined, it uses the `util.inspect` method.
			objectPrinter: null,
			// Auto-padding the module name in order to messages begin at the same column.
			autoPadding: false,
		},
	},
	cacher: {
		type: "memory",
		options: {
			maxParamsLength: 100,
		},
	},
	metrics: false,

	tracing: {
		enabled: true,
		exporter: [
			{
				type: "Console",
				options: {
					width: 100,
					colors: true,
				},
			},
		],
	},

	validator: true,
}
