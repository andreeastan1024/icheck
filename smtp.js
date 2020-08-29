import nodemailer from 'nodemailer';
import { smtpOptions, viewsOptions } from './config/';
import handlebarsPlugin from 'nodemailer-express-handlebars';

const transporter = nodemailer.createTransport(smtpOptions);

transporter.use("compile", handlebarsPlugin(viewsOptions));

export default transporter;