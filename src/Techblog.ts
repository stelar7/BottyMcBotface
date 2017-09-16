import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";
import { dataFiles, TechblogData } from "./DataFiles";

import Extension from "./Extension";
import Discord = require("discord.js");
import feedReader = require("feed-read");
import Botty from "./Botty";

export default class Techblog extends Extension {
    private data: TechblogData;
    private channel: Discord.TextChannel;
    /** The Timer for when the RSS feed will be parsed next */
    private updateTimer: NodeJS.Timer;
    constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        super(botty, sharedSettings, personalSettings);

        this.data = fileBackedObject(dataFiles.techBlog);
        console.log("Successfully loaded TechblogReader data file.");

        this.onClientReady(() => {
            if (!this.data.Last) this.data.Last = Date.now();

            let guild = this.bot.guilds.get(this.sharedSettings.server);
            if (!guild) {
                console.error(`TechBlog: Invalid settings for guild ID ${this.sharedSettings.server}`);
                return;
            }

            this.channel = guild.channels.find("name", this.sharedSettings.techBlog.channel) as Discord.TextChannel;
            if (!this.channel) {
                console.error(`TechBlog: Incorrect setting for the channel: ${this.sharedSettings.techBlog.channel}`);
                return;
            }

            console.log("TechblogReader extension loaded.");

            this.updateTimer = setInterval(() => {
                this.checkFeed();
            }, this.sharedSettings.techBlog.checkInterval);
        });
    }

    public disable(): void {
        this.removeRegisteredEventListeners();
        clearInterval(this.updateTimer);
    }

    checkFeed() {
        feedReader(this.sharedSettings.techBlog.url, (error, articles) => {
            if (error) {
                console.error("Error reading tech blog RSS feed:", error);
                return;
            }

            for (const article of articles.reverse()) {
                const timestamp = +article.published;
                if (timestamp > this.data.Last) {
                    this.channel.send(`A new article has been posted on the Riot Games Tech Blog: \`${article.title}\`\n${article.link}`);
                    this.data.Last = timestamp;
                }
            }
        });
    }
}
