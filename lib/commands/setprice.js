import * as Roblox from '../roblox.js';

import {EmbedBuilder, ComponentType, ButtonBuilder} from 'discord.js';
import {EMBED_COLORS, EMOJIS} from '../globals.js';

export const name = 'setprice';
export const description = 'update the price of all assets';

export const options = [{
    name: 'price',
    description: 'the new price of the asset',
    type: 'Integer',
    required: true
}];

export const execute = async (client, message, args) => {
    const confirm = await message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.WARN)
                .setDescription(`:warning: are you sure you want to update the price of all assets to \`${args[0]}\` robux?`)
        ],
        components: [{
            type: 1,
            components: [
                new ButtonBuilder()
                    .setStyle('Success')
                    .setLabel('yes')
                    .setCustomId('yes'),
                new ButtonBuilder()
                    .setStyle('Danger')
                    .setLabel('no')
                    .setCustomId('no')
            ]
        }]
    });

    const collectorFilter = i => {
        i.deferUpdate();
        return i.user.id === message.author.id;
    }

    confirm.awaitMessageComponent({filter: collectorFilter, componentType: ComponentType.Button, time: 60000})
        .then(async interaction => {
            if (interaction.customId === 'yes') {
                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.PRIMARY)
                            .setDescription(`${EMOJIS.LOADING} updating the price of all assets in your group to \`${args[0]}\` robux...`)
                    ],
                    components: []
                });

                await Roblox.updateAllAssetsPrice(Number(args[0]));

                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.SUCCESS)
                            .setDescription(`:white_check_mark: updated the price of all assets in your group to \`${args[0]}\` robux`)
                    ],
                    components: []
                });
            } else {
                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.ERROR)
                            .setDescription(':x: cancelled updating the price of all assets')
                    ],
                    components: []
                });
            }
        })
        .catch(() => {
            confirm.edit({
                embeds: [
                    new EmbedBuilder()
                        .setColor(EMBED_COLORS.ERROR)
                        .setDescription(':x: cancelled updating the price of all assets')
                ],
                components: []
            }).catch();
        });
}

