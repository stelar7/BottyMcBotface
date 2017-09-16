import Discord = require("discord.js");
import { EventEmitter } from "events";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";
import Botty from "./Botty";

export default abstract class Extension {
    private registeredListeners: EventListener[] = [];

    public readonly botty: Botty;
    public readonly bot: Discord.Client;
    public readonly sharedSettings: SharedSettings;
    public readonly personalSettings: PersonalSettings;

    public constructor(botty: Botty, sharedSettings: SharedSettings, personalSettings: PersonalSettings) {
        this.botty = botty;
        this.bot = botty.client;
        this.sharedSettings = sharedSettings;
        this.personalSettings = personalSettings;
    }
    public abstract disable(): void;

    /**
     * Add an event listener to an EventEmitter. This listener will be removed when removeRegisteredEventListeners() is called.
     */
    // TODO are arrays handled correctly?
    public addEventListener(emitter: EventEmitter, event: string | symbol, listener: (...args: any[]) => void): void {
        this.registeredListeners.push({
            emitter: emitter,
            event: event,
            listener: listener
        });
        emitter.addListener(event, listener);
    }

    /**
     * Remove an event listener from an EventEmitter. Any event listener added through addEventListener() should use this method to remove the listener.
     */
    // TODO are arrays handled correctly?
    public removeEventListener(emitter: EventEmitter, event: string | symbol, listener: (...args: any[]) => void): void {
        for (let i = 0; i < this.registeredListeners.length; i++) {
            let registeredListener = this.registeredListeners[i];
            if (registeredListener.emitter === emitter && registeredListener.event === event && registeredListener.listener === listener) {
                this.registeredListeners.splice(i, 1);
                break;
            }
        }
        emitter.removeListener(event, listener);
    }

    /**
     * Removes all event listeners registered through addEventListener()
     */
    public removeRegisteredEventListeners(): void {
        for (let registeredListener of this.registeredListeners) {
            registeredListener.emitter.removeListener(registeredListener.event, registeredListener.listener);
        }
        this.registeredListeners = [];
    }

    /**
     * Adds a callback to run when the client is ready. If the client is already ready, the callback will run immediately. The listener
     * will be removed when removeRegisteredEventListeners() is called.
     * @param callback 
     */
    public onClientReady(callback: () => void): void {
        if (this.bot.readyAt) {
            callback();
        } else {
            this.addEventListener(this.bot, "ready", callback);
        }
    }
}

/**
 * An event listener that has been attached to an EventEmitter
 */
interface EventListener {
    emitter: EventEmitter;
    event: string | symbol;
    listener: (...args: any[]) => void;
}
