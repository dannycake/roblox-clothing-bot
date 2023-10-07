import * as Roblox from '../roblox.js';
import * as Assets from '../assets.js';

import {EMBED_COLORS, EMOJIS, print} from '../globals.js';
import {EmbedBuilder} from 'discord.js';

export const name = 'find';
export const description = 'finds clothing to upload';

export const options = [{
    name: 'amount',
    description: 'the amount of clothing to upload',
    type: 'Integer',
    required: true,
}];

export const execute = async (client, message, args) => {
    const amount = Number(args[0]);

    const newMessage = await message.reply({
        embeds: [
            new EmbedBuilder()
                .setDescription(`${EMOJIS.LOADING} finding clothing to upload...`)
                .setColor(EMBED_COLORS.PRIMARY)
        ]
    });

    const popularShirts = await Roblox.getPopularItems(11, amount);
    const popularPants = await Roblox.getPopularItems(12, amount);

    const popularShirtIds = popularShirts.map(shirt => shirt.id);
    const popularPantIds = popularPants.map(pant => pant.id);

    const assetIds = popularShirtIds.reduce((acc, shirtId, index) => {
        acc.push(shirtId, popularPantIds[index]);
        return acc;
    }, []);
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
            if (totalUploaded >= amount) break;

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
                if (JSON.stringify(uploadResult.error).includes('InsufficientFunds')) {
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

        if (totalUploaded >= amount) break;
    }

    await newMessage.edit({
        embeds: [
            new EmbedBuilder()
                .setDescription(`:grin: successfully uploaded \`${totalUploaded}\` clothing items`)
                .setColor(EMBED_COLORS.SUCCESS)
        ]
    });
};
