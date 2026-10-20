import axios from "axios";
import {
    getWeaponName,
    isNotWeapon,
    knives,
    getCategory,
    getWears,
    getDopplerPhase,
    getRarityColor,
    weaponIDMapping,
    skinMarketHashName,
    formatIconPath,
} from "../utils/index.js";
import { saveDataJson } from "../utils/saveDataJson.js";
import { $t, $tTag, $tc, languageData } from "./translations.js";
import { state } from "./main.js";
import specialNotes from "../utils/specialNotes.json" with { type: "json" };
import { getImageUrl } from "../constants.js";

// English only: market_hash_name stays English for every locale.
const SKIN_VARIANTS_URL = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/all.json";

const warnedSkinIds = new Set();

const variantKind = entry => (entry.souvenir ? 2 : entry.stattrak ? 1 : 0);

const compareVariantEntries = (left, right) => {
    const leftWear = left.wear?.id ?? "";
    const rightWear = right.wear?.id ?? "";

    if (leftWear < rightWear) return -1;
    if (leftWear > rightWear) return 1;

    return variantKind(left) - variantKind(right);
};

const toSkinVariant = entry => ({
    id: entry.id,
    marketHashName: entry.market_hash_name,
    wear: entry.wear?.name ?? null,
    stattrak: Boolean(entry.stattrak),
    souvenir: Boolean(entry.souvenir),
    image: entry.image,
});

// One pass over all.json. The resulting arrays are reused for every locale.
export const loadSkinVariants = async () => {
    const { data } = await axios.get(SKIN_VARIANTS_URL, {
        timeout: 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });

    const grouped = new Map();

    for (const entry of Object.values(data)) {
        if (entry == null || entry.skin_id == null) continue;

        const list = grouped.get(entry.skin_id);
        if (list) {
            list.push(entry);
        } else {
            grouped.set(entry.skin_id, [entry]);
        }
    }

    const variantsBySkinId = new Map();

    for (const [skinId, entries] of grouped) {
        entries.sort(compareVariantEntries);
        variantsBySkinId.set(skinId, entries.map(toSkinVariant));
    }

    console.log(`Indexed variants for ${variantsBySkinId.size} skins`);

    return variantsBySkinId;
};

const variantsFor = skinId => {
    const variants = state.skinVariantsById?.get(skinId);

    if (!variants || variants.length === 0) {
        if (!warnedSkinIds.has(skinId)) {
            warnedSkinIds.add(skinId);
            console.warn(`Skin ${skinId} has no variants`);
        }

        return [];
    }

    return variants;
};

const getPatternName = (weapon, string) => {
    return string.replace(`${weapon}_`, "").toLowerCase();
};

const isSkin = iconPath => {
    if (iconPath.includes("newcs2")) {
        return false;
    }

    const regexSkinId = /econ\/default_generated\/(.*?)_light$/i;

    return regexSkinId.test(iconPath.toLowerCase());
};

const getSkinInfo = iconPath => {
    const regexSkinId = /econ\/default_generated\/(.*?)_light$/i;
    const path = iconPath.toLowerCase();
    const skinId = path.match(regexSkinId);

    const weapon = getWeaponName(skinId[1]);
    const pattern = getPatternName(weapon, skinId[1]);

    return [weapon, pattern];
};

const getDescription = (desc, paintKits, pattern) => {
    const pattern_desc = $t(`#PaintKit_${pattern}`);
    if (pattern_desc && pattern_desc.length > 0) {
        return `${desc} ${pattern_desc}`;
    }

    const tag = paintKits[pattern]?.description_tag.toLowerCase().replace("_tag", "");
    const tag_desc = $t(tag);
    if (tag_desc && tag_desc.length > 0) {
        return `${desc} ${tag_desc}`;
    }

    const idx_desc = $tTag(paintKits[pattern]?.description_tag);
    if (idx_desc && idx_desc.length > 0) {
        return `${desc} ${idx_desc}`;
    }

    return desc;
};

