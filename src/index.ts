import fs from 'fs/promises';
import dotenv from 'dotenv';
import { SaveData, User, LocalUser, ChatCommand, Command, UniversalCommand, Quote } from './types';
import { AccessToken, RefreshingAuthProvider } from '@twurple/auth';
import { PubSubClient } from '@twurple/pubsub';
import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { sleep, interpolate, setIntervalImmediately } from './helper';

dotenv.config();

const SAVE_DATA: string = process.env.SAVE_DATA as string;
const botName: string = 'bazbotty';
const scopes: string[] = ['channel_read', 'channel_editor', 'chat:read', 'chat:edit', 'channel:moderate', 'analytics:read:extensions', 'analytics:read:games', 'bits:read', 'channel:edit:commercial', 'channel:manage:broadcast', 'channel:manage:extensions', 'channel:manage:redemptions', 'channel:manage:videos', 'channel:read:editors', 'channel:read:hype_train', 'channel:read:redemptions', 'channel:read:stream_key', 'channel:read:subscriptions', 'clips:edit', 'moderation:read', 'user:edit', 'user:edit:follows', 'user:read:blocked_users', 'user:manage:blocked_users', 'user:read:broadcast', 'user:read:email', 'whispers:read', 'whispers:edit'];

let nameToUser: Map<string, LocalUser> = new Map<string, LocalUser>();
let nameToCommand: Map<string, UniversalCommand> = new Map<string, UniversalCommand>();

