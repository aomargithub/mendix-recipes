import * as fs from "fs";
import * as path from "path";
import { JavaScriptSerializer } from "mendixmodelsdk";
import { openWorkingCopy } from "./common";

/**
 * Serializes a handful of Marketplace documents that already do what we need
 * (JSON structure, import mapping, REST call) so we have a metamodel reference.
 */
const WANTED = [
    "FeedbackModule.JSON_AppInsightsResponse",
    "FeedbackModule.JSON_AppInsightsRequest",
    "FeedbackModule.IMM_PostResponse",
    "FeedbackModule.EXM_PostFeedback",
    "FeedbackModule.SUB_Feedback_SendToServer",
    "FeedbackModule.SUB_Feedback_PostToAppInsights",
    "FeedbackModule.LocalStorageKey",
    "Atlas_Core.DS_Account_CurrentUser",
    // Shows a page that declares a page parameter, i.e. how ShowPageAction hands over an object.
    "Administration.ShowPasswordForm",
    "Administration.ManageMyAccount"
];

const OUT_DIR = path.join(__dirname, "..", "out", "90-reference");

async function main() {
    const { model } = await openWorkingCopy();
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const qualifiedName of WANTED) {
        const document = model.allDocuments().find(d => d.qualifiedName === qualifiedName);
        if (!document) {
            console.log(`!! not found: ${qualifiedName}`);
            continue;
        }
        const loaded = await document.load();
        const js = JavaScriptSerializer.serializeToJs(loaded as any);
        const kind = document.structureTypeName.split("$")[1];
        fs.writeFileSync(path.join(OUT_DIR, `${kind}_${document.name}.js`), js);
        console.log(`wrote ${kind}_${document.name}.js (${js.split("\n").length} lines)`);
    }

    const feedbackModule = model.allModules().find(m => m.name === "FeedbackModule");
    if (feedbackModule) {
        const domainModel = await feedbackModule.domainModel.load();
        fs.writeFileSync(
            path.join(OUT_DIR, "DomainModel_FeedbackModule.js"),
            JavaScriptSerializer.serializeToJs(domainModel as any)
        );
        console.log("wrote DomainModel_FeedbackModule.js");
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
