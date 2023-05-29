import * as Roblox from '../roblox.js';

import {EmbedBuilder} from 'discord.js';
import {EMBED_COLORS} from '../globals.js';

export const name = 'payout';
export const description = 'payout robux to a user';

export const options = [{
    name: 'user id',
    description: 'the person receiving the robux',
    type: 'Integer',
    required: true
}, {
    name: 'amount',
    description: 'the amount of robux to pay',
    type: 'Integer',
    required: true
}];

export const execute = async (client, message, args) => {
    const [
        userId,
        amount
    ] = args;

    const payoutRobux = await Roblox.payoutRobux(
        Number(userId), Number(amount)
    );

    if (!payoutRobux.success) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('failed to payout robux :frowning2:')
                    .setColor(EMBED_COLORS.ERROR)
                    .setDescription(`\`\`\`json\n${typeof payoutRobux.error === 'object' ? JSON.stringify(payoutRobux.error, null, 4) : 'please check the console for more information.'}\`\`\``)
            ]
        });
    }

    return message.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle('successfully paid robux :grin:')
                .setColor(EMBED_COLORS.SUCCESS)
                .setDescription(`\`${amount.toLocaleString()}\` robux has been successfully paid to \`${userId}\``)
        ]
    })
};
