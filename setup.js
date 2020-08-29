import fs from 'fs';
import inquirer from 'inquirer';
import { version } from './iCheck.json';
import randomString from './utils/generators/randomString';
import os from 'os';
import mongoose from 'mongoose';
import { databaseOptions } from './config/index.js';
import hash from './utils/hash/';
import Host from './models/Host';
import database from './controllers/database'

const settingsStructure = {
    SERVER: { PORT: /^[0-9]+$/ },
    DATABASE: { 
        PORT: /^[0-9]+$/,
        HOST: /^(localhost)$|(^((1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.(\d{1,2}|(1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.(\d{1,2}|(1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.((1\d{0,2})|(2[0-4][0-9])|(25[0-5])|(\d{1,2})))$|(\w+\.)+[A-Za-z]{2,}/,
        USER: /^$|\w+/,
        PASS: [/^$|\w+/, "password"],
        NAME: /\w+/
    },
    SESSION: {
        SECRET: randomString(),
        LIFETIME: 10,
        NAME: randomString()
    },
    SMTP: {
        HOST: /^(localhost)$|(^((1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.(\d{1,2}|(1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.(\d{1,2}|(1\d{0,2})|(2[0-4][0-9])|(25[0-5]))\.((1\d{0,2})|(2[0-4][0-9])|(25[0-5])|(\d{1,2})))$|(\w+\.)+[A-Za-z]{2,}/,
        PORT: /^[0-9]+$/,
        SECURE: [/y|n/i, "confirm"],
        USER: /^$|\w+/,
        PASS: [/^$|\w+/, "password"]
    }
};

const adminStructure = {
    name: /\w+/,
    email: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    password: [/\w+/, "password"]
};

let settings = {}, questions = [], generatedSettings = {}, adminQuestions = [];

const generateQuestions = (object, category=false) => Object.keys(object).map(key => {
    if(object[key] instanceof RegExp) addQuestion(object[key], key, category);
    else if(object[key] instanceof Array) addQuestion(object[key][0], key, category, object[key][1]);
    else if(typeof object[key] === "object") generateQuestions(object[key], key);
    else generatedSettings[(category?`${category}_`:"") + key] = object[key];
});

const addQuestion = (object, key, category, type = "input") => questions.push({
    type,
    mask: "*",
    name: (category?`${category}_`:"") + key,
    message:(category?`[${category}] `:"") + `${key}:`,
    validate: (input) => object.test(input)
});

const generateSettingsFile = async (settings) => {
    let filename = `${process.env.NODE_ENV.trim()}.env`, OK;
    fs.truncate(filename, () => OK = Promise.all(Object.keys(settings).map( (key) => fs.appendFile(filename, `${key} = ${settings[key]}${os.EOL}`, (err) => err?console.error(err):Promise.resolve()))));
    console.log("\nSettings file generated!");
    return OK;
}

const generateAdminQuestions = () => Promise.all(Object.keys(adminStructure).map(key => {
    adminQuestions.push({
        type: adminStructure[key] instanceof Array?adminStructure[key][1]:"input",
        mask: "*",
        name: key,
        message: `[ADMIN] ${key.toUpperCase()}:`,
        validate: (input) => (adminStructure[key] instanceof Array)?adminStructure[key][0].test(input):adminStructure[key].test(input)
    });
    return Promise.resolve();
}));

generateQuestions(settingsStructure);

console.log(`\niCheck v${version} Setup\n`);

inquirer.prompt(questions).then(answers => {
    settings = {...answers, ...generatedSettings};
}).then(() => {
    generateSettingsFile(settings).then(() => mongoose.connect(database.getConnectionString(), databaseOptions).then(() => Host.countDocuments({isAdmin: true}, (err, res) => res?(
                inquirer.prompt([{
                    type: "confirm",
                    name: "confirmation",
                    message: "Do you want to create another admin account?",
                    default: false
                }]).then(answer => answer.confirmation?addAdmin():finish())
            ):addAdmin())
        )
    );
});

const addAdmin = () => {
    console.log("\nInsert admin credentials!");
    generateAdminQuestions().then(() => inquirer.prompt(adminQuestions).then(async (answers) => new Host({...answers, password: await hash.generate(answers.password), isAdmin: true}).save().then(finish)));
}

const finish = () => {
    console.log(`\niCheck v${version} configured successfully!`);
    if(process.env.NODE_ENV === "production") await fs.unlink('./setup.js');
    process.exit();
}