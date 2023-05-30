import * as Roblox from '../roblox.js';

import {EmbedBuilder} from 'discord.js';
import {EMBED_COLORS} from '../globals.js';

export const name = 'robux';
export const description = 'fetches the amount of robux in the group';
export const options = [];

export const execute = async (client, message, _args) => {
    const balance = await Roblox.getTotalRevenue();

    if (!balance || !Object.keys(balance)) return message.channel.send(
        new EmbedBuilder()
            .setColor(EMBED_COLORS.ERROR)
            .setDescription(`:frowning2: **failed to get robux balance**\ncheck the console for more information`)
    );

    const pending = balance.pendingRobux;
    const totalSales = balance.itemSaleRobux - pending;
    const available = balance.groupPayoutRobux + totalSales - pending;
    const total = balance.itemSaleRobux + pending;

    const rate = 4.5;

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.PRIMARY)
        .setDescription(
            `💵 **sales**: \`${totalSales.toLocaleString()}\` (~\`$${(totalSales / 1000 * rate).toFixed(2)}\`)\n` +
            `⏰ **pending**: \`${pending.toLocaleString()}\` (~\`$${(pending / 1000 * rate).toFixed(2)}\`)\n` +
            `💰 **available**: \`${available.toLocaleString()}\` (~\`$${(available / 1000 * rate).toFixed(2)}\`)\n\n` +
            `💶 **total**: \`${total.toLocaleString()}\` (~\`$${(total / 1000 * rate).toFixed(2)}\`)`
        )

    return message.channel.send({embeds: [embed]});
}
