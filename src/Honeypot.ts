import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";
import Extension from "./Extension";

import Discord = require("discord.js");
import Botty from "./Botty";

export default class Honeypot extends Extension {
    private master: Discord.Client;
    private client: Discord.Client;
    private joinTime: number;

    constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        super(botty, sharedSettings, personalSettings);

        this.joinTime = Date.now();
        this.master = botty.client;
        this.client = new Discord.Client();

        /* Events listeners can be added directly to the client since they don't need to
        be removed when the extension is disabled (because the client will be destroyed) */
        this.client
            .on("message", this.onMessage.bind(this))
            .on("messageUpdate", this.onMessageUpdate.bind(this))
            .on("guildCreate", this.onJoin.bind(this))
            .on("error", console.error)
            .on("warn", console.warn)
            //.on("debug", console.log)
            .on("disconnect", () => console.warn("Honeypot disconnected!"))
            .on("reconnecting", () => console.warn("Honeypot is reconnecting..."))
            .on("connect", () => console.warn("Honeypot is connected."))
            .on("ready", () => console.log("Honeypot is logged in and ready."));

        this.onClientReady(() => {
            console.log("Honeypot's master is logged in and ready.");
            this.client.login(this.personalSettings.honeypot.token);
        });
    }

    public disable(): void {
        this.client.destroy();
    }

    onJoin(guild: Discord.Guild) {
        console.error(`Joined '${guild}'`);
        this.joinTime = Date.now();
    }

    get joinedTime() {
        const timeDiff = Date.now() - this.joinTime;
        if (timeDiff > 1000) return Math.round(timeDiff * 0.001) + " seconds";

        return timeDiff + " milliseconds";
    }

    onMessage(message: Discord.Message) {
        if (message.channel.type !== "dm") return;

        const catchMessage = `Got a direct message ${this.joinedTime} after joining from ${message.author.toString()}: \`\`\`${message.content}\`\`\``;
        this.reportHoneypotCatch(catchMessage);
    }

    onMessageUpdate(oldMessage: Discord.Message, newMessage: Discord.Message) {
        if (newMessage.channel.type !== "dm") return;

        const catchMessage = `User updated a direct message ${this
            .joinedTime} after joining from ${newMessage.author.toString()}: \`\`\`${newMessage.content}\`\`\` Old message was: \`\`\`${oldMessage.content}\`\`\``;
        this.reportHoneypotCatch(catchMessage);
    }

    reportHoneypotCatch(message: string) {
        console.warn(message);
        const channel = this.channel;
        if (!channel) return;

        channel.send(message);
    }

    get channel(): Discord.TextChannel | null {
        const guild = this.master.guilds.find("name", this.sharedSettings.server);
        if (!guild) {
            console.error(`Honeypot: Incorrect setting for the server: ${this.sharedSettings.server}`);
            return null;
        }

        const channel = guild.channels.find("name", this.sharedSettings.honeypot.reportChannel);
        if (!channel) {
            console.error(`Honeypot: Incorrect setting for the channel: ${this.sharedSettings.honeypot.reportChannel}`);
            return null;
        }

        return channel as Discord.TextChannel;
    }
}
