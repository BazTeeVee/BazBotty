import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { PubSubClient } from '@twurple/pubsub';
import { TokenData, User, Command, ChatCommand } from './types';

const fs = require('fs').promises;
const express = require('express');
const app = express();

const TOKEN_FILE = './data/tokens.json';
const SAVE_DATA = './data/save_data.json';

const prefix = '!';

// let botAPIClient: ApiClient;
let userAPIClient: ApiClient;
let chatClient: ChatClient;
let pubSubClient: PubSubClient;
let pubSubClientID: string;
let clientID: string;
let botName: string = 'bazbotty';
let channelName: string = 'too_athena';
let channels: string[] = [channelName];

const channelID: string = '115284060';

const adTimeID: string = 'f5ebe547-3ec5-4025-a4bb-611c5d837d26';

let modList: string[] = [];
let vipList: string[] = [];

type CommandType = ChatCommand | Command | undefined;
type AuthProvider = Promise<RefreshingAuthProvider> | RefreshingAuthProvider;

//TODO: Make bot available for multiple users***
//TODO: Clip hotkey, chat box on screen, pubsub, other commands

let scope = ['channel_read', 'channel_editor', 'chat:read', 'chat:edit', 'channel:moderate', 'analytics:read:extensions', 'analytics:read:games', 'bits:read', 'channel:edit:commercial', 'channel:manage:broadcast', 'channel:manage:extensions', 'channel:manage:redemptions', 'channel:manage:videos', 'channel:read:editors', 'channel:read:hype_train', 'channel:read:redemptions', 'channel:read:stream_key', 'channel:read:subscriptions', 'clips:edit', 'moderation:read', 'user:edit', 'user:edit:follows', 'user:read:blocked_users', 'user:manage:blocked_users', 'user:read:broadcast', 'user:read:email', 'whispers:read', 'whispers:edit'];

async function startup() {

    //Auth Providers for both the bot and user
    let botAuthProvider: AuthProvider = await refreshAuthToken(botName, scope);
    let userAuthProvider: AuthProvider = await refreshAuthToken(channelName, scope);

    clientID = (await userAuthProvider).clientId;
    
    
    //Instantiating a new PubSubClient
    pubSubClient = new PubSubClient();
    
    //Getting the values of both auth providers to use in instantiating API Clients
    botAuthProvider = await botAuthProvider;
    userAuthProvider = await userAuthProvider;
    
    //Creating both the API Clients and Chat Clients
    // botAPIClient = new ApiClient({ authProvider: botAuthProvider });
    userAPIClient = new ApiClient({ authProvider: userAuthProvider });
    chatClient = new ChatClient({ channels, authProvider: botAuthProvider});
    
    //Getting the numerical ID for the user (streamer) channel
    pubSubClientID = await pubSubClient.registerUserListener(userAuthProvider);
    
    await chatClient.connect();
    
    await Command.initialise(chatClient, channelName, userAPIClient);
    
    createPubSubListeners();
    
    updateModsAndVIPs();
    
    chatClient.onMessage(handleCommand);
}

// Set up listeners to listen to PubSub events
// TODO: MAKE SURE THIS WORKS :)
async function createPubSubListeners() {

     await pubSubClient.onRedemption(pubSubClientID, (reward) => {
        if(reward.id === adTimeID) {

            setTimeout(() => userAPIClient.channels.startChannelCommercial(channelID, 60), 5000);
            
        }
    });

    
}

function handleCommand(channel: string, user: string, message: string) {

    //If message doesn't start with our prefix, we want nothing to do with it
    if(message.substring(0, prefix.length) !== prefix) return;

    message = message.substring(prefix.length);

    //Splits message into different words
    let messageArr: string[] = message.split(' ');
    let messagePrefix = messageArr[0].toLowerCase();
    messageArr.shift();

    let command: CommandType = ChatCommand.chatCommands.get(messagePrefix);

    if(command === undefined) {
        command = Command.commands.get(messagePrefix);
        if(command === undefined) {
            chatClient.say(channel, `@${user} That command does not exist!`);
            return;
        }
    }
        
    let timeTilCooldown = Math.floor(command.cooldownEnd - (Date.now() / 1000));
    

    if(command.modCommand && hasPerms(user, 'mod')) {
        chatClient.say(channel, `@${user} You do not have permission to use this command!`);
        return;
    }
    
    if(hasPerms(user)) {
        if("message" in command) chatClient.say(channel, command.message); 
        else command.action(messageArr, user, modList);
        if(timeTilCooldown <= 0) command.updateCooldownTime();
        return;
    }

    if(timeTilCooldown > 0) {
        chatClient.say(channel, `@${user} that command is on cooldown for ${timeTilCooldown} seconds`);
        return;
    }

    if("message" in command) chatClient.say(channel, command.message); 
    else command.action(messageArr, user, modList);
    command.updateCooldownTime();

}

startup();

function hasPerms(user: string, perm?: 'mod' | 'vip') {
    if(perm == 'mod') return modList.includes(user) || user == channelName; 
    if(perm == 'vip') return vipList.includes(user);
    return modList.includes(user) || user == channelName || vipList.includes(user);
}

//action: add, delete (mod), nothing (random quote)
async function quote(action: string) {

    let quoteData = await JSON.parse(fs.readFile(SAVE_DATA, 'UTF-8')).quotes;
    

}


async function refreshAuthToken(userID: string, scopes: string[]) {

    //Getting Token Data, as well as App Client ID and Secret
    let tokenData = JSON.parse(await fs.readFile(TOKEN_FILE, 'UTF-8'));
    let clientId = tokenData.app.ID;
    let clientSecret = tokenData.app.secret;

    //Get's the user and said tokens / info
    let user: User = getUser(userID, tokenData);
    if(user == null) throw Error('Null User: ' + userID);

    //AuthProvider ✨Fuckery✨
    return new RefreshingAuthProvider({
		clientId,
		clientSecret,
		onRefresh: async newTokenData => {
            if(userID === botName) {
                tokenData.bot = newTokenData;
            } else {
                tokenData.user = newTokenData;
            }
            await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 4), 'UTF-8') 
        }
	}, user);
}


function getUser(userID: string, tokenData: TokenData): User {
    let user: User;

    //If the user is the bot
    if(userID === botName) user = tokenData.bot;
    //Otherwise if it's the user
    else user = tokenData.user;
    return user;
}

function updateModsAndVIPs() {
    chatClient.getMods(channelName).then(listOfMods => modList = listOfMods);
    chatClient.getVips(channelName).then(listOfVIPs => vipList = listOfVIPs);
}