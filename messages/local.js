// This loads the environment variables from the .env file
require('dotenv-extended').load();

var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var azure = require('azure-storage');
//var restify = require("restify");
var didYouMean = require("didyoumean2");
var qnadict = require('./dictionaries/qnadict');
var usr3questions = require('./dictionaries/usr3questions');

// Azure Table Storage
var tableName = 'TaxBotStore';
var tableSvc = azure.createTableService();
// tableSvc.deleteTable(tableName, function(error, result, response){
//   if(!error){
//     // Table exists or created
//   }
// });
tableSvc.createTableIfNotExists(tableName, function(error, result, response){
  if(!error){
    // Table exists or created
  }
});

var entGen = azure.TableUtilities.entityGenerator;
//var azureTableClient = new botbuilder_azure.AzureTableClient(tableName);
//var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Set up restify server
// var server = restify.createServer();
// server.listen(process.env.port || process.env.PORT || 3978, function(){
//     console.log('%s listening to %s', server.name, server.url);
// });

// Create bot 
var connector = new builder.ConsoleConnector().listen();
// var connector = new builder.ChatConnector({
//     appId: process.env.MICROSOFT_APP_ID,
//     appPassword: process.env.MICROSOFT_APP_PASSWORD
// });
var bot = new builder.UniversalBot(connector);
//server.post('/api/messages', connector.listen());

// Configure bots default locale and locale folder path.
bot.set('localizerSettings', {
    botLocalePath: "./locale", 
    defaultLocale: "de" 
});

// Store data in an online NoSQL database
//bot.set('storage', tableStorage);

// Create LUIS recognizer that points at our model and add it as the root '/' dialog for our Cortana Bot.
var model = process.env.LUIS_MODEL;
var recognizer = new builder.LuisRecognizer(model);

// Dialogs
var di_askGenericYesNo = require('./dialogs/askGenericYesNo');
var di_askName = require('./dialogs/askName');
var di_askContactNames = require('./dialogs/askContactNames');
var di_askTelephone = require('./dialogs/askTelephone');
var di_askEmail = require('./dialogs/askEmail');
var di_askCanton = require('./dialogs/askCanton');
var di_closeContactForm = require('./dialogs/closeContactForm');
var di_greetUser = require('./dialogs/greetUser');

// Setup dialogs
var intents = new builder.IntentDialog({ recognizers: [recognizer] })
//Starting a new conversation will trigger this message
bot.on('conversationUpdate', 
    function (message) {
        if (message.membersAdded) {
            message.membersAdded.forEach((identity) => {
            if (identity.id === message.address.bot.id) {
                var instructions = 'Grüezi! Ich bin der KPMG Virtual Tax Advisor, der USR III Chatbot.';
                var reply = new builder.Message()
                    .address(message.address)
                    .text(instructions);
                bot.send(reply);
//                bot.beginDialog(message.address, '/'); 
            }
            });
        }
    }
);

bot.dialog('/askGenericYesNo', di_askGenericYesNo.Dialog);
bot.dialog('/askName', di_askName.Dialog);
bot.dialog('/askContactNames', di_askContactNames.Dialog);
bot.dialog('/askTelephone', di_askTelephone.Dialog);
bot.dialog('/askEmail', di_askEmail.Dialog);
bot.dialog('/askCanton', di_askCanton.Dialog);
bot.dialog('/closeContactForm', di_closeContactForm.Dialog);
bot.dialog('/greetUser', di_greetUser.Dialog);

intents.onBegin(function (session) {
    session.privateConversationData.familyname = "";
    session.privateConversationData.firstname = "";
    session.privateConversationData.company = "";
    session.privateConversationData.position = "";
    session.privateConversationData.email = "";
    session.privateConversationData.telephone = "";
    session.privateConversationData.callTimes = "";
    session.privateConversationData.other = "";
    session.privateConversationData.canton = "";
    session.privateConversationData.usr3questions = {};
    console.log(session.message);
    session.beginDialog('/askName');
});

