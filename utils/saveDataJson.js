import * as fs from "fs";

const englishNamesByFile = new Map();

const englishNameMap = fileName => {
    if (englishNamesByFile.has(fileName)) {
        return englishNamesByFile.get(fileName);
    }

    const enPath = `./public/api/en/${fileName}`;
    if (!fs.existsSync(enPath)) {
        return null;
    }

    const enData = JSON.parse(fs.readFileSync(enPath, "utf8"));
    if (!Array.isArray(enData)) {
        return null;
    }

    const names = new Map();
    for (const item of enData) {
        if (item?.id != null) {
            names.set(item.id, item.marketHashName ?? item.name ?? null);
        }
    }

    englishNamesByFile.set(fileName, names);
    return names;
};

// marketHashName is always the English `name` of the same item.
const applyMarketHashName = (file, data) => {
    const match = file.match(/^\.\/public\/api\/([^/]+)\/([^/]+\.json)$/);
    if (!match || !Array.isArray(data)) {
        return;
    }

    const [, folder, fileName] = match;

    if (folder === "en") {
        const names = new Map();
        for (const item of data) {
            if (item?.id == null) {
                continue;
            }
            item.marketHashName = item.name ?? null;
            names.set(item.id, item.marketHashName);
        }
        englishNamesByFile.set(fileName, names);
        return;
    }

    const names = englishNameMap(fileName);
    if (!names) {
        return;
    }

    for (const item of data) {
        if (item?.id == null) {
            continue;
        }
        item.marketHashName = names.has(item.id) ? names.get(item.id) : null;
    }
};

export const saveDataJson = (file, data) => {
    applyMarketHashName(file, data);

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
                // console.log(`JSON data is saved in ${file}.`);
                resolve();
            }
        });
    });
};
