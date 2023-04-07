'use strict'

const { randomInt } = require('crypto')
const DbService = require('../mixins/db.mixin')
const { faker } = require('@faker-js/faker')

module.exports = {
	name: 'collections',
	mixins: [DbService('collections')],
	settings: {
		rest: '/',
		fields: [
			'_id',
			'name',
			'price',
			'description',
			'number_of_buyers',
			'title',
			'models',
		],
		randomName: [
			'Pitseolak',
			'Adalbert',
			'Öztürk',
			'Nosipho',
			'Marius',
			'Minerva',
		],
	},
	actions: {
		list: {
			rest: 'GET /collections',
			auth: 'required',
			async handler(ctx) {
				const { collections: bought_collection } = await ctx.call('users.get', {
					id: ctx.meta.userID,
					fields: 'collections',
				})

				const collections = await this.adapter.find()

				return { collections, bought_collection }
			},
		},

		get: {
			rest: 'GET /collections/:id',
		},

		update: {
			rest: 'PUT /collections/:id',
		},

		remove: {
			rest: 'DELETE /collections/:id',
		},

		create: {
			rest: 'POST /collections',
		},

		seed: {
			rest: 'POST /collections/seed',
			async handler(ctx) {
				const seedData = Array(100)
					.fill()
					.map((i) => {
						const name =
							this.settings.randomName[
								randomInt(this.settings.randomName.length)
							]

						return {
							name: name,
							price: faker.finance.amount(1, 100),
							descriptions: `${name} Collection`,
							number_of_buyers: 0,
							title: 'Hello',
							models: [],
						}
					})
				const doc = await this._insert(ctx, { entities: seedData })

				const collections = this.transformDocuments(ctx, {}, doc)

				return collections
			},
		},

		clear: {
			rest: 'DELETE /collections/clear',
			async handler(ctx) {
				this.adapter.clear().then(() => this.clearCache())
			},
		},
	},
	events: {
		'models.entity.created': {
			handler(ctx) {
				this.adapter
					.updateById(ctx.params.entity.collection, {
						$push: { models: ctx.params.entity._id },
					})
					.then(() => this.clearCache())
			},
		},
		'users.entity.updated.collections': {
			handler(ctx) {
				this.adapter
					.updateById(ctx.params.meta.collection, {
						$inc: { number_of_buyers: 1 },
					})
					.then(() => this.clearCache())
			},
		},
	},
}
