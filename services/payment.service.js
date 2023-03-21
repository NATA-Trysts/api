'use strict'

const { MoleculerError, MoleculerRetryableError } = require('moleculer').Errors
const Stripe = require('stripe')

module.exports = {
	name: 'payment',

	settings: {
		stripeApiKey:
			'sk_test_51KIKjWCmxo26gX2lpx66gzlURDAdcg3yEK4z2DMhs8JQRg4WQMvbjUaxx5TK5BoQR2OdS7D7qn9SpJifjjIoP7go00B4xSWi3L',
	},

	actions: {
		pay: {
			rest: 'POST /',
			params: {
				amount: 'number',
			},
			async handler(ctx) {
				return this.pay(ctx.params.amount)
			},
		},
	},

	methods: {
		async pay(amount) {
			if (!this.stripe)
				return new MoleculerError('Unable to init Stripe! ' + this.stripe)

			try {
				const paymentIntent = await this.stripe.paymentIntents.create({
					amount,
					currency: 'sgd',
					automatic_payment_methods: {
						enabled: true,
					},
				})

				return paymentIntent
			} catch (error) {
				return new MoleculerRetryableError(
					'Unable to create payment intent! ' + error.message
				)
			}
		},
	},

	created() {
		this.stripe = new Stripe(this.settings.stripeApiKey, {
			apiVersion: '2022-11-15',
		})
	},
}