// One entry per wear index. StatTrak and Souvenir are flags, not extra rows.
// market_hash_name is the English normal variant. Souvenir-only skins keep the Souvenir name.
const getWearVariants = ({ weapon, pattern, items, paintKits, iconPath, cdnImages, isStatTrak, isSouvenir }) => {
    const wearKeys = getWears(paintKits[pattern]?.wear_remap_min, paintKits[pattern]?.wear_remap_max);
    const souvenirOnly = ["hy_labrat_mp5"].includes(pattern);

    const englishItemName = !isNotWeapon(weapon)
        ? $t(items[weapon].item_name_prefab, true)
        : $t(items[weapon].item_name, true);
    const englishPattern = $t(paintKits[pattern]?.description_tag, true);

    return wearKeys.map(wearKey => {
        const wearIconPath = formatIconPath(iconPath.toLowerCase(), wearKey);

        return {
            id: wearKey,
            name: $t(wearKey),
            stattrak: isStatTrak,
            souvenir: isSouvenir,
            market_hash_name: skinMarketHashName({
                itemName: englishItemName,
                pattern: englishPattern,
                wear: $t(wearKey, true),
                isStatTrak: false,
                isSouvenir: souvenirOnly,
                isWeapon: !isNotWeapon(weapon),
                isVanilla: false,
            }),
            image: cdnImages[wearIconPath] ? cdnImages[wearIconPath] : getImageUrl(wearIconPath),
        };
    });
};

const parseItem = (item, items) => {
    const { rarities, paintKits, cratesBySkins, collectionsBySkins, cdnImages } = state;
    const [weapon, pattern] = getSkinInfo(item.icon_path);
    const dopplerPhase = getDopplerPhase(paintKits[pattern]?.paint_index);
    const image =
        state.cdnImages[`${item.icon_path.toLowerCase()}`] ??
        state.cdnImages[`${item.icon_path.toLowerCase().replace(/_light$/, "_medium")}`] ??
        state.cdnImages[`${item.icon_path.toLowerCase().replace(/_light$/, "_heavy")}`] ??
        getImageUrl(`${item.icon_path.toLowerCase()}`);
    const translatedName = !isNotWeapon(weapon)
        ? $t(items[weapon].item_name_prefab)
        : $t(items[weapon].item_name);
    const translatedDescription = !isNotWeapon(weapon)
        ? $t(items[weapon].item_description_prefab)
        : $t(items[weapon].item_description);

    const isStatTrak =
        weapon.includes("knife") ||
        weapon.includes("bayonet") ||
        state.stattTrakSkins[`[${pattern}]${weapon}`] !== undefined;
    const isSouvenir = !isNotWeapon(weapon);

    const isKnife = weapon.includes("weapon_knife") || weapon.includes("weapon_bayonet");

    const rarity = !isNotWeapon(weapon)
        ? rarities[`[${pattern}]${weapon}`]?.rarity
            ? `rarity_${rarities[`[${pattern}]${weapon}`]?.rarity}_weapon`
            : null
        : isKnife
          ? // Knives are 'Covert'
            `rarity_ancient_weapon`
          : // Gloves are 'Extraordinary'
            `rarity_ancient`;

    const team =
        !items[weapon].used_by_classes || Object.keys(items[weapon].used_by_classes).length === 2
            ? "both"
            : Object.keys(items[weapon].used_by_classes)[0];

    return {
        id: `skin-${item.object_id}`,
        name: isNotWeapon(weapon)
            ? $tc("rare_special", {
                  item_name: translatedName,
                  pattern: $t(paintKits[pattern]?.description_tag),
              })
            : `${translatedName} | ${$t(paintKits[pattern]?.description_tag)}`,
        description: getDescription(translatedDescription, paintKits, pattern),
        weapon: {
            id: weapon,
            weapon_id: weaponIDMapping[weapon],
            name: translatedName,
        },
        category: {
            id: getCategory(weapon),
            name: $t(getCategory(weapon)),
        },
        pattern: {
            id: pattern,
            // Some names are numbers, let's convert them to strings.
            // https://github.com/ByMykel/CSGO-API/issues/158
            name: $t(paintKits[pattern]?.description_tag)?.toString(),
        },
        min_float: paintKits[pattern]?.wear_remap_min,
        max_float: paintKits[pattern]?.wear_remap_max,
        rarity: {
            id: rarity,
            name: $t(rarity),
            color: getRarityColor(rarity),
        },
        stattrak: isStatTrak,
        // The Souvenir-O-Matic (IEM Cologne 2026 Major) lets any normal weapon skin become a
        // Souvenir, so every gun qualifies. Knives and gloves stay out, as isNotWeapon covers both.
        souvenir: isSouvenir,
        paint_index: paintKits[pattern]?.paint_index,
        wears: getWearVariants({
            weapon,
            pattern,
            items,
            paintKits,
            iconPath: item.icon_path,
            cdnImages,
            isStatTrak,
            isSouvenir,
        }),
        collections:
            collectionsBySkins?.[`skin-${item.object_id}`]?.map(i => ({
                ...i,
                name: $t(i.name),
            })) ?? [],
        crates:
            cratesBySkins?.[`skin-${item.object_id}`]?.map(i => ({
                ...i,
                name: $t(i.name),
            })) ?? [],
        ...(dopplerPhase && { phase: dopplerPhase }),
        special_notes: specialNotes?.[`skin-${item.object_id}`],
        team: {
            id: team,
            name:
                team === "both"
                    ? $t("inv_filter_both_teams")
                    : team === "counter-terrorists"
                      ? $t("inv_filter_ct")
                      : $t("inv_filter_t"),
        },
        legacy_model: paintKits[pattern]?.legacy_model,
        image,

        // Return original attributes from item_game.json
        original: {
            name: items[weapon].name,
        },
    };
};

