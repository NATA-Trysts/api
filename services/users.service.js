'use strict'

const { MoleculerClientError } = require('moleculer').Errors

const bcrypt = require('bcryptjs')
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

		fields: ['_id', 'username', 'email', 'handler'],

		entityValidator: {
			username: { type: 'string', min: 2, max: 15 },
			email: { type: 'email' },
		},
	},

	actions: {
		create: {
			rest: 'POST /users',
			params: {
				user: { type: 'object' }, // { username, email }, handler is generated automatically
			},
			async handler(ctx) {
				const entity = ctx.params.user
				await this.validateEntity(entity)

				if (entity.username) {
					const found = await this.adapter.findOne({
						username: entity.username,
					})
					if (found) {
						throw new MoleculerClientError('Username is already taken!', 422, [
							{
								field: 'username',
								message: 'is already taken',
							},
						])
					}
				}

				if (entity.email) {
					const found = await this.adapter.findOne({
						email: entity.email,
					})
					if (found) {
						throw new MoleculerClientError('Email is already exist!', 422, [
							{
								field: 'email',
								message: 'is already exist',
							},
						])
					}
				}

				entity.handler =
					entity.username + '#' + Math.floor(1000 + Math.random() * 9000)

				const doc = await this.adapter.insert(entity)
				const user = await this.transformDocuments(ctx, {}, doc)
				const json = await this.transformEntity(user, true)
				await this.entityChanged('created', json, ctx)
				return json
			},
		},

		/**
		 * Verify a user's email address.
		 */
		verifyOtp: {
			rest: 'POST /verify',
			params: {
				code: { type: 'string' },
				email: { type: 'string' },
			},
			async handler(ctx) {
				this.verifyOtp(ctx.params.code, ctx.params.email)
			},
		},

		list: {
			rest: 'GET /users',
			async handler(ctx) {
				const query = ctx.params
				const docs = await this.adapter.find(query)
				const users = await this.transformDocuments(ctx, {}, docs)
				return users.map((user) => this.transformEntity(user, false))
			},
		},

		get: {
			rest: 'GET /users/:id',
			async handler(ctx) {
				const doc = await this.adapter.findById(ctx.params.id)
				const user = await this.transformDocuments(ctx, {}, doc)
				return this.transformEntity(user, false)
			},
		},

		update: {
			rest: 'PUT /users/:id',
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
					if (found && found._id != ctx.params.id) {
						throw new MoleculerClientError('Username is already taken!', 422, [
							{
								field: 'username',
								message: 'is already taken',
							},
						])
					}
				}

				if (entity.email) {
					const found = await this.adapter.findOne({
						email: entity.email,
					})
					if (found && found._id != ctx.params.id) {
						throw new MoleculerClientError('Email is already exist!', 422, [
							{
								field: 'email',
								message: 'is already exist',
							},
						])
					}
				}

				const doc = await this.adapter.updateById(ctx.params.id, entity)
				const user = await this.transformDocuments(ctx, {}, doc)
				const json = await this.transformEntity(user, false)
				await this.entityChanged('updated', json, ctx)
				return json
			},
		},

		remove: {
			rest: 'DELETE /users/:id',
			async handler(ctx) {
				const doc = await this.adapter.findById(ctx.params.id)
				const user = await this.transformDocuments(ctx, {}, doc)
				await this.adapter.removeById(ctx.params.id)
				const json = await this.transformEntity(user, false)
				await this.entityChanged('removed', json, ctx)
				return json
			},
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
				//user.image = user.image || "https://www.gravatar.com/avatar/" + crypto.createHash("md5").update(user.email).digest("hex") + "?d=robohash";
				user.image = user.image || ''
				if (withToken) user.token = token || this.generateJWT(user)
			}

			return { user }
		},

		/**
		 * Transform returned user entity as profile.
		 *
		 * @param {Context} ctx
		 * @param {Object} user
		 * @param {Object?} loggedInUser
		 */
		async transformProfile(ctx, user, loggedInUser) {
			//user.image = user.image || "https://www.gravatar.com/avatar/" + crypto.createHash("md5").update(user.email).digest("hex") + "?d=robohash";
			user.image =
				user.image ||
				'https://static.productionready.io/images/smiley-cyrus.jpg'

			if (loggedInUser) {
				const res = await ctx.call('follows.has', {
					user: loggedInUser._id.toString(),
					follow: user._id.toString(),
				})
				user.following = res
			} else {
				user.following = false
			}

			return { profile: user }
		},

		/**
		 * Verify code from email
		 */
		async verifyOtp(email, code) {
			this.logger.warn('Verifying code', email, code)
		},
	},
}
