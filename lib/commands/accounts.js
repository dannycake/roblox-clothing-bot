import * as Roblox from '../roblox.js';

import {EmbedBuilder} from 'discord.js';
import {EMBED_COLORS} from '../globals.js';

export const name = 'accounts';
export const description = 'fetches the accounts in use by the bot';

export const options = [];

export const execute = async (client, message, args) => {
    const {
        owner, uploader
    } = Roblox.getAccounts();

    const uploaderRobux = await uploader.getRobux();

    message.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('accounts in use')
                .setDescription(
                    `👑 **owner**: [${owner.username}](https://www.roblox.com/users/${owner.id}/profile) (\`${owner.id}\`)\n` +
                    `📁 **uploader**: [${uploader.username}](https://www.roblox.com/users/${uploader.id}/profile) (\`${uploader.id}\`)\n`
                )
                .setColor(EMBED_COLORS.PRIMARY)
                .addFields({
                    name: ':coin: uploader robux available',
                    value: `${uploaderRobux.toLocaleString()} robux (${Math.floor(uploaderRobux / 10).toLocaleString()} pieces of clothing)`,
                    inline: true
                })
        ]
    });
};