bot.dialog('/inspectMessage', [
    function (session, args) {
        console.log('these are my arguments:');
        console.log(args);
    }
]);

bot.dialog('/EffectsOfUSR3Reply', [
    function (session, args) {
        session.send('Smart expert reply triggered:');
        session.send(args.answer);
        session.endDialog();
    }
]);

bot.dialog('/contactForm', [
    function (session) {
        session.beginDialog('/askContactNames');
    },
    function (session, results) {
        if (results) {
            if (results.entity=='Telefon') {
                session.beginDialog('/askTelephone');
            } else if (results.entity=='Email') {
                session.beginDialog('/askEmail');
            }
        }
    },
    function (session) {
        session.beginDialog('/closeContactForm');
    },
    function(session){
        row = {
            PartitionKey: entGen.String(session.message.user.id),
            RowKey: entGen.String(session.message.address.conversation.id),
            familyname: entGen.String(session.privateConversationData.familyname),
            firstname: entGen.String(session.privateConversationData.firstname),
            compary: entGen.String(session.privateConversationData.company),
            position: entGen.String(session.privateConversationData.position),
            email: entGen.String(session.privateConversationData.email),
            telephone: entGen.String(session.privateConversationData.telephone),
            callTimes: entGen.String(session.privateConversationData.callTimes),
            other: entGen.String(session.privateConversationData.other),
            canton: entGen.String(session.privateConversationData.canton),
            holding: entGen.String(session.privateConversationData.usr3questions.holding),
            stilleReserven: entGen.String(session.privateConversationData.usr3questions.stilleReserven),
            patents: entGen.String(session.privateConversationData.usr3questions.patents),
            IP_CH: entGen.String(session.privateConversationData.usr3questions.IP_CH),
            eigenfinanzierung: entGen.String(session.privateConversationData.usr3questions.eigenfinanzierung),
            FE_CH: entGen.String(session.privateConversationData.usr3questions.FE_CH),
            IP_Foreign3rdParty: entGen.String(session.privateConversationData.usr3questions.IP_Foreign3rdParty),
            vermoegen: entGen.String(session.privateConversationData.usr3questions.vermoegen)
        };
        tableSvc.insertEntity(tableName, row, function (error, result, response) {
            if(!error){
                // Entity inserted
                console.log("Successfully inserted contact details");
            } else {
                console.log("Could not insert contact details");
            }
        });
    }
]);

intents.matches(/^version/i, function (session) {
    session.send('Bot version 0.1');
});


intents.matches(/^generic/i, [
    function (session) {
        session.beginDialog('/askGenericYesNo', {prompt: "A generic question?"});
    }, 
    function (session, results) {
        if (results) {
            session.send("You answered %s", results.entity);
        }
    }
]);

intents.matches(/^contactForm/i, function (session) {
    session.beginDialog('/contactForm');
});

intents.matches(/^user/i, function (session) {
    session.send('You are %s.', session.privateConversationData.username);
});

intents.matches('Greet', function (session, args) {
    session.beginDialog('/greetUser', {entities:args.entities});
});

intents.matches('QnA', [
    function (session, args) {
        var topic = builder.EntityRecognizer.findEntity(args.entities, 'Topic');
        console.log(topic);
        var keys = Object.keys(qnadict);
        var bestMatch = didYouMean(topic.entity, keys);
        console.log(bestMatch);
        session.send('Sie möchten wissen was %s meint? Moment bitte, ich suche ein Antwort führ Sie.', bestMatch);
        session.send(qnadict[bestMatch]);
    }
]);