export const getSkins = async () => {
    const { itemsGame, items, cratesBySkins, cdnImages } = state;
    const { folder } = languageData;

    const skins = [
        ...Object.entries(itemsGame.alternate_icons2.weapon_icons)
            .filter(([, item]) => isSkin(item.icon_path))
            .map(([key, item]) => parseItem({ ...item, object_id: key }, items)),
        ...knives.map(knife => ({
            id: `skin-vanilla-${knife.name}`,
            name: $tc("rare_special_vanilla", {
                item_name: $t(knife.item_name),
            }),
            description: $t(knife.item_description),
            weapon: {
                id: knife.item_name,
                weapon_id: weaponIDMapping[knife.name],
                name: $t(knife.item_name),
            },
            category: {
                id: "sfui_invpanel_filter_melee",
                name: $t("sfui_invpanel_filter_melee"),
            },
            pattern: null,
            min_float: null,
            max_float: null,
            rarity: {
                id: `rarity_ancient_weapon`,
                name: $t(`rarity_ancient_weapon`),
                color: getRarityColor("rarity_ancient_weapon"),
            },
            stattrak: true,
            paint_index: null,
            crates:
                cratesBySkins[`skin-vanilla-${knife.name}`]?.map(i => ({
                    ...i,
                    name: $t(i.name),
                })) ?? [],
            team: {
                id: "both",
                name: $t("inv_filter_both_teams"),
            },
            legacy_model: true,
            image:
                cdnImages[`econ/weapons/base_weapons/${knife.name}`] ??
                getImageUrl(`econ/weapons/base_weapons/${knife.name}`),

            // Return original attributes from item_game.json
            original: {
                name: knife.name,
            },
        })),
    ].filter(skin => !skin.name.includes("null") && skin.rarity.id);

    if (!(state.skinVariantsById instanceof Map)) {
        throw new Error("Skin variants are not loaded");
    }

    for (const skin of skins) {
        skin.variants = variantsFor(skin.id);
    }

    await saveDataJson(`./public/api/${folder}/weapons.json`, skins);
};
