const { ApiClient, StaticAuthProvider, ClientCredentialsAuthProvider } = require('twitch');
const { ChatClient } = require('twitch-chat-client');

const clientID = 'bazbotty';
const accessToken = 'wyufobzkt3ztyxt3pmstu3r8c55roi';
const channelID = 'justcallmebaz_'

var authProvider;
var apiClient;
var chatClient;

//TODO: Clip hotkey, chat box on screen, pubsub, other commands
//WANT_TODO: Refresh authentication n shit

async function startup() {
    authProvider = new StaticAuthProvider(clientID, accessToken, ['channel_editor', 'chat:read', 'chat:edit']);
    apiClient = new ApiClient({ authProvider });
    chatClient = new ChatClient(apiClient, { channels: [channelID] });

    await chatClient.connect().then(await sleep(1000));

    chatClient.onMessage((channel, user, message) => {
        console.log(channel + " | " + message);
        chatClient.say(channelID, "Hello!");
    });
    
    //await chatClient.host(channelID, 'tomshiii');

}

startup();


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
