import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { clearTimeout, setTimeout } from "timers";

import Discord = require("discord.js");
import prettyMs = require("pretty-ms");
import joinArguments from "./JoinArguments";

class TicketData {

    public dateString: string;
    public reason: string;

    constructor(reason: string) {
        this.reason = reason;
        this.dateString = new Date().toString();
    }

    public getDate() {
        return new Date(this.dateString);
    }
}

class MuteData {

    public muterId: string;
    public unmuteDateString: string;
    public reason: string;

    constructor(muterId: string, reason: string, unmuteDate: Date) {
        this.muterId = muterId;
        this.reason = reason;
        this.unmuteDateString = unmuteDate.toString();
    }

    public getUnmuteDate() {
        return new Date(this.unmuteDateString);
    }

}

class AdminData {

    public tickets: { [userId: string]: TicketData[] };
    public muted: { [userId: string]: MuteData | null; };

    constructor() {
        this.tickets = {};
        this.muted = {};
    }
}

/**
 * Log handler.
 *
 * @export
 * @class Admin
 */
export default class Admin {
    private bot: Discord.Client;
    private adminChannel: Discord.TextChannel | null = null;
    private sharedSettings: SharedSettings;
    private data: AdminData;
    private muteRole: Discord.Role;
    private muteTimers: { [id: string]: NodeJS.Timer } = {};

    constructor(bot: Discord.Client, sharedSettings: SharedSettings, dataFile: string) {
        console.log("Requested Admin extension..");
        this.bot = bot;

        this.sharedSettings = sharedSettings;
        this.data = fileBackedObject<AdminData>(dataFile);

        this.bot.on("ready", this.onBot.bind(this));
    }

    public async onBot() {
        const guild = this.bot.guilds.get(this.sharedSettings.server.guildId);
        if (!guild) {
            console.error(`Admin: Unable to find server with ID: ${this.sharedSettings.server}`);
            return;
        }

        let adminChannel = guild.channels.find("name", this.sharedSettings.server.guruChannel);
        if (!adminChannel) {
            if (this.sharedSettings.botty.isProduction) {
                console.error(`Admin: Unable to find moderators channel!`);
                return;
            }
            else {
                adminChannel = await guild!.createChannel("moderators", "text");
            }
        }

        if (!(adminChannel instanceof Discord.TextChannel)) {
            console.error(`Admin: Unexpected; moderators channel is not a text channel!`);
            return;
        }

        let muteRole: Discord.Role | null = null;
        if (this.sharedSettings.admin.muteRoleId)
            muteRole = guild.roles.find("id", this.sharedSettings.admin.muteRoleId);

        if (!muteRole) {
            muteRole = guild.roles.find("name", this.sharedSettings.admin.muteRoleName);
            if (!muteRole) {
                console.error(`Admin: Unable to find the muted role, creating it!`);
                muteRole = await guild.createRole({name: this.sharedSettings.admin.muteRoleName}, "Missing role used to handle spammers");
            }

            this.sharedSettings.admin.muteRoleId = muteRole.id;
            console.log("Mute role id = " + muteRole.id);
        }

        this.muteRole = muteRole;
        console.log("Updating muted role status for channels");
        guild.channels.forEach(ch => {
            ch.overwritePermissions(muteRole!, {
                ADD_REACTIONS: false,
                SEND_MESSAGES: false,
                SEND_TTS_MESSAGES: false,
                EMBED_LINKS: false,
                ATTACH_FILES: false,
                EXTERNAL_EMOJIS: false,
                CONNECT: false,
                SPEAK: false,
            });
        });

        this.adminChannel = adminChannel as Discord.TextChannel;
        console.log("Admin extension loaded.");

        for (const id in this.data.muted) {
            this.handleMuteData(id);
        }

        this.bot.on("guildMemberAdd", (user: Discord.GuildMember) => {
            this.handleMuteData(user.id);
        });
    }

    public async onMute(message: Discord.Message, isAdmin: boolean, command: string, args: string[], separators: string[]) {

        const reason = joinArguments(args, separators);

        const muteAddedFor = [];
        for (const [id, member] of message.mentions.members) {

            if (this.sharedSettings.commands.adminRoles.some(x => member.roles.has(x)))
                continue;

            muteAddedFor.push(await this.mute(message, member, reason));
        }

        if (muteAddedFor.length > 0) {
            this.addTicket(message.mentions.members, null, `${message.author.username} muted ${muteAddedFor.join("/")} (message: ${reason})`);
            this.replySecretMessage(message, `I have muted ${muteAddedFor.join("/")}.`);
        }
        else
            this.replySecretMessage(message, `No one you mentioned can be muted.`);
    }

