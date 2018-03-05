// @ts-ignore
const Config = require("./config.json");
const Core = require("../core");
const CronJob = require("cron").CronJob;
const DiscordUtil = Core.util;
const GuildData = require("./models/guild-data.js");
const DateDiff = require("date-diff");


// @ts-ignore
const client = new Core.Client(require("../token.json"), __dirname + "/commands", GuildData);

client.on("beforeLogin", () => {
    new CronJob(Config.activityUpdateSchedule, checkUsersInAllGuilds, null, true);
});

client.on("ready", checkUsersInAllGuilds);

client.on("message", message => {
    if (message.guild && message.member)
        GuildData.findOne({ guildID: message.guild.id })
            .then(guildData => registerMessage(message.guild, message.member, guildData));
});

client.on("voiceStateUpdate", member => {
    GuildData.findOne({ guildID: member.guild.id })
        .then(guildData => registerActivity(member.guild, member, guildData));
});

client.bootstrap();

function checkUsersInAllGuilds() {
    client.guilds.forEach(guild =>
        GuildData.findOne({ guildID: guild.id })
            .then(guildData => guildData && guildData.checkUsers(client)));
}

function registerActivity(guild, member, guildData) {
    const now = new Date();
    
    if (member && guildData && member.id !== client.user.id) {
        if(!guildData.users[member.id]) { guildData.initActivityDatastructure(member, now); }

        guildData.users[member.id]["lastseen"] = now; //store now as the latest date this user has interacted
        guildData.save();

        registerOnlineTimes(member, now, guildData);

        if (canManageRoles(guildData)) {
            if (guildData.shouldMarkActive(member))
                guildData.doMarkActive(member);
        }
        guildData.save();
    }
}

function registerMessage(guild, member, guildData) {
    registerActivity(guild, member, guildData);
    if (member && guildData && member.id !== client.user.id) {
        if(isNaN(guildData.users[member.id]["messagecount"])) { guildData.users[member.id]["messagecount"]=0; }
        guildData.users[member.id]["messagecount"]++; //increment stored message count
        guildData.save();
    }
}

function canManageRoles(guildData) {
    return guildData.allowRoleAddition && guildData.activeRoleID && guildData.activeRoleID.length > 0;
}

function registerOnlineTimes(member, time, guildData) {
    initOnlinetimeDatastructure(member, guildData);
    var stillActive = new DateDiff(time, Date.parse(guildData.users[member.id]["lastseen"])).minutes() <= 15;
    if(stillActive) {
        guildData.users[member.id]["onlinetimes"]["current"]["until"] = guildData.users[member.id]["lastseen"];
    }
    else {
        guildData.users[member.id]["onlinetimes"]["history"].push(guildData.users[member.id]["onlinetimes"]["current"]);
        guildData.users[member.id]["onlinetimes"]["current"] = {};
        DiscordUtil.dateLog(`${member.user.username} status changed to inactive`);
    }
    guildData.save();
}

function initOnlinetimeDatastructure(member, guildData) {
    if (!guildData.users[member.id]["onlinetimes"]) {
        guildData.users[member.id]["onlinetimes"] = {};
        guildData.users[member.id]["onlinetimes"]["current"] = {};
        guildData.users[member.id]["onlinetimes"]["history"] = [];
    }
    if (!guildData.users[member.id]["onlinetimes"]["current"]["from"]) {
        guildData.users[member.id]["onlinetimes"]["current"]["from"] = guildData.users[member.id]["lastseen"];
    }
    if (!guildData.users[member.id]["onlinetimes"]["current"]["until"]) {
        guildData.users[member.id]["onlinetimes"]["current"]["until"] = guildData.users[member.id]["lastseen"];
    }
    guildData.save();
}