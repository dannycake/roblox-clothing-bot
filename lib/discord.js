import fs from 'fs';
import {Client, GatewayIntentBits, Events, EmbedBuilder} from 'discord.js';

import {EMBED_COLORS, print} from './globals.js';
import config from './config.js';

const {
    'bot_prefix': prefix,
    'whitelisted_users': whitelistedUsers,
    'bot_token': token,

    'sale_notifications_channel': saleNotificationsChannel,
} = config.discord;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});
client.commands = new Map();

for (const file of fs.readdirSync('./lib/commands')) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.name, command);
}

const validateType = (type, value) => {
    switch (type) {
        case 'String':
            return typeof value === 'string';
        case 'Integer':
            value = parseInt(value);
            return typeof value === 'number' && !isNaN(value) && value % 1 === 0;
        case 'Number':
            value = parseFloat(value);
            return typeof value === 'number' && !isNaN(value);
        default:
            return false;
    }
}

client.once(Events.ClientReady, c => {
    print('success', `Logged in to Discord as ${c.user.tag} (${c.user.id})!`);

    if (client.guilds.cache.size === 0)
        print('warn', `Please invite the Discord bot to your server by visiting: https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot&permissions=8`);
});

client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    if (!whitelistedUsers.includes(message.author.id)) return;

    const args = message.content.split(/ +/);
    const command = args.shift().toLowerCase().substring(prefix.length);
    const validateArgs = JSON.parse(JSON.stringify(args));

    if (!client.commands.has(command)) return;

    const commandData = client.commands.get(command);

    try {
        const {
            name,
            description,
            options,
        } = commandData;

        const usage = `${prefix}${name} ${options.map(o => o.required ? `[${o.name}]` : `(${o.name})`).join(' ')}`;

        if (options.filter(o => o.required).length > args.length) return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Invalid number of arguments :frowning2:')
                    .setColor(EMBED_COLORS.ERROR)
                    .setDescription(`**Usage:** \`${usage}\``)
            ]
        });

        for (const option of options.slice(0, args.length)) {
            const value = validateArgs.shift();
            if (!validateType(option.type, value))
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Invalid argument type :frowning2:')
                            .setColor(EMBED_COLORS.ERROR)
                            .setDescription(
                                `\`${option.name}\` must be of type \`${option.type.toLowerCase()}\`\n` +
                                `**Usage:** \`${usage}\``
                            )
                    ]
                });
        }

        await commandData.execute(client, message, args);
    } catch (error) {
        print('error', `Failed to execute command "${command}":`, error);
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('Failed to execute command :frowning2:')
                    .setColor(EMBED_COLORS.ERROR)
                    .setDescription(`\`${error.message}\``)
            ]
        })
    }
});

export const sendMessage = (channelId, body) => {
    try {
        const channel = client.channels.cache.get(channelId);
        if (!channel) return print('error', `Failed to send message to channel ${channelId}: Channel not found`);
        channel.send(body)
            .catch(error => {
                print('error', `Failed to send message to channel ${channelId}:`, error);
            });
    } catch (error) {
        print('error', `Failed to send message to channel ${channelId}:`, error);
    }
};
export const sendSaleNotification = (sale) => {
    const beforeTax = Math.round(sale.amount / 0.7);

    sendMessage(saleNotificationsChannel, {
        embeds: [
            new EmbedBuilder()
                .setTitle(':smirk_cat: item sold!')
                .setColor(EMBED_COLORS.PRIMARY)
                .setDescription(
                    `:frame_photo: **asset:** [${sale.assetName}](https://www.roblox.com/catalog/${sale.assetId})\n` +
                    `:bust_in_silhouette: **player:** [${sale.agentName}](https://www.roblox.com/users/${sale.agentId}/profile)\n` +
                    `:coin: **amount:** \`${sale.amount.toLocaleString()}\` a/t (\`${beforeTax.toLocaleString()}\` b/t) robux`
                )
                /*.setFooter({
                    text: `quaid-powered theft`
                })*/
        ]
    })
};

export const start = () => {
    client.login(token)
        .catch(error => {
            print('error', 'Failed to start Discord bot:', error);
            return process.exit(1);
        });
}
