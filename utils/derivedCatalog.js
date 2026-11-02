import * as fs from "fs";
import path from "path";

// Published category files only. all.json is an aggregate and stays as-is.
// inventory.json and skins_not_grouped.json are local aggregates, not published.
export const PUBLISHED_FILES = [
    "agents.json",
    "base_weapons.json",
    "collectibles.json",
    "collections.json",
    "crates.json",
    "graffiti.json",
    "highlights.json",
    "keychains.json",
    "keys.json",
    "music_kits.json",
    "patches.json",
    "sticker_slabs.json",
    "stickers.json",
    "tools.json",
    "weapons.json",
];

const PUBLISHED_FILE_SET = new Set(PUBLISHED_FILES);

// Nested records copied onto many items. Slim files keep the id; the full
// record lives in that category's own catalog.
const ID_REFERENCE_KEYS = new Set(["crates", "collections", "contains", "contains_rare"]);

// Replaces a description paragraph that is copied onto most items of a file.
export const BOILERPLATE_TOKEN = "{{boilerplate}}";

const BOILERPLATE_MIN_LENGTH = 80;
const BOILERPLATE_MIN_COVERAGE = 0.8;

const isBlank = value => {
    if (value == null || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "object") return Object.keys(value).length === 0;
    return false;
};

const toIdList = value => {
    if (!Array.isArray(value)) return undefined;

    const ids = [];
    for (const entry of value) {
        if (entry == null || entry === "") continue;
        if (typeof entry === "string" || typeof entry === "number") {
            ids.push(entry);
            continue;
        }
        if (typeof entry === "object" && entry.id != null && entry.id !== "") {
            ids.push(entry.id);
        }
    }

    return ids.length > 0 ? ids : undefined;
};

const pick = (value, fields) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

    const picked = {};
    for (const field of fields) {
        if (value[field] != null && value[field] !== "") {
            picked[field] = value[field];
        }
    }

    return Object.keys(picked).length > 0 ? picked : undefined;
};

// Most common long description, when that same text is inside almost every item.
export const detectBoilerplate = items => {
    const counts = new Map();

    for (const item of items) {
        const description = item?.description;
        if (typeof description !== "string" || description.length < BOILERPLATE_MIN_LENGTH) continue;
        counts.set(description, (counts.get(description) || 0) + 1);
    }

    if (counts.size === 0) return null;

    let best = null;
    let bestCount = 0;
    for (const [text, count] of counts) {
        if (count > bestCount || (count === bestCount && best != null && text.length > best.length)) {
            best = text;
            bestCount = count;
        }
    }

    let described = 0;
    let covered = 0;
    for (const item of items) {
        const description = item?.description;
        if (typeof description !== "string" || description.length === 0) continue;
        described += 1;
        if (description.includes(best)) covered += 1;
    }

    if (described === 0 || covered / described < BOILERPLATE_MIN_COVERAGE) return null;
    return best;
};

const applyBoilerplate = (description, boilerplate) => {
    if (typeof description !== "string" || !boilerplate || !description.includes(boilerplate)) {
        return description;
    }

    return description.split(boilerplate).join(BOILERPLATE_TOKEN);
};

const slimWears = wears => {
    const next = [];
    for (const wear of wears) {
        if (!wear || typeof wear !== "object") continue;
        const entry = {};
        if (wear.id != null && wear.id !== "") entry.id = wear.id;
        if (typeof wear.name === "string" && wear.name !== "") entry.name = wear.name;
        if (Object.keys(entry).length > 0) next.push(entry);
    }
    return next.length > 0 ? next : undefined;
};

const slimVariants = (variants, parentImage) => {
    const next = [];
    for (const variant of variants) {
        if (!variant || typeof variant !== "object") continue;
        const entry = {};
        for (const [key, value] of Object.entries(variant)) {
            if (isBlank(value)) continue;
            // The parent skin image is already on the item. Wear rows repeat it.
            if (key === "image" && value === parentImage) continue;
            entry[key] = value;
        }
        if (Object.keys(entry).length > 0) next.push(entry);
    }
    return next.length > 0 ? next : undefined;
};

export const slimItem = (item, boilerplate) => {
    const out = {};

    for (const [key, value] of Object.entries(item)) {
        if (key === "original" || isBlank(value)) continue;

        if (ID_REFERENCE_KEYS.has(key)) {
            const ids = toIdList(value);
            if (ids) out[key] = ids;
            continue;
        }

        if (key === "description") {
            const description = applyBoilerplate(value, boilerplate);
            if (typeof description === "string" && description !== "") out.description = description;
            continue;
        }

        if (key === "wears") {
            const wears = slimWears(value);
            if (wears) out.wears = wears;
            continue;
        }

        if (key === "variants") {
            const variants = slimVariants(value, item.image);
            if (variants) out.variants = variants;
            continue;
        }

        out[key] = value;
    }

    return out;
};

