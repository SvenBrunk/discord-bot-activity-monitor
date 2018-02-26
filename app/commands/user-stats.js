const Core = require("../../core");

module.exports = new Core.Command({
    name: "user-stats",
    description: "View your user statistics",
    syntax: "user-stats",
    admin: false,
    invoke
});

function invoke({ message, params, guildData, client }) {
    return Promise.resolve(`\`\`\`JavaScript\n ${guildData.showMemberStats(message.author)} \`\`\``);
}