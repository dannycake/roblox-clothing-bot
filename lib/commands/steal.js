import * as Assets from '../assets.js';
import * as Roblox from '../roblox.js';

import {ButtonBuilder, EmbedBuilder} from 'discord.js';
import {EMBED_COLORS, print} from '../globals.js';

export const name = 'steal';
export const description = 'steal an asset from roblox';

export const options = [{
    name: 'asset id',
    description: 'the asset id to steal',
    type: 'Integer',
    required: true
}, {
    name: 'include watermark',
    description: 'whether to include a watermark on the asset',
    type: 'String',
    required: false,
}];

export const execute = async (client, message, args) => {
    const assetId = args[0];

    const details = await Roblox.getAssetData(assetId);
    if (!details || !Object.keys(details).length) return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.ERROR)
                .setTitle('failed to fetch asset :frowning2:')
                .setDescription(`please make sure the asset exists and check the console for more information`)
        ]
    });

    if (![11, 12].includes(details.AssetTypeId)) return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.ERROR)
                .setTitle('failed to fetch asset :frowning2:')
                .setDescription(`please make sure the asset is shirt or pants`)
        ]
    });

    const asset = await Assets.fetchAsset(assetId);
    const watermarkedAsset = await Assets.overlayWatermark(asset);
    const hashedAsset = Assets.hashBuffer(watermarkedAsset);
    const existingAsset = Assets.findHash(hashedAsset);

    if (!asset) return message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.ERROR)
                .setTitle('failed to fetch asset :frowning2:')
                .setDescription(`please make sure the asset exists and check the console for more information`)
        ]
    });

    const uploadButton = new ButtonBuilder()
        .setStyle('Primary')
        .setLabel('upload')
        .setCustomId(`upload-${assetId}`)
        .setEmoji('📤');

    const {
        Creator: {
            Name: creatorName,
            CreatorType: creatorType,
            CreatorTargetId: creatorTargetId
        }
    } = details;

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.PRIMARY)
        .setURL(`https://www.roblox.com/catalog/${assetId}`)
        .setTitle(details.Name)
        .setDescription(
            `uploaded by ${creatorType === 'Group' ? `[${creatorName}](https://www.roblox.com/groups/${creatorTargetId})` : `[${creatorTargetId}](https://www.roblox.com/users/${creatorTargetId}/profile)`}` +
            `\n\n` +
            (existingAsset !== null ? `:warning: **this asset already exists in your group as [${existingAsset}](https://www.roblox.com/catalog/${existingAsset})**` : ``))
        .setImage(`attachment://${assetId}.png`);

    const file = {
        attachment: args[1] ? watermarkedAsset : asset,
        name: `${assetId}.png`
    };

    const newMessage = await message.reply({
        embeds: [embed],
        files: [file],
        components: [{
            type: 1,
            components: [uploadButton]
        }]
    });

    const collectorFilter = i => {
        i.deferUpdate();
        return i.user.id === message.author.id;
    };

    newMessage.awaitMessageComponent({filter: collectorFilter, time: 120000})
        .then(async interaction => {
            if (interaction.customId === `upload-${assetId}`) {
                const uploadRequest = await Roblox.uploadAsset(
                    details.Name,
                    details.AssetTypeId,
                    watermarkedAsset
                );

                if (!uploadRequest?.success) return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.ERROR)
                            .setTitle('failed to upload asset :frowning2:')
                            .setDescription(`\`\`\`json\n${typeof uploadRequest.error === 'object' ? JSON.stringify(uploadRequest.error, null, 4) : 'please check the console for more information.'}\`\`\``)
                    ],
                    components: [],
                    files: []
                });

                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(EMBED_COLORS.SUCCESS)
                            .setTitle('successfully uploaded asset :grin:')
                            .setDescription(`\`${details.Name}\`\nhttps://www.roblox.com/catalog/${uploadRequest.id}`)
                    ],
                    components: [],
                    files: []
                });
            }
        })
        .catch(async error => {
            // print('error', 'Failed to get button interaction', error);
            uploadButton.setDisabled(true);

            await newMessage.edit({
                embeds: [embed],
                components: [{
                    type: 1,
                    components: [uploadButton]
                }]
            }).catch();
        });
}
