'use strict'

const _ = require('lodash')
const ApiGateway = require('moleculer-web')
const Cookies = require('cookies')
const { UnAuthorizedError } = ApiGateway.Errors

module.exports = {
	name: 'api',
	mixins: [ApiGateway],

	settings: {
		port: process.env.PORT || 3000,

		routes: [
			{
				path: '/api',

				onBeforeCall(ctx, route, req, res) {
					if (
						ctx.params.req.url === '/verify' ||
						ctx.params.req.url === '/refresh'
					) {
						res.cookies = new Cookies(req, res, { secure: true })
						// Set request cookies to context meta
						ctx.meta.cookies = res.cookies.get('refreshToken')
					}
				},

				onAfterCall(ctx, route, req, res, data) {
					if (ctx.params.req.url === '/verify') {
						if (ctx.meta.cookies) {
							res.cookies.set('refreshToken', ctx.meta.cookies.refreshToken, {
								secure: true,
								sameSite: 'none',
								maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
							})
						}
					}
					return data
				},

				authorization: true,
				autoAliases: true,

				whitelist: [
					// Access to any actions in all services under "/api" URL
					'**',
				],

				// Set CORS headers
				cors: {
					origin: [
						'http://127.0.0.1:5173',
						'http://localhost:5173',
						'https://app.trysts.io/',
						'http://app.trysts.io/',
						'https://www.app.trysts.io/',
						'http://www.app.trysts.io/',
					],
					methods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
					allowedHeaders: [
						'Authorization',
						'Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers',
					],
					exposedHeaders: [
						'Set-Cookie, Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers',
					],
					credentials: true,
				},

				// cors: true,

				// Parse body content
				bodyParsers: {
					json: {
						strict: false,
					},
					urlencoded: {
						extended: false,
					},
				},
			},
		],

		// logRequestParams: "info",
		// logResponseData: "info",

		onError(req, res, err) {
			// Return with the error as JSON object
			res.setHeader('Content-type', 'application/json; charset=utf-8')
			res.writeHead(err.code || 500)

			if (err.code == 422) {
				let o = {}
				err.data.forEach((e) => {
					let field = e.field.split('.').pop()
					o[field] = e.message
				})

				res.end(JSON.stringify({ errors: o }, null, 2))
			} else {
				const errObj = _.pick(err, ['name', 'message', 'code', 'type', 'data'])
				res.end(JSON.stringify(errObj, null, 2))
			}
			this.logResponse(req, res, err ? err.ctx : null)
		},
	},

	methods: {
		/**
		 * Authorize the request
		 *
		 * @param {Context} ctx
		 * @param {Object} route
		 * @param {IncomingRequest} req
		 * @returns {Promise}
		 */
		async authorize(ctx, route, req) {
			let token
			if (req.headers.authorization) {
				let type = req.headers.authorization.split(' ')[0]
				if (type === 'Token' || type === 'Bearer')
					token = req.headers.authorization.split(' ')[1]
			}

			let user
			if (token) {
				// Verify JWT token
				try {
					user = await ctx.call('users.resolveToken', { token })
					if (user) {
						this.logger.info('Authenticated via JWT: ', user.email)
						// Reduce user fields (it will be transferred to other nodes)
						ctx.meta.user = _.pick(user, [
							'_id',
							'username',
							'email',
							'handler',
						])
						ctx.meta.token = token
						ctx.meta.userID = user._id
					}
				} catch (err) {
					// Ignored because we continue processing if user doesn't exists
				}
			}

			if (req.$action.auth == 'required' && !user) throw new UnAuthorizedError()
		},
	},
}
