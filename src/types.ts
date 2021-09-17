import { ChatClient } from '@twurple/chat';
import { ApiClient, HelixChannel, UserIdResolvable } from '@twurple/api';

const fs = require('fs').promises;
const SAVE_DATA = './data/save_data.json'
const prefix = '!';


interface TokenData {
    bot: User,
    app: App,
    user: User,
}

interface User {
    ID: string,
    refreshToken: string,
    accessToken: string,
    expiresIn: number,
    obtainmentTimestamp: number
}

interface App {
    ID: string,
    secret: string,
}

class BasicCommand {
    name: string;
    cooldown: number;
    cooldownEnd: number;
    modCommand: boolean = false;

    constructor(name: string, cooldown: number, modCommand?: boolean) {
        this.name = name;
        this.cooldown = cooldown;
        this.cooldownEnd = (Date.now() / 1000);
        if(modCommand != undefined) this.modCommand = modCommand;
    }

    updateCooldownTime() {
        this.cooldownEnd = (Date.now() / 1000) + this.cooldown;
        return this.cooldownEnd;
    }

}


class Command extends BasicCommand {
    action: Function;

    constructor(name: string, action: Function, cooldown: number, modCommand?: boolean) {
        super(name, cooldown, modCommand);
        this.action = action;
    }

    static async initialise(chatClient: ChatClient, channelName: string, userAPIClient: ApiClient) {
        Command.chatClient = chatClient;
        Command.channelName = channelName;
        Command.userApiClient = userAPIClient;

        await ChatCommand.initialise();
       
        const time = new Command('time', (messageArr: string[], user: string) => {
            let dateString: string = new Date().toLocaleTimeString();
            chatClient.say(channelName, `athena's current time is ${dateString} (Eastern Standard Time)`);
        }, 300);
        
        const title = new Command('title', async (messageArr: string[], user: string, modsList: string) => {
            
            let channel: HelixChannel | null = await userAPIClient.channels.getChannelInfo('115284060');
            if(channel == null) {
                return;
            }
            
            if(messageArr.length === 0) {
                chatClient.say(channelName, channel.title); return;
            }
            let title: string = messageArr.join(' ');

            if(modsList.includes(user)) {
                userAPIClient.channels.updateChannelInfo( 'too_athena', { title } );
                chatClient.say(channelName, `@${user}, Successfully changed title! ${title}`); return;
            } else {
                chatClient.say(channelName, `@${user}, you do not have the permission to change the title!`);
            }
        }, 300);

        const addCom = new Command('addcom', (messageArr: string[], user: string) => {

            let name: string = messageArr[0].toLowerCase();

            messageArr.shift();
            let message: string = messageArr.join(' ');
            
            let cooldown: number = 300;

            if(name.substring(0, prefix.length) === prefix) {
                name = name.substring(prefix.length);
            }

            if(ChatCommand.chatCommands.get(name) !== undefined) {
                chatClient.say(channelName, `@${user} That command already exists!`);
                return;
            }

            if(messageArr.length < 1) {
                chatClient.say(channelName, `@${user} missing arguments! (${prefix}addcom [command] [chat message])`);
                return;
            }

            let newChatCommand = new ChatCommand(name, message, cooldown);

            ChatCommand.chatCommands.set(name, newChatCommand);

            chatClient.say(channelName, `Successfully added command! ${prefix}${name}`);

            ChatCommand.saveData();
            
        }, 0, true);

        const editCom = new Command('editcom', (messageArr: string[], user: string) => {

            let name: string = messageArr[0].toLowerCase();   
            
            if(name.substring(0, prefix.length) === prefix) {
                name = name.substring(prefix.length);
            }

            messageArr.shift();
            let message: string = messageArr.join(' ');

            let command: ChatCommand | undefined = ChatCommand.chatCommands.get(name);

            if(command === undefined) {
                chatClient.say(channelName, `@${user} that command does not exist!`);
                return;
            }

            if(messageArr.length < 1) {
                chatClient.say(channelName, `@${user} missing arguments! (${prefix}editcom [command] [chat message])`);
                return;
            }

            command.message = message;

            ChatCommand.chatCommands.set(name, command);
            
            chatClient.say(channelName, `@${user}, Successfully edited command! ${prefix}${name}`);

            ChatCommand.saveData();

        }, 0, true);

        const delCom = new Command('delcom', (messageArr: string[], user: string) => {

            let name: string = messageArr[0].toLowerCase();

            if(name.substring(0, prefix.length) === prefix) {
                name = name.substring(prefix.length);
            }

            let command: ChatCommand | undefined = ChatCommand.chatCommands.get(name);

            if(command === undefined) {
                chatClient.say(channelName, `@${user} that command does not exist!`);
                return;
            }

            ChatCommand.chatCommands.delete(name);

            chatClient.say(channelName, 'Successfully deleted the command!');

            ChatCommand.saveData();

        }, 0, true);

        Command.commands.set('time', time);
        Command.commands.set('addcom', addCom);
        Command.commands.set('editcom', editCom);
        Command.commands.set('delcom', delCom);
        Command.commands.set('title', title);

    }
    
    static commands: Map<string, Command> = new Map<string, Command>();
    static chatClient: ChatClient;
    static channelName: string;
    static userApiClient: ApiClient;
}

class ChatCommand extends BasicCommand {
    message: string;

    constructor(name: string, message: string, cooldown: number) {
        super(name, cooldown);
        this.message = message;   
    }

    static async initialise() {
        let object = JSON.parse(await fs.readFile(SAVE_DATA, 'UTF-8')).chatCommands;

        object.forEach((command: ChatCommand) => {
            let chatCommand = new ChatCommand(command.name, command.message, command.cooldown);
            ChatCommand.chatCommands.set(chatCommand.name, chatCommand);
        });
        
    }

    static async saveData() {
        let object = JSON.parse(await fs.readFile(SAVE_DATA, 'UTF-8'));

        
        let commandList: any[] = [];

        Array.from(this.chatCommands.values()).forEach((command: ChatCommand) => {
            let newCommand = {
                name: command.name,
                message: command.message,
                cooldown: command.cooldown,
            };
            commandList.push(newCommand);
        });
        
        object.chatCommands = commandList;

        await fs.writeFile(SAVE_DATA, JSON.stringify(object));
    }

    static chatCommands: Map<string, ChatCommand> = new Map<string, ChatCommand>();
}


export { TokenData, User, App, Command, ChatCommand };