//declare universal commands
let commands: UniversalCommand[] = [
    new UniversalCommand('addcom', (channel: string, user: string, prefix: string, params: string[]) => {
        //!addcom <command> <cooldown?> <response>
        if(params.length < 2) {
            return `@${user} usage: ${prefix}addcom <command> <cooldown?> <response> example: ${prefix}addcom test 10 Hello!`;
        }

        //check if the second parameter is a number

        let name: string = params[0];
        let cooldown: number = parseInt(params[1]);
        let response: string = '';

        if(isNaN(cooldown)) {
            cooldown = 0;
            response = params.slice(1).join(' ');
        } else {
            if(params.length < 3) {
                response = params.slice(1).join(' ');
            } else {
                cooldown = parseInt(params[1]);
                response = params.slice(2).join(' ');
            }
        }

        addChatCommand(channel, name, cooldown, response);
        saveUsers();

        return `@${user} added command ${name}!`;
    }, 0, true),
    new UniversalCommand('editcom', (channel: string, user: string, prefix: string, params: string[]) => {
        //!editcom <command> <cooldown?> <response?>

        if(params.length < 2) {
            return `@${user} usage: ${prefix}editcom <command> <cooldown?> <response?> example: ${prefix}editcom test 10 Hello!`;
        }
        let name: string = params[0];
        let cooldown = parseInt(params[1]);
        let response:string = '';
        let chatCommand: ChatCommand | undefined = nameToUser.get(channel)?.nameToChatCommand.get(name);

        if(chatCommand === undefined) {
            return `@${user} command ${name} does not exist!`;
        }

        if(isNaN(parseInt(params[1]))) {
            cooldown = chatCommand.cooldown; 
            response = params.slice(1).join(' ');
        } else {
            if(params.length < 3) {
                response = chatCommand.response;
            } else {
                response = params.slice(2).join(' ');
            }
        }

        addChatCommand(channel, name, cooldown, response);
        saveUsers();

        return `@${user} edited command ${name}!`;
    }, 0, true),
    new UniversalCommand('delcom', (channel: string, user: string, prefix: string, params: string[]) => {
        //!delcom <command>
        if(params.length < 1) {
            return `@${user} usage: ${prefix}delcom <command> example: ${prefix}delcom test`;
        }
        let name: string = params[0];

        delChatCommand(channel, name);
        return `@${user} deleted command ${name}!`;
    }, 0, true),
    new UniversalCommand('blacklist', (channel: string, user: string, prefix: string, params: string[]) => {
        //!blacklist <action: add | remove?> <user> if no action, then will check if user is blacklisted

        if(params.length < 1) {
            return `@${user} usage: ${prefix}blacklist <action: add | remove?> <user> example: ${prefix}blacklist add @bazbotty`;
        }

        let localUser: LocalUser = nameToUser.get(channel)!;
        let userToBlacklist: string = '';

        if(params.length < 2) {
            userToBlacklist = params[0];

            if(userToBlacklist.startsWith('@')) {
                userToBlacklist = userToBlacklist.replace('@', '');
            }
            if(localUser.blacklist.includes(userToBlacklist)) {
                return `@${user} user ${userToBlacklist} is currently blacklisted!`;
            } else {
                return `@${user} user ${userToBlacklist} is not currently blacklisted!`;
            }        
        } else {
            userToBlacklist = params[1];
            switch(params[0]) {
                case 'add':
                    if(localUser.blacklist.includes(userToBlacklist)) {
                        return `@${user} user ${userToBlacklist} is already blacklisted!`;
                    } else {
                        localUser.blacklist.push(userToBlacklist);
                        editUser(channel, localUser);
                        return `@${user} user ${userToBlacklist} has been blacklisted!`;
                    }
                case 'remove':
                    if(localUser.blacklist.includes(userToBlacklist)) {
                        localUser.blacklist.splice(localUser.blacklist.indexOf(userToBlacklist), 1);
                        editUser(channel, localUser);
                        return `@${user} user ${userToBlacklist} has been removed from the blacklist!`;
                    } else {
                        return `@${user} user ${userToBlacklist} is not currently blacklisted!`;
                    }
                default:
                    return `@${user} usage: ${prefix}blacklist <action: add | remove?> <user> example: ${prefix}blacklist add @bazbotty`;
            }
        }
    }, 0, true),
    new UniversalCommand('time', (channel: string, user: string, prefix: string, params: string[]) => {
        //!time
        return `@${user} @${channel}'s current time is: ${new Date().toLocaleString()}`;
    }, 180, false),
    new UniversalCommand('setprefix', (channel: string, user: string, prefix: string, params: string[]) => {
        //!setprefix <prefix>
        if(params.length < 1) {
            return `@${user} usage: ${prefix}setprefix <prefix> example: ${prefix}setprefix !`;
        }
        let newPrefix: string = params[0];
        
        if(newPrefix === prefix) {
            return `@${user} the new prefix is the same as the old one!`;
        }

        let localUser: LocalUser = nameToUser.get(channel)!;
        localUser.prefix = newPrefix;

        editUser(channel, localUser);
        
        return `@${user} changed prefix to ${newPrefix}`;
    }, 0, true),
    new UniversalCommand('help', (channel: string, user: string, prefix: string, params: string[]) => {
        //!help
        let commands: string[] = [];
        for(let [key, value] of nameToCommand) {
            commands.push(key);
        }
        for(let [key, value] of nameToUser.get(channel)?.nameToChatCommand!) {
            commands.push(key);
        }
        if(commands.length > 0) {
            return `@${user} commands: ${prefix}${commands.join(`, ${prefix}`)}`;
        }
        return null;
    }, 270, false),
    new UniversalCommand('ping', (channel: string, user: string, prefix: string, params: string[]) => {
        //!ping
        return `@${user} pong!`;
    }, 600, false),
    //action: add, delete (mod), nothing (random quote)
    // new UniversalCommand('quote', (channel: string, user: string, prefix: string, params: string[]) => {
    //     //!quote <add? | delete?> <"quote"? | quoteID?>
    //     if(params.length < 1) {
    //         //get random quote
    //         let quotes: Quote[] = nameToUser.get(channel)!.quotes;
    //         let quote: Quote = quotes[Math.floor(Math.random() * quotes.length)];

    //         return `@${user} ${quote.quote} - ${quote.author}`;
    //     }
    //     let action: string = params[0];
    //     let quote: string = params.slice(1).join(' ');

    //     if(action === 'add') {
];

