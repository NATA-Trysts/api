'use strict'

const { MoleculerError, MoleculerRetryableError } = require('moleculer').Errors
const Stripe = require('stripe')

module.exports = {
	name: 'payment',

	settings: {
		stripeApiKey: process.env.STRIPE_API_KEY,
	},

	actions: {
		pay: {
			rest: 'POST /',
			params: {
				items: { type: 'object' },
			},
			async handler(ctx) {
				console.log(ctx)

				const amount = ctx.params.items.price
				return this.pay(amount)
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

				return { clientSecret: paymentIntent.client_secret }
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
