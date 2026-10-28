// Shared URL slug. Built from marketHashName, which is the same string in every locale.
export const slugify = value => {
    return String(value ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[★™]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

const hashName = item => {
    const value = item?.marketHashName;
    return typeof value === "string" ? value.trim() : "";
};

// Sorted by id so every locale assigns the same slug, whatever the array order.
export const assignSlugs = items => {
    if (!Array.isArray(items)) {
        return { collisions: 0, total: 0 };
    }

    const rows = [];

    for (const item of items) {
        if (!item || item.id == null) continue;

        const base = slugify(hashName(item));
        rows.push({ item, base: base.length > 0 ? base : String(item.id) });
    }

    rows.sort((left, right) => String(left.item.id).localeCompare(String(right.item.id)));

    const used = new Set();
    let collisions = 0;

    for (const row of rows) {
        let slug = row.base;

        if (used.has(slug)) {
            collisions += 1;
            const withId = `${slug}-${row.item.id}`;
            slug = used.has(withId) ? `${withId}-${used.size}` : withId;
        }

        used.add(slug);
        row.item.slug = slug;
    }

    return { collisions, total: rows.length };
};
