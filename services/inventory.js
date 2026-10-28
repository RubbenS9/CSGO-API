import fs from "fs";
import path from "path";
import { isMarketableItem, saveDataJson } from "../utils/saveDataJson.js";
import { languageData } from "./translations.js";

const formatInventoryData = ({
    skins,
    crates,
    collectibles,
    stickers,
    graffiti,
    musicKits,
    keychains,
    highlights,
    agents,
    patches,
    keys,
    stickerSlabs,
    tools,
}) => {
    const items = {};

    skins.forEach(skin => {
        if (!items["skins"]) items["skins"] = {};
        if (!items["skins"][skin.weapon.weapon_id]) items["skins"][skin.weapon.weapon_id] = {};

        items["skins"][skin.weapon.weapon_id][skin.paint_index] = {
            name: skin.name,
            marketHashName: skin.marketHashName,
            slug: skin.slug,
            rarity: skin.rarity,
            marketable: true,
            image: skin.image,
        };
    });

    crates.forEach(crate => {
        if (!items["crates"]) items["crates"] = {};
        if (!items["crates"][crate.id.replace("crate-", "")])
            items["crates"][crate.id.replace("crate-", "")] = {};

        items["crates"][crate.id.replace("crate-", "")] = {
            name: crate.name,
            marketHashName: crate.marketHashName,
            slug: crate.slug,
            rarity: crate.rarity,
            marketable: isMarketableItem(crate),
            image: crate.image,
        };
    });

    collectibles.forEach(collectible => {
        if (!items["collectibles"]) items["collectibles"] = {};
        if (!items["collectibles"][collectible.id.replace("collectible-", "")])
            items["collectibles"][collectible.id.replace("collectible-", "")] = {};

        items["collectibles"][collectible.id.replace("collectible-", "")] = {
            name: collectible.name,
            marketHashName: collectible.marketHashName,
            slug: collectible.slug,
            rarity: collectible.rarity,
            marketable: isMarketableItem(collectible),
            image: collectible.image,
        };
    });

    stickers.forEach(sticker => {
        if (!items["stickers"]) items["stickers"] = {};
        if (!items["stickers"][sticker.id.replace("sticker-", "")])
            items["stickers"][sticker.id.replace("sticker-", "")] = {};

        items["stickers"][sticker.id.replace("sticker-", "")] = {
            name: sticker.name,
            marketHashName: sticker.marketHashName,
            slug: sticker.slug,
            rarity: sticker.rarity,
            marketable: isMarketableItem(sticker),
            image: sticker.image,
        };
    });

    graffiti.forEach(graffiti => {
        if (!items["graffiti"]) items["graffiti"] = {};
        if (!items["graffiti"][graffiti.id.replace("graffiti-", "")])
            items["graffiti"][graffiti.id.replace("graffiti-", "")] = {};

        items["graffiti"][graffiti.id.replace("graffiti-", "")] = {
            name: graffiti.name,
            marketHashName: graffiti.marketHashName,
            slug: graffiti.slug,
            rarity: graffiti.rarity,
            marketable: isMarketableItem(graffiti),
            image: graffiti.image,
        };
    });

    musicKits.forEach(musicKit => {
        if (!musicKit.id.includes("_st")) {
            if (!items["music_kits"]) items["music_kits"] = {};
            if (!items["music_kits"][musicKit.id.replace("music_kit-", "")])
                items["music_kits"][musicKit.id.replace("music_kit-", "")] = {};

            items["music_kits"][musicKit.id.replace("music_kit-", "")] = {
                name: musicKit.name,
                marketHashName: musicKit.marketHashName,
                slug: musicKit.slug,
                rarity: musicKit.rarity,
                marketable: isMarketableItem(musicKit),
                image: musicKit.image,
            };
        }
    });

    keychains.forEach(keychain => {
        if (!items["keychains"]) items["keychains"] = {};
        items["keychains"][keychain.id.replace("keychain-", "")] = {
            name: keychain.name,
            marketHashName: keychain.marketHashName,
            slug: keychain.slug,
            rarity: keychain.rarity,
            marketable: isMarketableItem(keychain),
            image: keychain.image,
        };
    });

    highlights.forEach(highlight => {
        if (!items["highlights"]) items["highlights"] = {};
        items["highlights"][highlight.id.replace("highlight-", "")] = {
            name: highlight.name,
            marketHashName: highlight.marketHashName,
            slug: highlight.slug,
            rarity: highlight.rarity ?? null,
            marketable: isMarketableItem(highlight),
            image: highlight.image,
        };
    });

    agents.forEach(agent => {
        if (!items["agents"]) items["agents"] = {};
        items["agents"][agent.id.replace("agent-", "")] = {
            name: agent.name,
            marketHashName: agent.marketHashName,
            slug: agent.slug,
            rarity: agent.rarity,
            marketable: isMarketableItem(agent),
            image: agent.image,
        };
    });

    patches.forEach(patch => {
        if (!items["patches"]) items["patches"] = {};
        items["patches"][patch.id.replace("patch-", "")] = {
            name: patch.name,
            marketHashName: patch.marketHashName,
            slug: patch.slug,
            rarity: patch.rarity,
            marketable: isMarketableItem(patch),
            image: patch.image,
        };
    });

    keys.forEach(key => {
        if (!items["keys"]) items["keys"] = {};
        items["keys"][key.id.replace("key-", "")] = {
            name: key.name,
            marketHashName: key.marketHashName,
            slug: key.slug,
            rarity: key.rarity ?? null,
            marketable: isMarketableItem(key),
            image: key.image,
        };
    });

    stickerSlabs.forEach(stickerSlab => {
        if (!items["sticker_slabs"]) items["sticker_slabs"] = {};
        items["sticker_slabs"][stickerSlab.id.replace("sticker_slab-", "")] = {
            name: stickerSlab.name,
            marketHashName: stickerSlab.marketHashName,
            slug: stickerSlab.slug,
            rarity: stickerSlab.rarity,
            marketable: isMarketableItem(stickerSlab),
            image: stickerSlab.image,
        };
    });

    tools.forEach(tool => {
        if (!items["tools"]) items["tools"] = {};
        items["tools"][tool.id.replace("tool-", "")] = {
            name: tool.name,
            marketHashName: tool.marketHashName,
            slug: tool.slug,
            rarity: tool.rarity ?? null,
            marketable: isMarketableItem(tool),
            image: tool.image,
        };
    });

    return items;
};

