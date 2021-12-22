import { AccessToken, AuthProvider } from "@twurple/auth/";
import { ApiClient } from '@twurple/api';

interface App {
    ID: string,
    secret: string;
}

interface Bot {
    username: string,
    token: AccessToken;
}

interface Registry {
    authProvider: AuthProvider,
    apiClient: ApiClient,
    pubSubClientID: string;
}

interface SaveData {
    bot: Bot,
    users: User[];
}

interface Quote {
    quote: string,
    timestamp: Date,
    author: string;
    quoteID: string;
}
class CommandBase {
    name: string;
    cooldown: number;
    lastUsed: number;

    constructor(name: string, cooldown: number) {
        this.name = name;
        this.cooldown = cooldown;
        this.lastUsed = Date.now();
    }
}

class UniversalCommand extends CommandBase {  
    modOnly: boolean;
    action: (channel: string, user: string, prefix: string, params: string[]) => string | null;

    constructor(name: string, action: (channel: string, user: string, prefix: string, params: string[]) => string | null, 
        cooldown?: number, modOnly?: boolean) {
            if(cooldown === undefined) cooldown = 0;
            if(modOnly === undefined) modOnly = false;

            super(name, cooldown);
            this.action = action;
            this.modOnly = modOnly;
    }
}

class ChatCommand extends CommandBase {
    response: string;

    constructor(name: string, cooldown: number, response: string) {
        super(name, cooldown);
        this.response = response;
    }   
}

interface Command {
    name: string,
    cooldown: number,
    message: string;
}

interface BaseUser {
    username: string,
    prefix: string, 
    quotes: Quote[],
    blacklist: string[];
}

interface User extends BaseUser {
    chatCommands: Command[],
    token: AccessToken;
}

interface LocalUser extends BaseUser, Registry {
    nameToChatCommand: Map<string, ChatCommand>;
    modList: string[];
    vipList: string[];
}

export { App, Bot, UniversalCommand, CommandBase, Command, ChatCommand, SaveData, Quote, User, LocalUser }