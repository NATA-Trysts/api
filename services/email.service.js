'use strict'

const { MoleculerError, MoleculerRetryableError } = require('moleculer').Errors
const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')
const handlebars = require('handlebars')
const crypto = require('crypto')

module.exports = {
	name: 'email',

	settings: {
		from: null,
		transport: {
			host: process.env.EMAIL_SERVER,
			port:
				process.env.NODE_ENV === 'production'
					? process.env.EMAIL_PORTS_SSL
					: process.env.EMAIL_PORTS_TLS,
			secure: process.env.NODE_ENV === 'production',
			auth: {
				user: process.env.EMAIL_AUTH_USER,
				pass: process.env.EMAIL_AUTH_PASS,
			},
		},
		email: {
			otp: {
				headers: [
					'Woohoo, can’t wait to see you 😆',
					"It's Trystsin' time! 😮",
					'Test1',
					'Test2',
					'Test3',
				],
				firstLines: [
					'Just one more step before jump into Trysts, feel free to use the lucky number below to start with us.',
					"The following magic number will lead you one step closer to Trysts, but remind yourself before you decide. You don't know what's coming (it will be fun).",
					'Test1',
					'Test2',
					'Test3',
					'Test4',
					'Test5',
				],
			},
		},
	},

	actions: {
		send: {
			rest: 'POST /',
			params: {
				to: 'string',
				otp: 'string',
			},
			async handler(ctx) {
				return this.send(ctx.params.to, ctx.params.otp)
			},
		},
	},

	methods: {
		async send(to, otp) {
			return new this.Promise((resolve, reject) => {
				this.logger.debug(`Sending email to ${to} '...`)

				const __dirname = path.resolve()
				const filePath = path.join(
					__dirname,
					'./assets/email-template/otp.html'
				)
				const source = fs.readFileSync(filePath, 'utf-8').toString()
				const template = handlebars.compile(source)

				const header =
					this.settings.email.otp.headers[
						crypto.randomInt(this.settings.email.otp.headers.length)
					]
				const firstLine =
					this.settings.email.otp.firstLines[
						crypto.randomInt(this.settings.email.otp.firstLines.length)
					]

				const replacements = {
					otp: otp,
					header: header,
					firstLine: firstLine,
				}

				const htmlToSend = template(replacements)

				// TODO: Improve UX Writing
				let mailOptions = {
					from: '"Trysts OTP ✨" <noreply@trysts.io>',
					to,
					subject: "Trysts's login OTP",
					text: 'One more step to jump into Trysts!',
					html: htmlToSend,
				}

				if (this.transporter) {
					this.transporter.sendMail(mailOptions, (err, info) => {
						if (err) {
							this.logger.warn('Unable to send email: ', err)
							reject(
								new MoleculerRetryableError(
									'Unable to send email! ' + err.message
								)
							)
						} else {
							this.logger.info('Email message sent.', info.response)
							resolve(info)
						}
					})
				} else
					return reject(
						new MoleculerError(
							'Unable to send email! Invalid mailer transport: ' +
								this.settings.transport
						)
					)
			})
		},
	},

	created() {
		this.transporter = nodemailer.createTransport(this.settings.transport)
	},
}
