const { ApiClient, StaticAuthProvider } = require('twitch');
const { ChatClient } = require('twitch-chat-client');
const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const fs = require('fs');
const http = require('http');

const clientID = 'bazbotty';
const accessToken = 'vrt0zhia3vec1za0hsgbm82e5o59op';
const channelID = 'justcallmebaz_'

let authProvider;
let apiClient;
let chatClient;

//TODO: Clip hotkey, chat box on screen, pubsub, other commands
//WANT_TODO: Refresh authentication n shit

async function startup() {
    /*authProvider = new StaticAuthProvider(clientID, accessToken, 
        ['channel:moderate', 'channel_editor', 'chat:read', 'chat:edit', 'channel:read:redemptions']);*/
    
    authProvider = 
    
    apiClient = new ApiClient({ authProvider });
    chatClient = new ChatClient(apiClient, { channels: [channelID] });

    await chatClient.connect().then(await sleep(1000));

    listener = chatClient.onMessage((channel, user, message) => {
        console.log(user + ": " + message);
        chatClient.say(channelID, "Hello!");
    });


    
    //await chatClient.host(channelID, 'tomshiii');

}

startup();


//TODO
async function refreshAuthToken(userType) {
    let tokenData = JSON.parse(await fs.readFile('./tokens.json', 'UTF-8'));

    tokenData = tokenData[userType];

    let rtnVal = new RefreshableAuthProvider(new StaticAuthProvider(clientID, accessToken),
    {
        clientSecret,
        refreshToken,
        onRefresh: (token) => {

        }
    });
    return rtnVal;
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
