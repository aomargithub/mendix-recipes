/**
 * Read-only probe. `JavaScriptSerializer` cannot express cross-unit references, so the
 * serialized reference documents show a blank `PageVariable` where Studio Pro may in fact
 * store a reference. This reads the live model to see what is really set.
 */
import { microflows, pages } from "mendixmodelsdk";
import { openWorkingCopy } from "./common";

function describePageVariable(variable: pages.PageVariable | null): string {
    if (!variable) return "<none>";
    return [
        `pageParameter=${variable.pageParameter ? variable.pageParameter.name : "<null>"}`,
        `pageParameterLocalName=${JSON.stringify(variable.pageParameterLocalName)}`,
        `widget=${variable.widget ? variable.widget.name : "<null>"}`,
        `widgetLocalName=${JSON.stringify(variable.widgetLocalName)}`,
        `localVariableLocalName=${JSON.stringify(variable.localVariableLocalName)}`,
        `useAllPages=${variable.useAllPages}`,
        `subKey=${JSON.stringify(variable.subKey)}`
    ].join(" ");
}

async function main(): Promise<void> {
    const { model } = await openWorkingCopy();

    const flow = model.allMicroflows().find(m => m.qualifiedName === "Administration.ShowPasswordForm");
    const loadedFlow = await flow!.load();
    for (const object of loadedFlow.objectCollection.objects) {
        const action = (object as microflows.ActionActivity).action;
        if (!(action instanceof microflows.ShowPageAction)) continue;
        console.log(`ShowPageAction -> ${action.pageSettings.pageQualifiedName}`);
        for (const mapping of action.pageSettings.parameterMappings) {
            console.log(`  mapping parameter=${mapping.parameterQualifiedName} argument=${JSON.stringify(mapping.argument)}`);
            console.log(`    variable: ${describePageVariable(mapping.variable)}`);
        }
    }

    const page = model.allPages().find(p => p.qualifiedName === "Administration.MyAccount");
    const loadedPage = await page!.load();
    console.log(`\nPage ${loadedPage.qualifiedName}`);
    for (const parameter of loadedPage.parameters) {
        console.log(`  parameter ${parameter.name} required=${parameter.isRequired} qn=${parameter.qualifiedName}`);
    }
    const walkForDataView = (element: any): void => {
        if (!element || typeof element !== "object") return;
        if (element instanceof pages.DataView && element.dataSource instanceof pages.DataViewSource) {
            const source = element.dataSource;
            console.log(`  DataView "${element.name}" DataViewSource`);
            console.log(`    entityRef=${source.entityRef ? source.entityRef.structureTypeName : "<null>"}`);
            console.log(`    sourceVariable: ${describePageVariable(source.sourceVariable)}`);
        }
        for (const key of ["widgets", "rows", "columns", "arguments", "layoutCall"]) {
            const value = element[key];
            if (Array.isArray(value)) value.forEach(walkForDataView);
            else if (value) walkForDataView(value);
        }
    };
    walkForDataView(loadedPage);
    console.log(`  layoutCall layout=${loadedPage.layoutCall.layoutQualifiedName}`);
    for (const argument of loadedPage.layoutCall.arguments) {
        console.log(`    argument parameterQualifiedName=${argument.parameterQualifiedName} name=${JSON.stringify(argument.parameterName)}`);
    }

    console.log(
        `\nfindLayoutParameterByQualifiedName available: ${typeof (model as any).findLayoutParameterByQualifiedName}`
    );
    console.log(`findPageParameterByQualifiedName available: ${typeof (model as any).findPageParameterByQualifiedName}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
