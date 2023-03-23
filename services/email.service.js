'use strict'

const { MoleculerError, MoleculerRetryableError } = require('moleculer').Errors
const nodemailer = require('nodemailer')
const path = require('path')
const fs = require('fs')
const handlebars = require('handlebars')

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
		},
	},

	actions: {
		send: {
			rest: 'POST /',
			params: {
				to: 'string',
			},
			async handler(ctx) {
				return this.send(ctx.params.to)
			},
		},
	},

	methods: {
		async send(to) {
			return new this.Promise((resolve, reject) => {
				this.logger.debug(`Sending email to ${to} '...`)

				const __dirname = path.resolve()
				const filePath = path.join(
					__dirname,
					'./assets/email-template/otp.html'
				)
				const source = fs.readFileSync(filePath, 'utf-8').toString()
				const template = handlebars.compile(source)
				const replacements = {
					otp: '111111',
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
