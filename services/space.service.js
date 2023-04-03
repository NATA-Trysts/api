'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const axios = require('axios')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')

const DbService = require('../mixins/db.mixin')

module.exports = {
	name: 'spaces',

	mixins: [DbService('spaces')],

	settings: {
		rest: '/',

		fields: [
			'_id',
			'name',
			'code',
			'password',
			'ownerId',
			'updatedAt',
			'hmsRoomId',
			'models',
		],

		entityValidator: {
			name: { type: 'string', min: 3 },
		},
	},

	actions: {
		/**
		 * Create a new space
		 *
		 * @actions
		 * @param {String} name - Name of the space
		 * @param {String} password - Password of the space
		 * @param {Object} model - Model of the space
		 *
		 * @returns {Object} Created space
		 */
		create: {
			// auth: 'required', // turn off for testing
			rest: 'POST /spaces',
			params: {
				name: { type: 'string', min: 2 },
				password: { type: 'string', optional: true },
				models: { type: 'array' },
			},
			async handler(ctx) {
				const entity = ctx.params
				await this.validateEntity(entity)

				try {
					const newSpace = await this.createNewSpace(
						entity.name,
						entity.password,
						entity.model,
						ctx
					)

					return newSpace
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'create',
							message: error.message,
						},
					])
				}
			},
		},

		/**
		 * Update a space
		 *
		 * @actions
		 * @param {String} id - ID of the space
		 * @param {String} name - Name of the space
		 * @param {String} password - Password of the space
		 * @param {Object} model - Model of the space
		 *
		 * @returns {Object} Updated space
		 *
		 */
		update: {
			// auth: 'required', // turn off for testing
			rest: 'PUT /spaces/:id',
			params: {
				space: {
					type: 'object',
					props: {
						name: { type: 'string', min: 2, optional: true },
						password: { type: 'string', optional: true },
						models: { type: 'array', optional: true },
					},
				},
			},
			async handler(ctx) {
				let newSpace = ctx.params.space

				newSpace.updatedAt = Date.now()

				try {
					const space = await this.adapter.findById(ctx.params.id)

					if (!space) {
						throw new MoleculerClientError('Space not found', 404, 'NOT_FOUND')
					}

					if (space.ownerId !== ctx.meta.user._id) {
						throw new MoleculerClientError(
							'You are not the owner of this space',
							403,
							'NOT_OWNER'
						)
					}

					const update = {
						$set: newSpace,
					}

					const doc = await this.adapter.updateById(space._id, update)
					const entity = this.transformDocuments(ctx, {}, doc)
					await this.entityChanged('updated', entity, ctx)
					return entity
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'update',
							message: error.message,
						},
					])
				}
			},
		},

		/**
		 * Join a space
		 *
		 * @actions
		 * @param {String} code - Code of the space
		 * @param {String} password - Password of the space
		 *
		 * @returns {Object} Joined space
		 */
		join: {
			// auth: 'required', // turn off for testing
			rest: 'POST /spaces/join',
			params: {
				code: { type: 'string', min: 8, max: 8 },
				password: { type: 'string', optional: true },
			},
			async handler(ctx) {
				const entity = ctx.params

				try {
					const space = await this.adapter.findOne({ code: entity.code })

					if (!space) {
						throw new MoleculerClientError('Space not found', 404, 'NOT_FOUND')
					}

					// check if the space has a password
					if (space.password && entity.password) {
						// check if the password is correct
						if (!bcrypt.compareSync(entity.password, space.password)) {
							throw new MoleculerClientError(
								'Incorrect password',
								422,
								'INCORRECT_PASSWORD'
							)
						}
					}

					return space
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'join',
							message: error.message,
						},
					])
				}
			},
		},

		list: {
			rest: 'GET /spaces',
		},

		get: {
			rest: 'GET /spaces/:id',
		},

		remove: {
			rest: 'DELETE /spaces/:id',
		},

		testGenHMSRoomId: {
			rest: 'GET /spaces/test',
			async handler(ctx) {
				const managementToken = this.generateHMSToken()

				axios
					.post(
						'https://api.100ms.live/v2/rooms',
						{
							name: 'tien-thinh--1662723668',
							description: 'Dummy description',
							template_id: '638967682b58471af0e13ee7',
							region: 'us',
						},
						{
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${managementToken}`,
							},
						}
					)
					.then((response) => {
						return {
							response: response.data,
						}
					})
					.catch((error) => {
						throw new MoleculerClientError(error.message, 422, '', [
							{
								field: 'test',
								message: error.message,
							},
						])
					})
			},
		},
	},

	methods: {
		generateSpaceCode() {
			const originalUuid = uuidv4()

			// get the first 8 characters of the uuid
			const spaceCode = originalUuid.substring(0, 8)

			return spaceCode
		},

		async createNewSpace(name, password, model, ctx) {
			const hmsRoom = await this.createHMSRoom()

			const newSpace = await this.adapter.insert({
				name: name,
				code: this.generateSpaceCode(),
				password: password || '',
				ownerId: ctx.meta.user._id,
				// ownerId: 'BQtRhzzby4NyFefF',
				updatedAt: Date.now(),
				model: model,
				hmsRoomId: hmsRoom.id,
			})
			const space = await this.transformDocuments(ctx, {}, newSpace)
			await this.entityChanged('created', space, ctx)

			return newSpace
		},

		generateHMSToken() {
			const appAccessToken = '63896666195ad14bdcd6ef1f'
			const appSecret =
				'n-PXc2bnmxBVPbq9rQn25SFxu-OP1gOZXo-J3bVXG9TYCnilF62TBqgJlRTZGPQmV9xlHF22vq6wGMmlWSIsYz5LKQi2Xst0452FveWCydzvGPAIhbBpurLorInBXaRNpFLsrNbjj54pESoyzuFr4oqBc0mBry5tnaVKtr3inz0='

			const payload = {
				access_key: appAccessToken,
				type: 'management',
				version: 2,
				iat: Math.floor(Date.now() / 1000),
				nbf: Math.floor(Date.now() / 1000),
			}

			const managementToken = jwt.sign(payload, appSecret, {
				algorithm: 'HS256',
				expiresIn: '24h',
				jwtid: uuidv4(),
			})

			return managementToken
		},

		createHMSRoom(name) {
			const managementToken = this.generateHMSToken()

			return axios
				.post(
					'https://api.100ms.live/v2/rooms',
					{
						name: `${name}-${Date.now()}`,
						description: 'Dummy description',
						template_id: '638967682b58471af0e13ee7',
						region: 'us',
					},
					{
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${managementToken}`,
						},
					}
				)
				.then((response) => {
					return response.data
				})
				.catch((error) => {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'test',
							message: error.message,
						},
					])
				})
		},
	},
}
