import fs from "fs";
import { PUBLISHED_FILES, writeDerivedCatalog } from "../utils/derivedCatalog.js";

const apiRoot = "./public/api";

const locales = fs
    .readdirSync(apiRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

if (locales.length === 0) {
    console.error("No locale folders in public/api");
    process.exit(1);
}

let wrote = 0;

for (const locale of locales) {
    for (const fileName of PUBLISHED_FILES) {
        const file = `./public/api/${locale}/${fileName}`;
        if (!fs.existsSync(file)) {
            console.warn(`Missing ${file}, skipping`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const result = writeDerivedCatalog(file, data);
        if (!result) {
            throw new Error(`Failed to derive ${file}`);
        }
        wrote += 1;
    }
}

console.log(`Wrote slim and index catalogs for ${wrote} files across ${locales.join(", ")}`);
