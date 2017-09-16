import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";

import Discord = require("discord.js");
import Extension from "./Extension";

export interface BottySettings {
    Discord: {
        Key: string;
        Owner: number;
    };
}

export default class Botty {
    public readonly client = new Discord.Client();
    private sharedSettings: SharedSettings;
    private personalSettings: PersonalSettings;

    constructor(sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        this.sharedSettings = sharedSettings;
        this.personalSettings = personalSettings;
        console.log("Successfully loaded bot settings.");

        this.client
            .on("error", console.error)
            .on("warn", console.warn)
            //.on("debug", console.log)
            .on("disconnect", () => console.warn("Disconnected!"))
            .on("reconnecting", () => console.warn("Reconnecting..."))
            .on("connect", () => console.warn("Connected."))
            .on("ready", () => console.log("Bot is logged in and ready."))
            .on("message", this.processMessage);
    }

    start() {
        return this.client.login(this.personalSettings.discord.key);
    }

    /** All available extensions mapped to their ID */
    private registeredExtensions: Map<string, typeof Extension> = new Map();
    private enabledExtensions: Map<typeof Extension, Extension> = new Map();

    // TODO log messages when enabling, disabling, and registering plugins
    /**
     * Registers a extension, allowing it to be enabled/disabled through commands
     * @param id A unique ID for the extension. This may contain any characters except spaces
     * @param ExtensionClass The extension class
     * @param enable If the extension should be enabled as soon as it is registered
     */
    public registerExtension = (id: string, ExtensionClass: typeof Extension, enable: boolean): void => {
        this.registeredExtensions.set(id, ExtensionClass);
        if (enable) this.enableExtension(ExtensionClass);
    };

    public enableExtension = (ExtensionClass: typeof Extension): boolean => {
        if (this.enabledExtensions.has(ExtensionClass)) return false;
        const x = <{ new (botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings): Extension }>ExtensionClass;
        const extension = new x(this, this.sharedSettings, this.personalSettings);
        this.enabledExtensions.set(ExtensionClass, extension);
        return true;
    };

    public disableExtension = (ExtensionClass: typeof Extension): boolean => {
        if (!this.enabledExtensions.has(ExtensionClass)) return false;
        const extension = this.enabledExtensions.get(ExtensionClass);
        if (!extension) return false;
        extension.disable();
        this.enabledExtensions.delete(ExtensionClass);
        return true;
    };

    public isExtensionEnabled = (ExtensionClass: typeof Extension): boolean => {
        return this.enabledExtensions.has(ExtensionClass);
    };

    /**
     * Gets an enabled extension, or 'undefined' if the specified extension is not enabled or is not registered
     * @param ExtensionClass 
     */
    // TODO get this working with generics?
    public getExtension = (ExtensionClass: typeof Extension): Extension | undefined => {
        return this.enabledExtensions.get(ExtensionClass);
    };

    private helpMessage: string = [
        "`!extension list` - lists all extensions and their statuses",
        "`!extension enable <extension>` - enables an extension",
        "`!extension disable <extension>` - disables an extension"
    ].join("\n");

    private processMessage = (message: Discord.Message): void => {
        if (!(message.channel instanceof Discord.TextChannel) || message.channel.name !== "moderators") return;
        const split = message.cleanContent.split(" ");
        if (!split[0].match(/^(!|\/)extensions?$/gi)) return;
        if (split.length < 2) {
            message.reply("Valid subcommands:\n" + this.helpMessage);
            return;
        }
        const subcommand = split[1].toLowerCase();
        if (subcommand === "list") {
            let response = "";
            for (const extension of this.registeredExtensions.values()) {
                response += `\n${this.isExtensionEnabled(extension) ? ":white_check_mark:" : ":x:"} ${extension.name}`;
            }
            message.reply(response);
        } else if (subcommand === "enable" || subcommand === "disable") {
            if (split.length !== 3) {
                message.reply("You must specify an extension");
                return;
            }
            const extension = this.registeredExtensions.get(split[2]);
            if (!extension) {
                message.reply(`Extension "${split[2]}" not found (note that extension names are case sensitive)`);
                return;
            }
            if (subcommand === "enable") {
                if (this.enableExtension(extension)) {
                    message.reply("Extension is now enabled");
                } else {
                    message.reply("Extension is already enabled");
                }
            } else if (subcommand === "disable") {
                if (this.disableExtension(extension)) {
                    message.reply("Extension is now disabled");
                } else {
                    message.reply("Extension is already disabled");
                }
            }
        }
    };
}
