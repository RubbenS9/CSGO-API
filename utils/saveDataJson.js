import * as fs from "fs";
import { assignSlugs } from "./slugify.js";

const englishNamesByFile = new Map();

// Ids whose original market_hash_name was a non-empty Steam listing name.
export const marketableItemIds = new Set();

const nonEmpty = value => (typeof value === "string" && value.trim() !== "" ? value : null);

const catalogEntries = data => {
    if (Array.isArray(data)) return data;

    if (!data || typeof data !== "object") return null;

    const values = Object.values(data);
    if (values.length === 0) return [];

    const isCatalog = values.every(
        item => item && typeof item === "object" && !Array.isArray(item) && item.id != null
    );

    return isCatalog ? values : null;
};

const resolvedEnglishName = item =>
    nonEmpty(item?.market_hash_name) ??
    nonEmpty(item?.marketHashName) ??
    nonEmpty(item?.name) ??
    (item?.id != null ? String(item.id) : null);

const englishNameMap = fileName => {
    if (englishNamesByFile.has(fileName)) {
        return englishNamesByFile.get(fileName);
    }

    const enPath = `./public/api/en/${fileName}`;
    if (!fs.existsSync(enPath)) {
        return null;
    }

    const entries = catalogEntries(JSON.parse(fs.readFileSync(enPath, "utf8")));
    if (!entries) {
        return null;
    }

    const names = new Map();
    for (const item of entries) {
        if (item?.id != null) {
            names.set(item.id, resolvedEnglishName(item));
        }
    }

    englishNamesByFile.set(fileName, names);
    return names;
};

const normalizeChild = item => {
    if (!item || typeof item !== "object") return;

    const hasSteamField = Object.prototype.hasOwnProperty.call(item, "market_hash_name");
    const steam = nonEmpty(item.market_hash_name);

    if (steam) {
        item.marketHashName = steam;
    } else if (!hasSteamField && nonEmpty(item.marketHashName)) {
        item.marketHashName = nonEmpty(item.marketHashName);
    } else if (item.id != null) {
        item.marketHashName = nonEmpty(item.marketHashName) ?? String(item.id);
    }

    if (hasSteamField) {
        delete item.market_hash_name;
    }
};

const normalizeChildren = item => {
    for (const key of ["wears", "variants"]) {
        if (!Array.isArray(item?.[key])) continue;

        for (const child of item[key]) {
            normalizeChild(child);
        }

        assignSlugs(item[key]);
    }
};

const normalizeEntry = (item, englishName) => {
    if (!item || typeof item !== "object" || item.id == null) return;

    const hasSteamField = Object.prototype.hasOwnProperty.call(item, "market_hash_name");
    const steam = nonEmpty(item.market_hash_name);

    if (steam) {
        marketableItemIds.add(item.id);
        item.marketHashName = steam;
    } else if (hasSteamField) {
        item.marketHashName = nonEmpty(englishName) ?? nonEmpty(item.marketHashName) ?? String(item.id);
    } else {
        item.marketHashName = nonEmpty(item.marketHashName) ?? nonEmpty(englishName) ?? String(item.id);
    }

    if (hasSteamField) {
        delete item.market_hash_name;
    }

    normalizeChildren(item);
};

// Copies a leftover Steam name onto marketHashName. Catalog rows are already resolved above.
const convertLeftoverMarketNames = node => {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
        for (const item of node) convertLeftoverMarketNames(item);
        return;
    }

    if ("market_hash_name" in node) {
        const steam = nonEmpty(node.market_hash_name);
        if (steam) {
            node.marketHashName = steam;
        } else if (!nonEmpty(node.marketHashName) && node.id != null) {
            node.marketHashName = String(node.id);
        }

        delete node.market_hash_name;
    }

    for (const value of Object.values(node)) {
        convertLeftoverMarketNames(value);
    }
};

// marketHashName prefers the Steam listing name. Otherwise it is the English item name.
export const normalizeApiData = (file, data) => {
    const entries = catalogEntries(data);
    if (!entries) {
        return data;
    }

    const match = String(file).match(/^\.\/public\/api\/([^/]+)\/([^/]+\.json)$/);
    const folder = match?.[1] ?? "en";
    const fileName = match?.[2] ?? "";

    if (folder === "en") {
        const names = new Map();

        for (const item of entries) {
            if (item?.id == null) continue;
            normalizeEntry(item, item.name);
            names.set(item.id, item.marketHashName);
        }

        if (fileName) {
            englishNamesByFile.set(fileName, names);
        }
    } else {
        const names = fileName ? englishNameMap(fileName) : null;

        for (const item of entries) {
            if (item?.id == null) continue;
            const englishName = names?.has(item.id) ? names.get(item.id) : null;
            normalizeEntry(item, englishName);
        }
    }

    assignSlugs(entries);
    convertLeftoverMarketNames(data);
    return data;
};

export const isMarketableItem = item => {
    if (!item || typeof item !== "object") return false;
    if (item.id != null && marketableItemIds.has(item.id)) return true;
    return nonEmpty(item.market_hash_name) != null;
};

export const saveDataJson = (file, data) => {
    normalizeApiData(file, data);

    return new Promise((resolve, reject) => {
        // I beautify the JSON data because it's easier for me see the changes
        const json = JSON.stringify(data, null, 1);

        const folders = file.replace(/\.\/public\/api\/(.*)\/(.*)\.json/, "$1").split("/");

        // Create api folder if it doesn't exist
        if (!fs.existsSync("./public/api")) {
            fs.mkdirSync("./public/api");
        }

        folders.forEach((folder, index) => {
            const path = folders.slice(0, index + 1).join("/");

            if (!fs.existsSync(`./public/api/${path}`)) {
                fs.mkdirSync(`./public/api/${path}`);
            }
        });

        fs.writeFile(file, json, err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};
