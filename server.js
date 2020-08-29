import './utils/setEnv';

import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import cors from 'cors';
import ip from 'ip';
import mongoose from 'mongoose';

import { sessionOptions, databaseOptions } from './config/';
import router from './routes/';
import errors from './errors/';
import databaseController from './controllers/database';

const server = express();

server.use(cors());
server.use(bodyParser.urlencoded({extended: true}));
server.use(bodyParser.json());
server.use(session(sessionOptions));
server.use('/', router);
server.use(errors.notFound);

server.listen(process.env.PORT || process.env.SERVER_PORT, () => {
    console.log("\nServer running on http://%s:%s!", ip.address(), process.env.PORT || process.env.SERVER_PORT);
    
    mongoose.connect(databaseController.getConnectionString(), databaseOptions).then(databaseController.onConnected, databaseController.onError);
    mongoose.connection.on('disconnected', databaseController.onDisconnected);
});

export default server;