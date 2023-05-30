import * as Roblox from '../roblox.js';
import * as Assets from "../assets.js";

import {EMBED_COLORS, EMOJIS, print} from "../globals.js";
import {EmbedBuilder} from "discord.js";

export const name = 'group';
export const description = 'steals all assets from a group';

export const options = [{
    name: 'group name',
    description: 'the name of the group to steal from',
    type: 'String',
    required: true,
}];

export const execute = async (client, message, args) => {
    const groupName = args.join(' ');

    const newMessage = await message.reply({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.PRIMARY)
                .setTitle(`${EMOJIS.LOADING} finding clothing in \`${groupName.replace(/`/g, '\\`')}\` to upload...`)
        ]
    });

    const assets = await Roblox.getGroupAssets(groupName);
    if (!assets || !assets.length) return newMessage.edit({
        embeds: [
            new EmbedBuilder()
                .setColor(EMBED_COLORS.ERROR)
                .setTitle('failed to find anything to steal :frowning2:')
        ]
    });

    const assetIds = assets.map(asset => asset.id);

    const assetIdsChunks = assetIds.reduce((acc, assetId, index) => {
        const chunkIndex = Math.floor(index / 100);
        if (!acc[chunkIndex]) acc[chunkIndex] = [];
        acc[chunkIndex].push(assetId);
        return acc;
    }, []);

    let totalUploaded = 0;

    for (const assetIdsChunk of assetIdsChunks) {
        const assetDetails = await Roblox.getGroupAssetsData(assetIdsChunk);

        for (const assetDetail of assetDetails) {
            if (![11, 12].includes(assetDetail.assetType)) continue;
            if (assetDetail.name.toLowerCase().includes('prep')) continue;

            const asset = await Assets.fetchAssetWithWatermark(assetDetail.id);
            if (!asset) continue;

            const hashedAsset = Assets.hashBuffer(asset);
            const existingAsset = Assets.findHash(hashedAsset);

            const existingAssetByName = Roblox.findGroupAssetByName(assetDetail.name);

            if (existingAsset || existingAssetByName) {
                print('debug', `Skipping asset ${assetDetail.id} because it's already been uploaded`);
                continue;
            }

            const uploadResult = await Roblox.uploadAsset(assetDetail.name, assetDetail.assetType, asset);
            if (!uploadResult.success) {
                if (JSON.stringify(uploadResult.error).includes('The creator does not have enough Robux to pay for the upload fees')) {
                    return await newMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`uploaded \`${totalUploaded}\` clothing items before running out of robux :grin:`)
                                .setColor(EMBED_COLORS.SUCCESS)
                        ]
                    }).catch();
                }

                if (JSON.stringify(uploadResult.error).includes('User is moderated')) {
                    return await newMessage.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`uploaded \`${totalUploaded}\` clothing items before getting banned :frowning2:`)
                                .setColor(EMBED_COLORS.SUCCESS)
                        ]
                    }).catch();
                }
                continue;
            }

            print('success', `Successfully uploaded asset "${assetDetail.name}" from ${assetDetail.id} as https://roblox.com/catalog/${uploadResult.id}`);
            totalUploaded++;
        }

        await newMessage.edit({
            embeds: [
                new EmbedBuilder()
                    .setColor(EMBED_COLORS.SUCCESS)
                    .setTitle(`uploaded \`${totalUploaded}\` clothing items from \`${groupName.replace(/`/g, '\\`')}\` :grin:`)
            ]
        });
    }
};
