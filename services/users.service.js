'use strict'

const { MoleculerClientError } = require('moleculer').Errors
const { sha256 } = require('js-sha256')
const otpGenerator = require('otp-generator')
const jwt = require('jsonwebtoken')
const DbService = require('../mixins/db.mixin')
const CacheCleanerMixin = require('../mixins/cache.cleaner.mixin')

module.exports = {
	name: 'users',

	mixins: [DbService('users'), CacheCleanerMixin(['cache.clean.users'])],

	settings: {
		rest: '/',

		JWT_SECRET: process.env.JWT_SECRET || 'jwt-conduit-secret',

		randomNoun: ['Apple', 'Banana', 'Orange', 'Pineapple', 'Potato', 'Tomato'],

		randomAdjective: ['Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Orange'],

		fields: [
			'_id',
			'username',
			'email',
			'handler',
			'refreshToken',
			'collections',
			'avatar',
		],

		populates: {
			collections: {
				action: 'collections.get',
				params: {
					fields: '_id name price title',
				},
			},
		},

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
				// const otp = '123456'
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
				user: {
					type: 'object',
					optional: true,
					props: {
						username: 'string',
					},
				},
			},
			async handler(ctx) {
				const { otp, hash, email } = ctx.params
				const currentDate = new Date()

				let [hashValue, expirationTime] = hash.split('.')

				ctx.params.user
					? this.logger.warn('user contain')
					: this.logger.warn('user not contain')

				this.checkRequiredFields(otp, 'otp')
				this.checkRequiredFields(hash, 'hash')
				this.checkRequiredFields(email, 'email')

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

						if (!user && !ctx.params.user) {
							const randomName = this.getRandomName()
							user = await this.createNewUser(
								email,
								randomName,
								refreshToken,
								ctx
							)
						} else if (ctx.params.user) {
							user = await this.createNewUser(
								email,
								ctx.params.user.username,
								refreshToken,
								ctx
							)
						} else {
							user = await this.adapter.updateById(user._id, {
								$set: {
									refreshToken,
								},
							})
						}

						ctx.meta.cookies = {
							refreshToken,
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

		/**
		 * Refresh JWT token
		 *
		 * @actions
		 * @param {String} refreshToken - Refresh token
		 *
		 * @returns {Object} accessToken - JWT access token
		 * @returns {Object} refreshToken - JWT refresh token
		 *
		 * @throws {MoleculerClientError} - If refresh token is invalid
		 */
		retrieveAccessToken: {
			rest: 'GET /refresh',
			async handler(ctx) {
				const refreshToken = ctx.meta.cookies

				if (!refreshToken) {
					throw new MoleculerClientError('Invalid refresh token', 422, '', [
						{
							field: 'refreshToken',
							message: 'is required',
						},
					])
				}

				try {
					const decodedRefreshToken = jwt.verify(
						refreshToken,
						this.settings.JWT_SECRET
					)
					const { email } = decodedRefreshToken

					const user = await this.adapter.findOne({
						email,
					})

					if (user.refreshToken !== refreshToken) {
						throw new MoleculerClientError('Invalid refresh token', 422, '', [
							{
								field: 'refreshToken',
								message: 'is invalid',
							},
						])
					} else {
						const { accessToken } = await this.generateJWT(email)

						return {
							accessToken,
						}
					}
				} catch (err) {
					throw new MoleculerClientError('Invalid refresh token', 422, '', [
						{
							field: 'refreshToken',
							message: 'is invalid',
						},
					])
				}
			},
		},

		addCollection: {
			rest: 'POST /users/collections',
			params: {
				collection: 'string',
			},
			auth: 'required',
			async handler(ctx) {
				const collection = ctx.params.collection

				ctx.meta.collection = collection

				const json = await this.adapter
					.updateById(ctx.meta.userID, {
						$push: { collections: collection },
					})
					.then((json) =>
						this.entityChanged('updated.collections', json, ctx).then(
							() => json
						)
					)

				return { collections: json.collections }
			},
		},

		/**
		 * Get current user entity.
		 * Auth is required!
		 *
		 * @actions
		 *
		 * @returns {Object} User entity
		 */
		me: {
			auth: 'required',
			rest: 'GET /user',
			cache: {
				keys: ['#userID', 'handler', 'username', 'email', 'avatar'],
			},
			async handler(ctx) {
				const user = await this.getById(ctx.meta.user._id)
				if (!user) throw new MoleculerClientError('User not found!', 400)

				const doc = await this.transformDocuments(
					ctx,
					{
						fields: ['_id', 'email', 'username', 'handler', 'avatar'],
					},
					user
				)

				return doc
			},
		},

		list: {
			rest: 'GET /users',
		},

		get: {
			rest: 'GET /users/:id',
		},

		update: {
			auth: 'required',
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
				expiresIn: '5m',
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
		 *z
		 */
		async createNewUser(email, username, refreshToken, ctx) {
			const avatar = {
				skin: [],
				hair: [],
				upper: [],
				lower: [],
				shoe: [],
				accessory: [],
				tattoo: [],
				image: 'https://i.pravatar.cc/500',
			}

			const entity = {
				username: username,
				email: email,
				handler: username + '#' + Math.floor(1000 + Math.random() * 9000),
				refreshToken: refreshToken,
				avatar: avatar,
			}

			const doc = await this.adapter.insert(entity)
			const user = await this.transformDocuments(ctx, {}, doc)
			await this.entityChanged('created', user, ctx)
			return user
		},

		getRandomName() {
			// get a random number from 0 to 5
			const randomOne = Math.floor(Math.random() * 5)
			const randomTwo = Math.floor(Math.random() * 5)

			// get a random name from the array
			const randomName = `${this.settings.randomNoun[randomOne]}${this.settings.randomAdjective[randomTwo]}`

			return randomName
		},

		checkRequiredFields(value, fieldName) {
			if (!value) {
				throw new MoleculerClientError(`Invalid ${fieldName}`, 422, '', [
					{
						field: fieldName.toLowerCase(),
						message: 'is required',
					},
				])
			}
		},
	},
}
