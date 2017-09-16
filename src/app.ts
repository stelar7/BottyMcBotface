import Botty from "./Botty";

import Uptime from "./Uptime";
import AutoReact from "./AutoReact";
import Honeypot from "./Honeypot";
import ForumReader from "./ForumReader";
import KeyFinder from "./KeyFinder";
import Techblog from "./Techblog";
import ChannelAccess from "./ChannelAccess";
import VersionChecker from "./VersionChecker";
import Info from "./Info";
import { fileBackedObject } from "./FileBackedObject";
import { SharedSettings } from "./SharedSettings";
import { PersonalSettings } from "./PersonalSettings";

// Load and initialise settings
const sharedSettings = fileBackedObject<SharedSettings>("settings/shared_settings.json");
const personalSettings = fileBackedObject<PersonalSettings>("settings/personal_settings.json");
const bot = new Botty(sharedSettings, personalSettings);

// Register and enable extensions
bot.registerExtension("Uptime", Uptime, true);
bot.registerExtension("KeyFinder", KeyFinder, true);
bot.registerExtension("ForumReader", ForumReader, true);
bot.registerExtension("AutoReact", AutoReact, true);
bot.registerExtension("Honeypot", Honeypot, true);
bot.registerExtension("Techblog", Techblog, true);
bot.registerExtension("ChannelAccess", ChannelAccess, false);
bot.registerExtension("Info", Info, true);
bot.registerExtension("VersionChecker", VersionChecker, true);

// start bot
bot.start();
