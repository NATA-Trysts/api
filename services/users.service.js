'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const jwt = require('jsonwebtoken')

const DbService = require('../mixins/db.mixin')
const CacheCleanerMixin = require('../mixins/cache.cleaner.mixin')

module.exports = {
	name: 'users',

	mixins: [
		DbService('users'),
		CacheCleanerMixin(['cache.clean.users', 'cache.clean.follows']),
	],

	settings: {
		rest: '/',

		JWT_SECRET: process.env.JWT_SECRET || 'jwt-conduit-secret',

		fields: ['_id', 'username', 'email', 'handler', 'token'],

		entityValidator: {
			username: { type: 'string', min: 2, max: 15 },
			email: { type: 'email' },
		},
	},

	actions: {
		/**
		 * create a new user
		 *
		 * @actions
		 *
		 * @param {Object} user - User entity
		 *
		 * @returns {Object} Created entity
		 */
		create: {
			rest: 'POST /users',
			params: {
				user: { type: 'object' },
			},
			async handler(ctx) {
				const entity = ctx.params.user
				await this.validateEntity(entity)

				if (entity.username) {
					const found = await this.adapter.findOne({
						username: entity.username,
					})
					if (found) {
						throw new MoleculerClientError(
							'Username is already taken!',
							422,
							'',
							[
								{
									field: 'username',
									message: 'is already taken',
								},
							]
						)
					}
				}

				if (entity.email) {
					const found = await this.adapter.findOne({
						email: entity.email,
					})
					if (found) {
						throw new MoleculerClientError('Email is already exist!', 422, '', [
							{
								field: 'email',
								message: 'is already exist',
							},
						])
					}
				}

				const json = await this.createNewUser(
					entity.email,
					entity.username,
					ctx
				)
				return json
			},
		},

		/**
		 * Verify a user's email address.
		 *
		 * @actions
		 * @param {String} email - User's email address
		 * @param {String} code - Verification code
		 *
		 * @returns {Object} User entity
		 */
		verifyOtp: {
			rest: 'POST /verify',
			params: {
				code: { type: 'string' },
				email: { type: 'string' },
			},
			async handler(ctx) {
				const { code, email } = ctx.params

				const isVerified = await this.verifyOtp(email, code)

				if (isVerified) {
					// if email of user has in database, return user
					// else create new user
					const user = await this.adapter.findOne({ email })

					if (user) {
						return user
					} else {
						const entity = {
							username: email,
							email: email,
						}

						const json = await this.createNewUser(
							entity.email,
							entity.username,
							ctx
						)
						return json
					}
				} else {
					throw new MoleculerClientError('Invalid code', 422, '', [
						{
							field: 'code',
							message: 'is invalid',
						},
					])
				}
			},
		},

		list: {
			rest: 'GET /users',
		},

		get: {
			rest: 'GET /users/:id',
		},

		update: {
			rest: 'PUT /users/:id',
		},

		remove: {
			rest: 'DELETE /users/:id',
		},
	},

	methods: {
		/**
		 * Generate a JWT token from user entity
		 *
		 * @param {Object} user
		 */
		generateJWT(user) {
			const today = new Date()
			const exp = new Date(today)
			exp.setDate(today.getDate() + 60)

			return jwt.sign(
				{
					id: user._id,
					username: user.username,
					exp: Math.floor(exp.getTime() / 1000),
				},
				this.settings.JWT_SECRET
			)
		},

		/**
		 * Transform returned user entity. Generate JWT token if neccessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token) {
			if (user) {
				if (withToken) user.token = token || this.generateJWT(user)
			}

			return { user }
		},

		/**
		 * Verify code from email
		 *
		 * @param {String} email
		 * @param {String} code
		 */
		async verifyOtp(email, code) {
			// temporary
			const emailAndCodeMapping = {
				'sonha@gmail.com': '123456',
				'tienthinh@gmail.com': '654321',
			}

			if (emailAndCodeMapping[email] === code) {
				return true
			} else {
				return false
			}
		},

		async createNewUser(email, username, ctx) {
			const entity = {
				username: username,
				email: email,
				handler: username + '#' + Math.floor(1000 + Math.random() * 9000),
			}

			const doc = await this.adapter.insert(entity)
			const user = await this.transformDocuments(ctx, {}, doc)
			const json = await this.transformEntity(user, true)
			await this.entityChanged('created', json, ctx)
			return json
		},
	},
}
