'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const { v4: uuidv4 } = require('uuid')
const bcrypt = require('bcryptjs')

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

	actions: {
		/**
		 * Create a new room
		 *
		 * @actions
		 * @param {String} name - Name of the room
		 * @param {String} password - Password of the room
		 * @param {Object} model - Model of the room
		 *
		 * @returns {Object} Created room
		 */
		create: {
			// auth: required, // turn off for testing
			rest: 'POST /rooms',
			params: {
				name: { type: 'string', min: 2 },
				password: { type: 'string', optional: true },
				model: { type: 'object' },
			},
			async handler(ctx) {
				const entity = ctx.params
				await this.validateEntity(entity)

				// hash the password if it exists
				if (entity.password) {
					entity.password = bcrypt.hashSync(entity.password, 10)
				}

				try {
					const newRoom = await this.createNewRoom(
						entity.name,
						entity.password,
						entity.model,
						ctx
					)

					return newRoom
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
		 * Update a room
		 *
		 * @actions
		 * @param {String} id - ID of the room
		 * @param {String} name - Name of the room
		 * @param {String} password - Password of the room
		 * @param {Object} model - Model of the room
		 *
		 * @returns {Object} Updated room
		 *
		 */
		update: {
			// auth: 'required', // turn off for testing
			rest: 'PUT /rooms/:id',
			params: {
				room: {
					type: 'object',
					props: {
						name: { type: 'string', min: 2, optional: true },
						password: { type: 'string', optional: true },
						model: { type: 'object', optional: true },
					},
				},
			},
			async handler(ctx) {
				let newRoom = ctx.params.room

				// hash the password if it exists
				if (newRoom.password) {
					newRoom.password = bcrypt.hashSync(newRoom.password, 10)
				}

				newRoom.updatedAt = Date.now()

				try {
					const room = await this.adapter.findById(ctx.params.id)

					if (!room) {
						throw new MoleculerClientError('Room not found', 404, 'NOT_FOUND')
					}

					if (room.ownerId !== ctx.meta.user._id) {
						throw new MoleculerClientError(
							'You are not the owner of this room',
							403,
							'NOT_OWNER'
						)
					}

					const update = {
						$set: newRoom,
					}

					const doc = await this.adapter.updateById(room._id, update)
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
		 * Join a room
		 *
		 * @actions
		 * @param {String} code - Code of the room
		 * @param {String} password - Password of the room
		 *
		 * @returns {Object} Joined room
		 */
		join: {
			// auth: 'required', // turn off for testing
			rest: 'POST /rooms/join',
			params: {
				code: { type: 'string', min: 8, max: 8 },
				password: { type: 'string', optional: true },
			},
			async handler(ctx) {
				const entity = ctx.params

				try {
					const room = await this.adapter.findOne({ code: entity.code })

					if (!room) {
						throw new MoleculerClientError('Room not found', 404, 'NOT_FOUND')
					}

					// check if the room has a password
					if (room.password && entity.password) {
						// check if the password is correct
						if (!bcrypt.compareSync(entity.password, room.password)) {
							throw new MoleculerClientError(
								'Incorrect password',
								422,
								'INCORRECT_PASSWORD'
							)
						}
					}

					return room
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
			rest: 'GET /rooms',
		},

		get: {
			rest: 'GET /rooms/:id',
		},

		remove: {
			rest: 'DELETE /rooms/:id',
		},
	},

	methods: {
		generateRoomCode() {
			const originalUuid = uuidv4()

			// get the first 8 characters of the uuid
			const roomCode = originalUuid.substring(0, 8)

			return roomCode
		},

		async createNewRoom(name, password, model, ctx) {
			const newRoom = await this.adapter.insert({
				name: name,
				code: this.generateRoomCode(),
				password: password,
				ownerId: ctx.meta.user._id,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				model: model,
			})
			const room = await this.transformDocuments(ctx, {}, newRoom)
			await this.entityChanged('created', room, ctx)

			return newRoom
		},
	},
}
