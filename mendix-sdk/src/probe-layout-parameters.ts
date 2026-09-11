/**
 * Establishes what `parameter` references actually point at, which is not what the metamodel
 * says they point at.
 *
 * `LayoutCallArgument.parameter` is declared to reference a `Pages$LayoutParameter` and
 * `MicroflowCallParameterMapping.parameter` a `Microflows$MicroflowParameter`, but neither class
 * is instantiated anywhere in this app. Layouts hold `Pages$Placeholder` widgets and microflows
 * hold `Microflows$MicroflowParameterObject` boxes, so the SDK's by-name resolver never finds the
 * target and reports references Studio Pro itself wrote as unresolved. Run this before believing
 * an unresolved-reference report.
 */
import { IStructure, microflows, pages } from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";

import { APP_ID, BRANCH } from "./common";

const LAYOUT = "Atlas_Core.Atlas_TopBar";

async function main(): Promise<void> {
    const branch = process.env.MENDIX_TARGET_BRANCH ?? BRANCH;
    const workingCopy = await new MendixPlatformClient().getApp(APP_ID).createTemporaryWorkingCopy(branch);
    const model = await workingCopy.openModel();

    const layoutInterface = model.allLayouts().find(candidate => candidate.qualifiedName === LAYOUT);
    if (!layoutInterface) throw new Error(`Layout ${LAYOUT} not found.`);
    const layout = await layoutInterface.load();

    const placeholders: string[] = [];
    (layout as unknown as IStructure).traverse(structure => {
        if (structure instanceof pages.Placeholder) placeholders.push(structure.name);
        if (structure.structureTypeName === "Pages$LayoutParameter") placeholders.push(`LayoutParameter ${(structure as any).name}`);
    });
    console.log(`${LAYOUT} contains: ${placeholders.join(", ") || "(nothing addressable)"}`);
    console.log(`findLayoutParameterByQualifiedName("${LAYOUT}.Main"): ${model.findLayoutParameterByQualifiedName(`${LAYOUT}.Main`) ? "found" : "null"}`);

    console.log("\nLayout references written by Studio Pro:");
    for (const pageInterface of model.allPages()) {
        if (pageInterface.name !== "Home_Web") continue;
        const page = await pageInterface.load();
        (page as unknown as IStructure).traverse(structure => {
            if (!(structure instanceof pages.LayoutCallArgument)) return;
            const property = (structure as any).__parameter;
            console.log(`    ${page.qualifiedName} -> ${property.qualifiedName()} (resolves: ${property.get() !== null})`);
        });
    }

    console.log("\nMicroflow parameter references written by Studio Pro:");
    let calls = 0;
    for (const microflowInterface of model.allMicroflows()) {
        const microflow = await microflowInterface.load();
        (microflow as unknown as IStructure).traverse(structure => {
            if (!(structure instanceof microflows.MicroflowCallParameterMapping)) return;
            const property = (structure as any).__parameter;
            console.log(`    ${microflow.qualifiedName} -> ${property.qualifiedName()} (resolves: ${property.get() !== null})`);
            calls++;
        });
        if (calls >= 10) break;
    }
    if (calls === 0) console.log("    (no microflow call in this app passes a parameter)");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
