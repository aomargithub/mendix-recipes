/**
 * Read-only probe. The Marketplace modules in this app were authored in Studio Pro, so
 * their documents are ground truth for how a construct is meant to look in the model.
 *
 * The open question this answers: when a page calls a microflow that takes parameters,
 * does Studio Pro emit explicit MicroflowParameterMapping elements, or does it rely on
 * the client passing the enclosing data context implicitly?
 */
import { microflows } from "mendixmodelsdk";
import { openWorkingCopy, moduleOf } from "./common";

function ancestry(element: any): string {
    const parts: string[] = [];
    let current = element?.container;
    while (current && parts.length < 10) {
        const kind = String(current.structureTypeName ?? "?").replace(/^[A-Za-z]+\$/, "");
        parts.push(current.name ? `${kind}(${current.name})` : kind);
        current = current.container;
    }
    return parts.reverse().join(" > ");
}

function collectChildKeys(element: any): string[] {
    const keys = new Set<string>();
    let proto = Object.getPrototypeOf(element);
    while (proto && proto.constructor && proto.constructor.name !== "Object") {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === "constructor" || key.startsWith("containerAs")) continue;
            if (key.endsWith("QualifiedName") || key.endsWith("QualifiedNames")) continue;
            const descriptor = Object.getOwnPropertyDescriptor(proto, key);
            if (descriptor && typeof descriptor.get === "function") keys.add(key);
        }
        proto = Object.getPrototypeOf(proto);
    }
    for (const skip of ["container", "unit", "model", "qualifiedName"]) keys.delete(skip);
    return [...keys];
}

function describeParameters(flow: any): string {
    if (!flow) return "<unresolved microflow>";
    let objectParameters: microflows.MicroflowParameterObject[];
    try {
        objectParameters = flow.objectCollection.objects.filter(
            (o: any) => o.structureTypeName === "Microflows$MicroflowParameterObject"
        );
    } catch (error) {
        return `<could not read parameters: ${(error as Error).message}>`;
    }
    if (objectParameters.length === 0) return "(no parameters)";
    return objectParameters
        .map((p: any) => `${p.name}: ${p.variableType ? p.variableType.structureTypeName : "?"}`)
        .join(", ");
}

const withParameters: string[] = [];
let settingsSeen = 0;
let settingsWithParameterisedFlow = 0;

function walk(element: any, unitName: string, seen: Set<any>): void {
    if (!element || typeof element !== "object" || seen.has(element)) return;
    seen.add(element);

    if (element.structureTypeName === "Pages$MicroflowSettings") {
        settingsSeen++;
        const flow = element.microflow;
        const parameters = describeParameters(flow);
        if (parameters !== "(no parameters)" && !parameters.startsWith("<")) {
            settingsWithParameterisedFlow++;
            withParameters.push(
                [
                    `--- ${unitName}`,
                    `    at              : ${ancestry(element)}`,
                    `    microflow       : ${element.microflowQualifiedName}`,
                    `    parameters      : ${parameters}`,
                    `    parameterMappings: ${element.parameterMappings.length}`,
                    ...element.parameterMappings.map(
                        (m: any) =>
                            `        -> ${m.parameterQualifiedName} expression=${JSON.stringify(m.expression)} ` +
                            `widget=${m.widget ? m.widget.name : "<none>"} localName=${JSON.stringify(m.widgetLocalName)}`
                    )
                ].join("\n")
            );
        }
    }

    for (const key of collectChildKeys(element)) {
        let value: any;
        try {
            value = element[key];
        } catch {
            continue;
        }
        if (!value || typeof value !== "object") continue;
        if (Array.isArray(value)) value.forEach(item => walk(item, unitName, seen));
        else if (value.structureTypeName) walk(value, unitName, seen);
    }
}

async function main(): Promise<void> {
    const { model } = await openWorkingCopy();

    // Microflows have to be loaded before their parameter objects can be inspected.
    for (const flow of model.allMicroflows()) {
        try {
            await flow.load();
        } catch {
            /* ignore */
        }
    }

    for (const unit of [...model.allPages(), ...model.allSnippets(), ...model.allBuildingBlocks()]) {
        const module = moduleOf(unit as any);
        const unitName = `${module ? module.name : "?"}.${unit.name}`;
        try {
            await unit.load();
            walk(unit, unitName, new Set());
        } catch (error) {
            console.log(`(skipped ${unitName}: ${(error as Error).message})`);
        }
    }

    console.log(withParameters.join("\n\n"));
    console.log(
        `\nMicroflowSettings seen: ${settingsSeen}, of which the microflow takes parameters: ${settingsWithParameterisedFlow}`
    );
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
