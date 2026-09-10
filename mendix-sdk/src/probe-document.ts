/**
 * Dumps any document by qualified name, so the shape Studio Pro writes for a construct can be
 * copied rather than guessed at. `MENDIX_DOCUMENTS` takes a comma-separated list.
 */
import * as fs from "fs";
import * as path from "path";
import { JavaScriptSerializer } from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";

import { APP_ID, BRANCH } from "./common";

const OUT_DIR = path.join(__dirname, "..", "out-probe");

async function main(): Promise<void> {
    const names = (process.env.MENDIX_DOCUMENTS ?? "").split(",").map(name => name.trim()).filter(Boolean);
    if (names.length === 0) throw new Error("Set MENDIX_DOCUMENTS to a comma-separated list of qualified names.");

    const branch = process.env.MENDIX_TARGET_BRANCH ?? BRANCH;
    const workingCopy = await new MendixPlatformClient().getApp(APP_ID).createTemporaryWorkingCopy(branch);
    const model = await workingCopy.openModel();

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const name of names) {
        const document = model.allDocuments().find(candidate => candidate.qualifiedName === name);
        if (!document) {
            console.error(`Not found: ${name}`);
            continue;
        }
        const loaded = await document.load();
        const js = JavaScriptSerializer.serializeToJs(loaded as any);
        const target = path.join(OUT_DIR, `${name}.js`);
        fs.writeFileSync(target, js);
        console.log(`${name} -> ${target} (${js.split("\n").length} lines)`);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
