export const dataFiles = {
    forum: "data/forum_data.json",
    keyFinder: "data/riot_keys.json",
    techBlog: "data/techblog_data.json",
    autoReact: "data/thinking_data.json",
    uptime: "data/uptime_data.json",
    versionChecker: "data/version_data.json",
    info: "data/info_data.json"
};

export interface TechblogData {
    Last: number;
}

export interface FoundKeyInfo {
    apiKey: string;
    /** The person who posted the key. If the key was posted on AnswerHub, this will be their username; if the key was posted in Discord, this will be a string to tag them (e.g. "<@178320409303842817>") */
    user: string;
    /** Where the key was posted. If the key was posted on AnswerHub, this will be a link to the post; if the key was posted in Discord, this will be a string to tag the channel (e.g. "<#187652476080488449>") */
    location: string;
    /** When the key was posted (in milliseconds since the Unix epoch)*/
    timestamp: number;
    /** The key rate limit (in the same form as the "X-App-Rate-Limit" header) */
    rateLimit: string;
}

export interface ForumReaderData {
    Last: {
        question: number;
        answer: number;
        comment: number;
    };
}