export const indexItem = item => {
    const out = {};

    if (item?.id != null) out.id = item.id;
    if (typeof item?.name === "string" && item.name !== "") out.name = item.name;
    if (typeof item?.marketHashName === "string" && item.marketHashName !== "") {
        out.marketHashName = item.marketHashName;
    }
    if (typeof item?.image === "string" && item.image !== "") out.image = item.image;

    const rarity = pick(item?.rarity, ["id", "name", "color"]);
    if (rarity) out.rarity = rarity;

    const weapon = pick(item?.weapon, ["id", "name"]);
    if (weapon) out.weapon = weapon;

    const category = pick(item?.category, ["id", "name"]);
    if (category) out.category = category;

    const pattern = pick(item?.pattern, ["id", "name"]);
    if (pattern) out.pattern = pattern;

    if (typeof item?.stattrak === "boolean") out.stattrak = item.stattrak;
    if (typeof item?.souvenir === "boolean") out.souvenir = item.souvenir;

    const collections = toIdList(item?.collections);
    if (collections) out.collections = collections;

    const team = pick(item?.team, ["id", "name"]);
    if (team) out.team = team;

    if (typeof item?.type === "string" && item.type !== "") out.type = item.type;
    if (typeof item?.effect === "string" && item.effect !== "") out.effect = item.effect;

    const tournament = pick(item?.tournament, ["id", "name"]);
    if (tournament) out.tournament = tournament;

    const player = pick(item?.player, ["id", "name"]);
    if (player) out.player = player;

    return out;
};

const catalogItems = data => {
    if (Array.isArray(data)) return data;
    return null;
};

const assertDerived = (fileName, source, slim, index) => {
    if (slim.length !== source.length || index.length !== source.length) {
        throw new Error(
            `Derived count mismatch for ${fileName}: source ${source.length}, slim ${slim.length}, index ${index.length}`
        );
    }

    for (let i = 0; i < source.length; i += 1) {
        const sourceId = source[i]?.id;
        if (slim[i]?.id !== sourceId || index[i]?.id !== sourceId) {
            throw new Error(`Derived id mismatch for ${fileName} at index ${i}`);
        }
        if (Object.prototype.hasOwnProperty.call(slim[i], "original")) {
            throw new Error(`original leaked into slim ${fileName}`);
        }
        for (const key of ID_REFERENCE_KEYS) {
            const value = slim[i][key];
            if (value == null) continue;
            if (!Array.isArray(value) || value.some(entry => entry && typeof entry === "object")) {
                throw new Error(`${key} was not reduced to ids in ${fileName}`);
            }
        }
        if (Array.isArray(slim[i].wears)) {
            for (const wear of slim[i].wears) {
                const extra = Object.keys(wear).filter(key => key !== "id" && key !== "name");
                if (extra.length > 0) {
                    throw new Error(`wear kept extra fields in ${fileName}: ${extra.join(", ")}`);
                }
            }
        }
    }
};

const writeJson = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(data)}\n`);
};

const formatBytes = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Writes public/api/{locale}/slim/{file} and public/api/{locale}/index/{file}.
// No-op unless `file` is a published top-level category catalog.
export const writeDerivedCatalog = (file, data) => {
    const match = String(file).match(/^\.\/public\/api\/([^/]+)\/([^/]+\.json)$/);
    if (!match) return null;

    const locale = match[1];
    const fileName = match[2];
    if (!PUBLISHED_FILE_SET.has(fileName)) return null;

    const items = catalogItems(data);
    if (!items) return null;

    const boilerplate = detectBoilerplate(items);
    const slim = items.map(item => slimItem(item, boilerplate));
    const index = items.map(indexItem);
    assertDerived(fileName, items, slim, index);

    const stem = fileName.replace(/\.json$/, "");
    const slimPath = `./public/api/${locale}/slim/${fileName}`;
    const indexPath = `./public/api/${locale}/index/${fileName}`;
    const boilerplatePath = `./public/api/${locale}/slim/${stem}.boilerplate.json`;

    writeJson(slimPath, slim);
    writeJson(indexPath, index);

    if (boilerplate) {
        writeJson(boilerplatePath, { description: boilerplate });
    } else if (fs.existsSync(boilerplatePath)) {
        fs.unlinkSync(boilerplatePath);
    }

    const slimBytes = fs.statSync(slimPath).size;
    const indexBytes = fs.statSync(indexPath).size;
    console.log(
        `Derived ${locale}/${fileName}: slim ${formatBytes(slimBytes)}, index ${formatBytes(indexBytes)}${
            boilerplate ? ", boilerplate extracted" : ""
        }`
    );

    return { locale, fileName, slimBytes, indexBytes, boilerplate: Boolean(boilerplate) };
};