    public async onUnmute(message: Discord.Message, isAdmin: boolean, command: string, args: string[]) {

        const unmutedUsers = [];
        for (const [id, member] of message.mentions.members) {
            const userName = await this.unmute(id);
            if (userName) unmutedUsers.push(userName);
        }

        if (unmutedUsers.length === 0)
            this.replySecretMessage(message, `No one you mentioned seems muted.`);
    }

    public async onTicket(message: Discord.Message, isAdmin: boolean, command: string, args: string[], separators: string[]) {

        let mentions = message.mentions.members;

        if (args[0] === "add") {
            this.addTicket(mentions, message, joinArguments(args, separators, 1));
            return;
        }

        if (mentions.size === 0) {
            mentions = new Discord.Collection<string, Discord.GuildMember>();
            mentions.set(message.author.id, message.member);
        }

        const tickets: string[] = [];

        const dateOptions = { year: "numeric", month: "long", day: "numeric" };
        for (const [id, member] of mentions) {

            if (!this.data.tickets[id])
                continue;
            const ticketData = this.data.tickets[id];

            for (const ticket of ticketData)
                tickets.push(`\`${new Date(ticket.dateString).toLocaleDateString("en-US", dateOptions)}\`: ${ticket.reason}`);
        }

        const ticketMessage = tickets.length > 0 ?
            `I have the following tickets for ${mentions.map(u => u.user.username).join("/")}: \n${tickets.join("\n")}` :
            `I have no tickets for ${mentions.map(u => u.user.username).join("/")}.`;

        this.replySecretMessage(message, ticketMessage);
    }

    private async handleMuteData(id: string) {

        const data = this.data.muted[id];
        if (!data)
            return;

        const user = await this.bot.fetchUser(id);
        if (user) {
            const guildmember = this.adminChannel!.guild.member(user);
            if (guildmember) {
                await guildmember.addRole(this.muteRole);
            }
        }
        const diff = new Date(data.unmuteDateString).getTime() - new Date().getTime();
        if (diff < 0) {
            this.unmute(id);
            return;
        }

        console.log(`${id} will be unmuted ${prettyMs(diff, { verbose: true })} from now.`);
        this.muteTimers[id] = setTimeout(() => {
            delete this.muteTimers[id];
            this.unmute(id);
        }, diff);
    }

    private async mute(message: Discord.Message, member: Discord.GuildMember, reason: string): Promise<string> {
        this.data.muted[member.id] = new MuteData(message.author.id, reason, new Date((new Date()).getTime() + this.sharedSettings.admin.muteTimeout));
        await member.addRole(this.muteRole);

        this.handleMuteData(member.id);
        return member.user.username;
    }

    private async unmute(id: string): Promise<string | null> {

        const data = this.data.muted[id];
        if (!data)
            return null;

        const muter = await this.muteRole.guild.fetchMember(data.muterId);
        const member = await this.bot.fetchUser(id);

        try {
            const serverUser = await this.muteRole.guild.fetchMember(id);
            await serverUser.removeRole(this.muteRole);
            console.log("Removed mute role from " + serverUser.user.username);
        } catch (e) {
            console.log(`${member.username} has left the server, so we are unable to remove their role`);
        }

        if (this.adminChannel) {
            this.adminChannel.send(`${muter}, I just unmuted ${member.username}.`);
        }

        if (this.muteTimers[id]) {
            clearTimeout(this.muteTimers[id]);
            delete this.muteTimers[id];
        }

        if (this.data.muted[id]) {
            this.data.muted[id] = null;
        }

        return member.username;
    }

    private async replySecretMessage(message: Discord.Message, reply: string) {

        if (!this.adminChannel) {
            message.author.send(reply).catch(e => {
                console.log("Admin: Could not DM " + message.author.username + ".");
                message.reply("I cannot send you a direct message, and there's no admin channel I can use.. Can't really give you this info.");
            });
        }
        else if (message.channel.id === this.adminChannel.id) {
            this.adminChannel.send(reply);
        }
        else { // If redirected to another channel, mention the author

            if (reply.charAt(0) !== "I" || reply.charAt(1) !== " ")
                reply = reply.charAt(0).toLowerCase() + reply.substr(1);
            this.adminChannel.send(message.author + ", " + reply);
        }
    }

    private async addTicket(users: Discord.Collection<string, Discord.GuildMember>, message: Discord.Message | null, reason: string) {

        const ticketAddedFor = [];
        for (const [id, member] of users) {

            if (!this.data.tickets[id])
                this.data.tickets[id] = [];

            this.data.tickets[id].push(new TicketData(reason));
            ticketAddedFor.push(member.user.username);
        }

        if (message)
            this.replySecretMessage(message, `I have added a ticket for ${ticketAddedFor.length > 0 ? ticketAddedFor.join("/") : "nobody"}.`);
    }
}
