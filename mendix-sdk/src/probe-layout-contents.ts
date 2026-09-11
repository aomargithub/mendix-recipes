/**
 * Dumps the widget tree of a layout, so page-level chrome such as the feedback button and the
 * language selector can be located before it is removed.
 */
import { JavaScriptSerializer } from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";

import { APP_ID, BRANCH } from "./common";

async function main(): Promise<void> {
    const layoutName = process.env.MENDIX_LAYOUT ?? "Atlas_Core.Atlas_TopBar";
    const branch = process.env.MENDIX_TARGET_BRANCH ?? BRANCH;
    const workingCopy = await new MendixPlatformClient().getApp(APP_ID).createTemporaryWorkingCopy(branch);
    const model = await workingCopy.openModel();

    const layoutInterface = model.allLayouts().find(candidate => candidate.qualifiedName === layoutName);
    if (!layoutInterface) throw new Error(`Layout ${layoutName} not found.`);
    const layout = await layoutInterface.load();
    console.log(JavaScriptSerializer.serializeToJs(layout as any));
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
