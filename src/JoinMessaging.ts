import Discord = require("discord.js");
import fs = require("fs");

import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { GuildMember } from "discord.js";
import CommandController from "./CommandController";

export default class JoinMessaging {
    private bot: Discord.Client;
    private sharedSettings: SharedSettings;
    private messageContents: string;
    private commandContents: string;
    private commandController: CommandController;

    constructor(bot: Discord.Client, sharedSettings: SharedSettings, commandController: CommandController) {
        console.log("Requested join message extension..");

        this.sharedSettings = sharedSettings;
        console.log("Successfully loaded join message settings.");

        this.commandController = commandController;

        this.bot = bot;
        this.bot.on("ready", this.onBot.bind(this));
    }

    onBot() {

        try {
            this.messageContents = fs.readFileSync(this.sharedSettings.onJoin.messageFile, "utf8").toString();
            this.commandContents = this.commandController.getHelp();

            this.bot.on("guildMemberAdd", function(user: GuildMember) {
                user.send(this.messageContents);
                user.send(this.commandContents);
            }.bind(this));

            console.log("Join message extension loaded.");
        }
        catch (e) {
            console.error("Something went wrong loading the message for new users: " + e.toString());
        }
    }

    public onWelcome(message: Discord.Message, isAdmin: boolean, command: string, args: string[]) {

        message.channel.send(this.messageContents);
        message.channel.send(this.commandContents);
    }
}