let pubSubClient: PubSubClient = new PubSubClient();
let chatClient: ChatClient;

async function startup() {

    commands.forEach((command: UniversalCommand) => {
        nameToCommand.set(command.name, command);
    });

    await initSaveData();

    chatClient = new ChatClient({ authProvider: await refreshAuthToken(botName), 
        channels: Array.from(nameToUser.keys()) });
    
    await chatClient.connect();

    //sleep for 1 second to allow time for the bot to connect to chat
    await sleep(1000);

    //schedule the update of the mod and vip lists every 10 minutes
    setIntervalImmediately(async () => {
        for(let [key, value] of nameToUser) {
            updateModList(value);
            updateVipList(value);
        }

        await saveUsers();

    }, 600000);

    await saveUsers();

    createChatListeners();
}

async function updateModList(user: LocalUser) {
    let modList: string[] = await chatClient.getMods(user.username);
    user.modList = modList;
}
async function updateVipList(user: LocalUser) {
    let vipList: string[] = await chatClient.getVips(user.username);
    user.vipList = vipList;
}

function createChatListeners() {
    chatClient.onMessage((channel: string, username: string, message: string) => {

        channel = channel.replace('#', '')
        let user: LocalUser | undefined = nameToUser.get(channel);

        if(user === undefined) return;
        if(user.blacklist.includes(username)) return;

        if(!message.startsWith(user.prefix)) return;


        let commandName: string = message.split(' ')[0].substring(user.prefix.length).toLowerCase();
        let params: string[] = message.split(' ').slice(1);

        let command;
        let cooldown;
        let lastUsed;

        //check if universal commands has the command, and if so, execute it
        if(nameToCommand.has(commandName)) {
            let command: UniversalCommand = nameToCommand.get(commandName)!;
            cooldown = command.cooldown;
            lastUsed = command.lastUsed;

            if(command.modOnly && checkIfMod(channel, username)) {
                chatClient.say(channel, `@${username} you do not have permission to use this command!`);
                return;
            }
            if(Date.now() - lastUsed < cooldown && !checkIfMod(channel, username) && !checkIfVip(channel, username)) {
                chatClient.say(channel, `@${username} you must wait ${cooldown / 1000} seconds before using this command again!`);
                return;
            }
            
            let response: string | null = command.action(channel, username, user.prefix, params);
            if(response) {
                chatClient.say(channel, response);
            }
        } else {
            command = user.nameToChatCommand.get(commandName);

            if(!command) {
                chatClient.say(channel, `@${username} command not found!`);
                return;
            }

            user.nameToChatCommand.get(message.split(' ')[0].slice(user.prefix.length))!.lastUsed = Date.now();
            chatClient.say(channel, interpolate(command.response, channel, username));
        }
        
    });
}

function handleChatCommand(channel: string, username: string, message: string) {
    let user = nameToUser.get(channel);
    if(user === undefined) return;

    if(!message.startsWith(user.prefix)) return;

    let command = user.nameToChatCommand.get(message.split(' ')[0].slice(user.prefix.length));
    if(command === undefined) return;

    
}

function checkIfMod(channel: string, username: string): boolean {
    return nameToUser.get(channel)!.modList.indexOf(username) !== -1;
}
function checkIfVip(channel: string, username: string): boolean {
    return nameToUser.get(channel)!.vipList.indexOf(username) !== -1;
}

//first time parse of save data, and set up the map
async function initSaveData() {
    let saveData: SaveData = await readSaveData();

    for(let user of saveData.users) {
        await addUser(user);
    }

}

