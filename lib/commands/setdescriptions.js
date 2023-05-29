import * as Roblox from '../roblox.js';

import {ButtonBuilder, ComponentType, EmbedBuilder} from 'discord.js';
import {EMBED_COLORS, EMOJIS, print} from '../globals.js';

export const name = 'setdescriptions';
export const description = 'sets the descriptions of all items in a group';

export const options = [];

export const execute = async (client, message, _args) => {
    const confirm = await message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.WARN)
                .setDescription(`:warning: are you sure you want to update the descriptions of all assets?`)
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
            // print('info', 'setdescriptions', `received interaction ${interaction.customId}`)
            if (interaction.customId === 'yes') {
                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.PRIMARY)
                            .setDescription(`${EMOJIS.LOADING} updating the description of all assets in your group...`)
                    ],
                    components: []
                });

                await Roblox.updateAllDescriptions();

                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.SUCCESS)
                            .setDescription(`:white_check_mark: updated the description of all assets in your group to`)
                    ],
                    components: []
                });
            } else {
                confirm.edit({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.ERROR)
                            .setDescription(':x: cancelled updating the description of all assets')
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
                        .setDescription(':x: cancelled updating the description of all assets')
                ],
                components: []
            }).catch();
        });
};
