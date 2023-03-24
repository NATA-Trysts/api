'use strict'

const { MoleculerError, MoleculerRetryableError } = require('moleculer').Errors
const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')
const handlebars = require('handlebars')
const otpGenerator = require('otp-generator')
const crypto = require('crypto')

module.exports = {
	name: 'email',

	settings: {
		from: null,
		transport: {
			service: 'gmail',
			auth: {
				user: 'trystsplatform@gmail.com',
				pass: 'ffwlkwaialrtbsoz',
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
					this.settings.transport.email.otp.headers[
						crypto.randomInt(this.settings.transport.email.otp.headers.length)
					]
				const firstLine =
					this.settings.transport.email.otp.firstLines[
						crypto.randomInt(
							this.settings.transport.email.otp.firstLines.length
						)
					]

				const replacements = {
					otp: otp,
					header: header,
					firstLine: firstLine,
				}

				const htmlToSend = template(replacements)

				let mailOptions = {
					from: '"sonhaaa at Trysts ✨" <trystsplatform@gmail.com>',
					to,
					subject: 'Heyyy',
					text: 'That was easy!',
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