async function addUser(user?: User) {

    if(user === undefined) return;
    let username = user.username;

    let authProvider: RefreshingAuthProvider = await refreshAuthToken(username);

    let localUser: LocalUser = {
        username: username,
        prefix: user.prefix,
        blacklist: user.blacklist,
        quotes: user.quotes,
        modList: [],
        vipList: [],
        authProvider: authProvider,
        pubSubClientID: await pubSubClient.registerUserListener(authProvider),
        apiClient: new ApiClient({ authProvider: authProvider }),
        nameToChatCommand: new Map<string, ChatCommand>()
    };
    
    nameToUser.set(username, localUser);
    
    user.chatCommands.forEach((command: Command) => {
        addChatCommand(username, command.name, command.cooldown, command.message);
    });

    chatClient = new ChatClient({ authProvider: await refreshAuthToken(botName), 
        channels: Array.from(nameToUser.keys()) });
}

async function editUser(username: string, user: LocalUser) {
    nameToUser.set(username, user);
    await saveUsers();
}

async function removeUser(username: string) {
    nameToUser.delete(username);
    await saveUsers();
}

function addChatCommand(channel: string, name: string, cooldown: number, response: string) {
    let chatCommand = new ChatCommand(name, cooldown, response);
    nameToUser.get(channel)?.nameToChatCommand.set(name, chatCommand);
}

function delChatCommand(username: string, name: string) {
    nameToUser.get(username)?.nameToChatCommand.delete(name);
}

//saves all users in local memory
async function saveUsers() {
     
    let saveData: SaveData = await readSaveData();

    let users: User[] = [];

    for(let user of nameToUser.values()) {
        let chatCommands: Command[] = [];

        Array.from(user.nameToChatCommand.values()).forEach((chatCommand: ChatCommand) => {
            chatCommands.push({
                name: chatCommand.name,
                cooldown: chatCommand.cooldown,
                message: chatCommand.response,
            });
        });

        users.push({
            username: user.username,
            prefix: user.prefix,
            blacklist: user.blacklist,
            quotes: user.quotes,
            chatCommands: chatCommands,
            token: (await user.authProvider.getAccessToken())!,           
        });
    }

    saveData.users = users;
    await writeToSaveFile(saveData);
}

async function readSaveData(): Promise<SaveData> {
    let data = await fs.readFile(SAVE_DATA, 'utf-8');
    return JSON.parse(data);
}

async function writeToSaveFile(saveData: SaveData) {
    await fs.writeFile(SAVE_DATA, JSON.stringify(saveData), 'utf-8');
}

/*creates a refreshing auth token for the user to use. in the case that an auth provider would expire
while the bot is running, the refreshing auth provider will create another, valid, refr. auth provider */
async function refreshAuthToken(userID: string): Promise<RefreshingAuthProvider> {

    //getting Token Data, as well as App Client ID and Secret
    let saveData = await readSaveData();
    let appID = process.env.APP_ID as string;
    let appSecret = process.env.APP_SECRET as string;


    //declares the initial token to be given in the RefreshingAuthProvider 
    let initialToken: AccessToken;
    let onRefresh: ((token: AccessToken) => void);

    if(userID !== botName) {
        let indexOfUser = saveData.users.findIndex((user: User) => userID === user.username);
        initialToken = saveData.users[indexOfUser].token;
        onRefresh = async newTokenData => {
            let saveData = await readSaveData();

            let indexOfUser = saveData.users.findIndex((user: User) => userID === user.username);

            //if not -1
            if(~indexOfUser) saveData.users[indexOfUser].token = newTokenData;
            
            await writeToSaveFile(saveData);
        }
    } else {
        initialToken = saveData.bot.token;
        onRefresh = async newTokenData => {
            let saveData = await readSaveData();

            saveData.bot.token = newTokenData;

            await writeToSaveFile(saveData);
        }
    }

    return new RefreshingAuthProvider({
        clientId: appID,
        clientSecret: appSecret,
        onRefresh,
    }, initialToken);
} 

startup();