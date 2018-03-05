const Core = require("../../core");
const DateDiff = require("date-diff");
const DiscordUtil = require("../..//core").util;

module.exports = class GuildData extends Core.BaseGuildData {
    constructor() {
        super();

        //defined below in .schema but also here to shut up some errors later on about .indexOf not being available
        this.ignoredUserIDs = [String];
        this.ignoredRoleIDs = [String];

        this.schema({
            inactiveThresholdDays: { type: Number, default: 7, min: 1 },
            activeRoleID: String,
            inactiveRoleID: String,
            users: { type: Object, default: {} },
            allowRoleAddition: Boolean,
            ignoredUserIDs: [String],
            ignoredRoleIDs: [String]
        });
    }

    checkUsers(client) {
        const guild = client.guilds.get(this.guildID);

        if (!guild)
            return;

        const now = new Date();
        const role = guild.roles.find(x => x.id === this.activeRoleID);
        if (!role)
            return;

        guild.members.forEach(member => {
            //don't ask me why, sometimes member is null, hence the if(member) check
            if (member) {
                if(!this.users[member.id]) {
                    this.initActivityDatastructure(member, now);
                }
                if( this.shouldMarkActive(member)) {
                    this.doMarkActive(member);
                }
                else if (this.shouldMarkInactive(member, now)) {
                    this.doMarkInactive(member);
                    delete this.users[member.id];
                }
            }
        });
    }

    initActivityDatastructure(member, now) {
        this.users[member.id] = {};
        const online = member.presence.status === "online";
        if (online) {
            this.users[member.id]["firstseen"] = now;
            this.users[member.id]["lastseen"] = now;
        }
        else {
            this.users[member.id]["firstseen"] = new Date(2018,1,1);
            this.users[member.id]["lastseen"] = new Date(2018,1,1);
        }
        this.users[member.id]["messagecount"] = 0;
        DiscordUtil.dateLog(`${member.user.username} registered`);
    }

    shouldMarkInactive(member, now) {
        const isNowInactive = new DateDiff(now, Date.parse(this.users[member.id]["lastseen"])).days() >= this.inactiveThresholdDays;

        return !this.memberIsIgnored(member) && isNowInactive;
    }

    doMarkInactive(member) {
        member.removeRole(this.activeRoleID)
            .catch(err => DiscordUtil.dateError("Error removing active role from user " + member.name + " in guild " + member.guild.name, err.message || err));

        if (this.inactiveRoleID && this.inactiveRoleID !== "disabled") {
            member.addRole(this.inactiveRoleID);
        }
        DiscordUtil.dateLog(`${member.user.username} is now inactive`);
    }

    shouldMarkActive(member) {
        const notAlreadyActive = !member.roles.get(this.activeRoleID);
        const online = member.presence.status === "online";

        return !this.memberIsIgnored(member) && notAlreadyActive && online;
    }

    doMarkActive(member) {
        member.addRole(this.activeRoleID)
            .catch(err => DiscordUtil.dateError(`Error adding active role to user ${member.user.username} in guild ${member.guild.name}\n${err.message || err}`));

        if (this.inactiveRoleID && this.inactiveRoleID !== "disabled")
            member.removeRole(this.inactiveRoleID)
                .catch(err => DiscordUtil.dateError(`Error removing active role from user ${member.user.username} in guild ${member.guild.name}\n${err.message || err}`));

        DiscordUtil.dateLog(`${member.user.username} is now active`);
    }

    memberIsIgnored(member) {
        const isIgnoreduser = this.ignoredUserIDs.indexOf(member.id) >= 0;
        const hasIgnoredRole = member.roles.some(role => this.ignoredRoleIDs.indexOf(role.id) >= 0);
        return isIgnoreduser || hasIgnoredRole;
    }

    toString() {
        const blacklist = ["id", "users"];
        return JSON.stringify(this, (k, v) => blacklist.indexOf(k) < 0 ? v : undefined, "\t");
    }

    showMemberStats(member) {
        if(this.users[member.id]) {
            var userData = this.users[member.id];
            return JSON.stringify( {"first seen":userData.firstseen, "last seen":userData.lastseen, "message count":userData.messagecount, "online times":userData.onlinetimes});
        }
        else
            return `sorry... ${member.username} I don't know you yet. Please ask again later.`;
    }
};