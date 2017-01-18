var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");

module.exports = {
    Label: 'Ask name',
    Dialog: [
        function (session) {
            builder.Prompts.text(session, 'Wie lautet Ihre Name?');
        },
        function (session, results) {
            if (results.response) {
                session.privateConversationData.username = results.response;
                session.endDialog("Hallo %s, es freut mich dass Sie den USR III Chatbot nutzen.", session.privateConversationData.username);
            }
        }
    ]
}
