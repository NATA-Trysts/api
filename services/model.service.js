const { randomInt } = require('crypto')
const { faker } = require('@faker-js/faker')
const DbService = require('../mixins/db.mixin')

module.exports = {
	name: 'models',
	mixins: [DbService('models')],
	settings: {
		rest: '/',
		fields: [
			'_id',
			'name',
			'category',
			'collection',
			'description',
			'thumbnail',
			'materials',
		],

		populates: {
			collection: 'collections.get',
		},
	},

	actions: {
		list: {
			rest: 'GET /models',
			async handler(ctx) {
				const doc = await this.adapter.find()
				const models = await this.transformDocuments(
					ctx,
					{ populate: ctx.params.populate },
					doc
				)
				return models
			},
		},

		get: {
			rest: 'GET /models/:id',
		},

		update: {
			rest: 'PUT /models/:id',
		},

		remove: {
			rest: 'DELETE /models/:id',
		},

		create: {
			rest: 'POST models',
			event: 'created',
		},

		seed: {
			rest: 'POST /models/seed',
			async handler(ctx) {
				const collections = await ctx.call('collections.list')

				const modelSeedDatas = collections
					.map((collection) => {
						const seedData = Array(100)
							.fill()
							.map(() => {
								return {
									name: faker.commerce.productName(),
									category: faker.commerce.product(),
									collection: collection._id,
									description: faker.commerce.productDescription(),
									thumbnail: faker.image.image(),
									materials: faker.commerce.productMaterial(),
								}
							})

						return seedData
					})
					.reduce((modelDatas, current) => {
						return [...modelDatas, ...current]
					}, [])

				const doc = await this.adapter.insertMany(modelSeedDatas)
				// const models = await this.transformDocuments(ctx, {}, doc)

				// return models
			},
		},

		clear: {
			rest: 'DELETE /models/clear',
			async handler(ctx) {
				this.adapter.clear()
			},
		},
	},
	events: {},
}
