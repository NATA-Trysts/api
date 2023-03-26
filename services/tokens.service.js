'use strict'

const DbService = require('../mixins/db.mixin')
const CacheCleanerMixin = require('../mixins/cache.cleaner.mixin')

module.exports = {
	name: 'tokens',

	mixins: [DbService('tokens'), CacheCleanerMixin(['cache.clean.tokens'])],

	settings: {
		rest: '/',

		fields: ['_id', 'token', 'expiresAt'],

		entityValidator: {
			token: { type: 'string', min: 2 },
			expiresAt: { type: 'number' },
		},
	},

	actions: {
		add: {
			rest: 'POST /tokens',
			params: {
				token: { type: 'string' },
				expiresAt: { type: 'number' },
			},
			async handler(ctx) {
				const entity = ctx.params
				await this.validateEntity(entity)

				const doc = await this.adapter.insert(entity)
				const token = await this.transformDocuments(ctx, {}, doc)
				await this.entityChanged('created', token, ctx)
				return token
			},
		},

		remove: {
			params: {
				token: { type: 'string' },
			},
			async handler(ctx) {
				const entity = ctx.params
				await this.validateEntity(entity)

				const doc = this.adapter.remove(entity)
				const token = await this.transformDocuments(ctx, {}, doc)
				await this.entityChanged('removed', token, ctx)
				return token
			},
		},

		find: {
			params: {
				token: { type: 'string' },
			},
			async handler(ctx) {
				const { token } = ctx.params

				const tokenFound = await this.adapter.findOne({ token })
				return tokenFound ? true : false
			},
		},
	},

	methods: {},
}