// Trigger example: Welche auswirkungen hat die USRIII auf mein Unternehmen
intents.matches('EffectsOfUSR3', [
    function (session, next) {
        if (!session.privateConversationData.canton) {
            session.beginDialog('/askCanton');
        } else {
            next();
        }
    },
    function (session, next) {
        session.privateConversationData.currentQuestionKey = "holding";
        if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
            session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
        } else { 
            next();
        }
    },
    function (session, next) {
        session.privateConversationData.currentQuestionKey = "stilleReserven";
        if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
            session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
        } else { 
            next();
        }
        console.log(session.privateConversationData.usr3questions);
    },
    function (session, next) {
        if (session.privateConversationData.usr3questions.holding && session.privateConversationData.usr3questions.stilleReserven) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "Step-up"});
        } else {
            session.privateConversationData.currentQuestionKey = "patents";
            if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
                session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                    prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
            } else { 
                next();
            }
            console.log(session.privateConversationData.usr3questions);
        }
    },
    function (session, next) {
        if (session.privateConversationData.usr3questions.patents) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "Erleichtung Kapitalsteuer"});
        } else {
            session.privateConversationData.currentQuestionKey = "IP_CH";
            if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
                session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                    prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
            } else { 
                next();
            }
            console.log(session.privateConversationData.usr3questions);
        }
    },
    function (session, next) {
        if (session.privateConversationData.usr3questions.IP_CH) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "Patentbox"});
        } else {
            session.privateConversationData.currentQuestionKey = "IP_Foreign3rdParty";
            if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
                session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                    prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
            } else { 
                next();
            }
            console.log(session.privateConversationData.usr3questions);
        }
    },
    function (session, next) {
        if (session.privateConversationData.usr3questions.IP_Foreign3rdParty) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "Patentbox"});
        } else {
            session.privateConversationData.currentQuestionKey = "FE_CH";
            if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
                session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                    prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
            } else { 
                next();
            }
            console.log(session.privateConversationData.usr3questions);
        }
    },
    function (session, next) {
        if (session.privateConversationData.usr3questions.FE_CH) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "F&E-Mehrfachabzug"});
        } else {
            session.privateConversationData.currentQuestionKey = "eigenfinanzierung";
            if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
                session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                    prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
            } else { 
                next();
            }
            console.log(session.privateConversationData.usr3questions);
        }
    },
    function (session, next) {
        session.privateConversationData.currentQuestionKey = "vermoegen";
        if (!session.privateConversationData.usr3questions[session.privateConversationData.currentQuestionKey]) {
            session.beginDialog('/askGenericYesNo', {key: session.privateConversationData.currentQuestionKey, 
                prompt: usr3questions[session.privateConversationData.currentQuestionKey]});
        } else { 
            next();
        }
        console.log(session.privateConversationData.usr3questions);
    },
    function (session) {
        if (session.privateConversationData.usr3questions.vermoegen) {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "Erleichterung Kapitalsteuer"});
        } else {
            session.replaceDialog('/EffectsOfUSR3Reply', {answer: "NID"});
        }
    }
]);

intents.matches("Help", [
    function (session) {
        session.send('Ob Sie nicht die Terminologie verstehen können Sie mir fragen. Zum Beispiel, "Was ist BEPS" schaut eine Erklärung für "BEPS". "QnA" schaut die Inhaltverzeichnis was ich erklären kann.');
    }
]);

intents.matches(/^qna/i, function (session) {
    session.send('Hier ist meine Inhaltverzeichnis: %s', Object.keys(qnadict));
});

intents.onDefault([(session) => {
        session.send("Dies kann ich Ihnen leider nicht beantworten. Bitte beachten Sie, dass dieser ChatBot auf Fragen zur Unternehmenssteuerreform III (USR III) limitiert ist.");
        builder.Prompts.choice(session, "Darf einer unserer Steuerfachpersonen Sie diesbezüglich kontaktieren?", 
            ['Ja', 'Nein'],
            {retryPrompt: "I verstehe nicht. Bitte antworten 'ja' oder 'nein'."});
    }, 
    function (session, results) {
        if (results.response) {
            if (results.response.entity == 'Ja') {
                session.replaceDialog('/contactForm');
            } else if (results.response.entity == 'Nein') {
                session.endDialog();
            }
        }
    }
]);

bot.dialog('/', intents);    
