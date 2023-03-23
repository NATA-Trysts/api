'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const { sha256 } = require('js-sha256')
const otpGenerator = require('otp-generator')
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

		fields: [
			'_id',
			'username',
			'email',
			'handler',
			'accessToken',
			'refreshToken',
		],

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
		 * Login OTP with email
		 *
		 * @actions
		 * @param {String} email - User's email address
		 *
		 * @returns {Object} full hash - combined hash of email, code and expiration time
		 *
		 */
		login: {
			rest: 'POST /login',
			params: {
				email: { type: 'email' },
			},
			async handler(ctx) {
				const otp = this.generateOtp()
				const ttl = 5 * 60 * 1000 // 5 minutes
				const expires = Date.now() + ttl // 5 minutes from now
				const data = `${ctx.params.email}.${otp}.${expires}`
				const hash = sha256(data)
				const fullHash = `${hash}.${expires}`

				await ctx.call('email.send', {
					to: ctx.params.email,
					otp,
				})

				return {
					fullHash,
				}
			},
		},

		/**
		 * Verify a user's email address.
		 *
		 * @actions
		 * @param {String} email - User's email address
		 * @param {String} code - Verification code
		 * @param {String} hash - Combined hash of email, code and expiration time
		 *
		 * @returns {Object} token - JWT token
		 */
		verifyOtp: {
			rest: 'POST /verify',
			params: {
				otp: { type: 'string' },
				email: { type: 'string' },
				hash: { type: 'string' },
			},
			async handler(ctx) {
				const { otp, hash, email } = ctx.params
				const currentDate = new Date()

				let [hashValue, expirationTime] = hash.split('.')

				if (!otp) {
					throw new MoleculerClientError('Invalid otp', 422, '', [
						{
							field: 'otp',
							message: 'is required',
						},
					])
				}

				if (!hash) {
					throw new MoleculerClientError('Invalid hash', 422, '', [
						{
							field: 'hash',
							message: 'is required',
						},
					])
				}

				if (!email) {
					throw new MoleculerClientError('Invalid email', 422, '', [
						{
							field: 'email',
							message: 'is required',
						},
					])
				}

				if (currentDate.getTime() > parseInt(expirationTime)) {
					throw new MoleculerClientError('Expired otp', 422, '', [
						{
							field: 'otp',
							message: 'is expired',
						},
					])
				} else {
					const data = `${email}.${otp}.${expirationTime}`
					const calculatedHash = sha256(data)

					if (calculatedHash === hashValue) {
						const { accessToken, refreshToken } = await this.generateJWT(email)

						let user = await this.adapter.findOne({
							email,
						})

						if (!user) {
							user = await this.createNewUser(
								email,
								null,
								accessToken,
								refreshToken,
								ctx
							)
						} else {
							user = await this.adapter.updateById(user._id, {
								...user,
								accessToken,
								refreshToken,
							})
						}

						return {
							accessToken,
							refreshToken,
							user,
						}
					} else {
						throw new MoleculerClientError('Invalid otp', 422, '', [
							{
								field: 'otp',
								message: 'is invalid',
							},
						])
					}
				}
			},
		},

		/**
		 * Get user by JWT token (for API GW authentication)
		 *
		 * @actions
		 * @param {String} token - JWT token
		 *
		 * @returns {Object} Resolved user
		 */
		resolveToken: {
			params: {
				token: 'string',
			},
			async handler(ctx) {
				const decoded = await new this.Promise((resolve, reject) => {
					jwt.verify(
						ctx.params.token,
						this.settings.JWT_SECRET,
						(err, decoded) => {
							if (err) {
								return reject(err)
							}

							resolve(decoded)
						}
					)
				})

				if (decoded.email) {
					const user = await this.adapter.findOne({
						email: decoded.email,
					})

					if (user) return user
				}
			},
		},

		list: {
			rest: 'GET /users',
		},

		get: {
			auth: 'required', // FOR TESTING PURPOSES ONLY
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
		 * Generate a JWT token from email
		 *
		 * @param {String} email
		 */
		generateJWT(email) {
			const payload = { email }

			const accessToken = jwt.sign(payload, this.settings.JWT_SECRET, {
				expiresIn: '30m',
			})

			const refreshToken = jwt.sign(payload, this.settings.JWT_SECRET, {
				expiresIn: '7d',
			})

			return { accessToken, refreshToken }
		},

		/**
		 * Generate a random OTP
		 *
		 * @returns {String} otp
		 *
		 * @example
		 * 123456
		 */
		generateOtp() {
			return otpGenerator.generate(6, {
				digits: true,
				lowerCaseAlphabets: false,
				upperCaseAlphabets: false,
				specialChars: false,
			})
		},

		/**
		 * Create a new user
		 *
		 * @param {String} email
		 * @param {String} username
		 * @param {String} accessToken
		 * @param {String} refreshToken
		 * @param {Object} ctx
		 *
		 * @returns {Object} user
		 *
		 */
		async createNewUser(email, username, accessToken, refreshToken, ctx) {
			const entity = {
				username: username,
				email: email,
				handler: username + '#' + Math.floor(1000 + Math.random() * 9000),
				accessToken: accessToken,
				refreshToken: refreshToken,
			}

			const doc = await this.adapter.insert(entity)
			const user = await this.transformDocuments(ctx, {}, doc)
			await this.entityChanged('created', user, ctx)
			return user
		},
	},
}
