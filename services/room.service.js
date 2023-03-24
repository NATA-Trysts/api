'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const DbService = require('../mixins/db.mixin')

module.exports = {
	name: 'rooms',

	mixins: [DbService('rooms')],

	settings: {
		rest: '/',

		fields: [
			'_id',
			'name',
			'code',
			'password',
			'ownerId',
			'createdAt',
			'updatedAt',
			'model',
		],

		entityValidator: {
			name: { type: 'string', min: 3 },
		},
	},

	actions: {},

	methods: {},
}
