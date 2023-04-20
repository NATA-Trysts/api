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

		HMS_ACCESS_TOKEN: process.env.HMS_ACCESS_TOKEN,
		HMS_APP_SECRET: process.env.HMS_APP_SECRET,
		HMS_TEMPLATE_ID: process.env.HMS_TEMPLATE_ID,

		populates: {
			author: {
				action: 'users.get',
				params: {
					fields: '_id username',
				},
			},
		},

		fields: [
			'_id',
			'name',
			'code',
			'password',
			'author',
			'latestEdited',
			'thumbnail',
			'category',
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
			auth: 'required', // turn off for testing
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
			auth: 'required', // turn off for testing
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

				newSpace.latestEdited = Date.now()

				try {
					const space = await this.adapter.findById(ctx.params.id)

					if (!space) {
						throw new MoleculerClientError('Space not found', 404, 'NOT_FOUND')
					}

					if (space.author !== ctx.meta.user._id) {
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

		getSpaceByCode: {
			rest: 'GET /spaces/code/:code',
			async handler(ctx) {
				const code = ctx.params.code

				try {
					const space = await this.adapter.findOne({ code: code })

					if (!space) {
						throw new MoleculerClientError('Space not found', 404, 'NOT_FOUND')
					}

					return space
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'getSpaceByCode',
							message: error.message,
						},
					])
				}
			},
		},

		verifySpacePassword: {
			rest: 'POST /spaces/verify',
			params: {
				code: { type: 'string', min: 8, max: 8 },
				password: { type: 'string' },
			},
			async handler(ctx) {
				const { code, password } = ctx.params

				try {
					const space = await this.adapter.findOne({ code: code })

					if (!space) {
						throw new MoleculerClientError('Space not found', 404, 'NOT_FOUND')
					}

					if (space.password) {
						if (space.password !== password) {
							throw new MoleculerClientError(
								'Incorrect password',
								422,
								'INCORRECT_PASSWORD'
							)
						}
					}

					// return space
					return true
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'verifySpacePassword',
							message: error.message,
						},
					])
				}
			},
		},

		getSpacesByUserId: {
			rest: 'GET /spaces/user/:id',
			async handler(ctx) {
				const userId = ctx.params.id

				try {
					let params = {
						populate: ['author'],
						query: { author: userId },
					}

					const spaces = await this.adapter.find(params)

					if (!spaces) {
						throw new MoleculerClientError('Spaces not found', 404, 'NOT_FOUND')
					}

					const docs = await this.transformDocuments(ctx, params, spaces)

					return docs
				} catch (error) {
					throw new MoleculerClientError(error.message, 422, '', [
						{
							field: 'getSpacesByUserId',
							message: error.message,
						},
					])
				}
			},
		},

		list: {
			auth: 'required',
			rest: 'GET /spaces',
			async handler(ctx) {
				let params = {
					populate: ['author'],
				}

				const spaces = await this.adapter.find()

				if (!spaces) {
					throw new MoleculerClientError('Spaces not found', 404, 'NOT_FOUND')
				}

				const docs = await this.transformDocuments(ctx, params, spaces)

				return docs
			},
		},

		get: {
			auth: 'required',
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

		formatNameForHMS(name) {
			// format the name to format: xxx-xxx-xxx
			const formattedName = name.replace(/\s+/g, '-').toLowerCase()

			return formattedName
		},

		async createNewSpace(name, password, model, ctx) {
			const hmsRoom = await this.createHMSRoom(name)

			// TEMP CATEGORY
			const categories = ['offices', 'families']

			const newSpace = await this.adapter.insert({
				name: name,
				code: this.generateSpaceCode(),
				password: password || '',
				author: ctx.meta.user._id,
				// author: 'pPJJWmWn1oqOoELs',
				latestEdited: Date.now(),
				thumbnail:
					'https://hips.hearstapps.com/hmg-prod/images/womanyellingcat-1573233850.jpg',
				model: model,
				category: categories[Math.floor(Math.random() * categories.length)],
				hmsRoomId: hmsRoom.id,
			})
			const space = await this.transformDocuments(ctx, {}, newSpace)
			await this.entityChanged('created', space, ctx)

			return newSpace
		},

		generateHMSToken() {
			const appAccessToken = this.settings.HMS_ACCESS_TOKEN
			// const appSecret = this.settings.HMS_APP_SECRET
			const appSecret =
				'TNGLcZVO3NeuOAxvo5pp7Pk7sbDFVmie7AB_ACZ_oN1i4oCkxsJB1XpQGO07vRK06KF4iJXExccYMK0fw6fnP1Ptvdf2H4y4vLaL2lS6iaS4rsglVIytWoe10dUrJMqPRjpKV1C7Q9soEJlJM6Du8KXLVZFqixpXttFodX9KsuA='

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
			const templateId = this.settings.HMS_TEMPLATE_ID
			const hmsRoomName = this.formatNameForHMS(name)

			return axios
				.post(
					'https://api.100ms.live/v2/rooms',
					{
						name: `${hmsRoomName}-${Date.now()}`,
						description: 'Dummy description',
						template_id: templateId,
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