const waitForFile = async (filePath, maxRetries = 5, retryDelay = 2000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
            return JSON.parse(fs.readFileSync(filePath, "utf-8"));
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    throw new Error(`Failed to read ${filePath} after ${maxRetries} attempts`);
};

export const getInventory = async () => {
    const { folder } = languageData;
    const skinsFilePath = path.join(process.cwd(), `./public/api/${folder}/weapons.json`);
    const cratesFilePath = path.join(process.cwd(), `./public/api/${folder}/crates.json`);
    const collectiblesFilePath = path.join(process.cwd(), `./public/api/${folder}/collectibles.json`);
    const stickersFilePath = path.join(process.cwd(), `./public/api/${folder}/stickers.json`);
    const graffitiFilePath = path.join(process.cwd(), `./public/api/${folder}/graffiti.json`);
    const musicKitsFilePath = path.join(process.cwd(), `./public/api/${folder}/music_kits.json`);
    const keychainsFilePath = path.join(process.cwd(), `./public/api/${folder}/keychains.json`);
    const highlightsFilePath = path.join(process.cwd(), `./public/api/${folder}/highlights.json`);
    const agentsFilePath = path.join(process.cwd(), `./public/api/${folder}/agents.json`);
    const patchesFilePath = path.join(process.cwd(), `./public/api/${folder}/patches.json`);
    const keysFilePath = path.join(process.cwd(), `./public/api/${folder}/keys.json`);
    const stickerSlabsFilePath = path.join(process.cwd(), `./public/api/${folder}/sticker_slabs.json`);
    const toolsFilePath = path.join(process.cwd(), `./public/api/${folder}/tools.json`);

    try {
        const skins = await waitForFile(skinsFilePath);
        const crates = await waitForFile(cratesFilePath);
        const collectibles = await waitForFile(collectiblesFilePath);
        const stickers = await waitForFile(stickersFilePath);
        const graffiti = await waitForFile(graffitiFilePath);
        const musicKits = await waitForFile(musicKitsFilePath);
        const keychains = await waitForFile(keychainsFilePath);
        const highlights = await waitForFile(highlightsFilePath);
        const agents = await waitForFile(agentsFilePath);
        const patches = await waitForFile(patchesFilePath);
        const keys = await waitForFile(keysFilePath);
        const stickerSlabs = await waitForFile(stickerSlabsFilePath);
        const tools = await waitForFile(toolsFilePath);
        const inventory = formatInventoryData({
            skins,
            crates,
            collectibles,
            stickers,
            graffiti,
            musicKits,
            keychains,
            highlights,
            agents,
            patches,
            keys,
            stickerSlabs,
            tools,
        });
        await saveDataJson(`./public/api/${folder}/inventory.json`, inventory);
    } catch (error) {
        console.error(error.message);
    }
};
