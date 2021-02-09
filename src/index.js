const { ApiClient } = require('twitch');
const { ChatClient } = require('twitch-chat-client');
const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { PubSubClient } = require('twitch-pubsub-client');
const fs = require('fs').promises;
const app = require('express')();

const SAVE_FILE = './src/data/tokens.json';

let botAPIClient;
let userAPIClient;
let chatClient;
let pubSubClient;

//TODO: Clip hotkey, chat box on screen, pubsub, other commands
//WANT_TODO: Refresh authentication n shit

let scope = ['chat:read', 'chat:edit', 'channel:moderate', 'analytics:read:extensions', 'analytics:read:games', 'bits:read', 'channel:edit:commercial', 'channel:manage:broadcast', 'channel:manage:extensions', 'channel:manage:redemptions', 'channel:manage:videos', 'channel:read:editors', 'channel:read:hype_train', 'channel:read:redemptions', 'channel:read:stream_key', 'channel:read:subscriptions', 'clips:edit', 'moderation:read', 'user:edit', 'user:edit:follows', 'user:read:blocked_users', 'user:manage:blocked_users', 'user:read:broadcast', 'user:read:email', 'whispers:read', 'whispers:edit'];

app.get('/login', (req, res) => {
    res.redirect('https://id.twitch.tv/oauth2/authorize?client_id=tbypuo33r1kyw15ohut7f4rqhkht2a&redirect_uri=http://localhost:8080&response_type=code&scope=chat:read%20chat:edit%20channel:moderate%20analytics:read:extensions%20analytics:read:games%20bits:read%20channel:edit:commercial%20channel:manage:broadcast%20channel:manage:extensions%20channel:manage:redemptions%20channel:manage:videos%20channel:read:editors%20channel:read:hype_train%20channel:read:redemptions%20channel:read:stream_key%20channel:read:subscriptions%20clips:edit%20moderation:read%20user:edit%20user:edit:follows%20user:read:blocked_users%20user:manage:blocked_users%20user:read:broadcast%20user:read:email%20whispers:read%20whispers:edit');
});

app.listen(8080);


async function startup() {

    //Auth Providers for both the bot and user
    let botAuthProvider = refreshAuthToken('bazbotty', scope);
    let userAuthProvider = refreshAuthToken('justcallmebaz', scope);

    //Instantiating a new PubSubClient
    pubSubClient = new PubSubClient();

    //Getting the values of both auth providers to use in instantiating API Clients
    botAuthProvider = await botAuthProvider;
    userAuthProvider = await userAuthProvider;

    //Creating both the API Clients and Chat Clients
    botAPIClient = new ApiClient({ authProvider: botAuthProvider });
    userAPIClient = new ApiClient({ authProvider: userAuthProvider });
    chatClient = new ChatClient(botAPIClient, { channels: ['justcallmebaz_'] });


    await chatClient.connect().then(await sleep(1000));

    //await chatClient.host(channelID, 'turntmosfet');

    
    createPubSubListeners();
}

//Set up listeners to listen to PubSub events
async function createPubSubListeners() {
    //Getting the numerical ID for the user (streamer) channel
    let channelID = await pubSubClient.registerUserListener(userAPIClient);

    
    await pubSubClient.onRedemption(channelID, (message) => {
        console.log(message.rewardName);
    });
}

startup();



//TODO
async function refreshAuthToken(userID, scopes) {

    //Getting Token Data, as well as App Client ID and Secret
    let tokenData = JSON.parse(await fs.readFile(SAVE_FILE, 'UTF-8'));
    let clientID = tokenData["app"]["ID"];
    let clientSecret = tokenData["app"]["secret"];

    //Get's the user and said tokens / info
    let user = getUser(userID, tokenData);
    if (user === null) throw error("Null User: " + userID);
    let accessToken = user["accessToken"];
    let refreshToken = user["refreshToken"];

    //AuthProvider ✨Fuckery✨
    let rtnVal = new RefreshableAuthProvider(new StaticAuthProvider(clientID, accessToken, scopes),
        {
            clientSecret,
            refreshToken,
            onRefresh: (token) => {
                user["accessToken"] = token.accessToken;
                user["refreshToken"] = token.refreshToken;
                user["expiryTimestamp"] = token.expiryDate;

                if (tokenData["bot"]["ID"] === userID) {
                    tokenData["bot"] = user;
                } else {
                    tokenData["channels"] = user;
                }
                fs.writeFile(SAVE_FILE, JSON.stringify(tokenData));
            }
        });

    return rtnVal;
}


function getUser(userID, tokenData) {
    //If the user is the bot
    if (tokenData["bot"]["ID"] === userID) tokenData = tokenData["bot"];
    //Otherwise if it's the user
    else tokenData = tokenData["user"];
    return tokenData;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
