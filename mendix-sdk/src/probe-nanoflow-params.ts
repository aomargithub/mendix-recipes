/**
 * Read-only probe. The Feedback Module is the most recently authored content in this app, so its
 * nanoflow data sources and client actions show how current Studio Pro passes parameters into a
 * flow that is called from a page: implicitly from the enclosing data context, or through an
 * explicit parameter mapping.
 */
import { openWorkingCopy, moduleOf } from "./common";

function ancestry(element: any): string {
    const parts: string[] = [];
    let current = element?.container;
    while (current && parts.length < 8) {
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

function parametersOf(flow: any): string {
    if (!flow) return "<unresolved>";
    try {
        const parameters = flow.objectCollection.objects.filter((o: any) =>
            String(o.structureTypeName).endsWith("ParameterObject")
        );
        return parameters.length === 0 ? "(none)" : parameters.map((p: any) => p.name).join(", ");
    } catch (error) {
        return `<${(error as Error).message}>`;
    }
}

const findings: string[] = [];
let withParameters = 0;
let withMappings = 0;

function walk(element: any, unitName: string, seen: Set<any>): void {
    if (!element || typeof element !== "object" || seen.has(element)) return;
    seen.add(element);

    const type = String(element.structureTypeName ?? "");
    if (Array.isArray(element.parameterMappings) && (element.nanoflow !== undefined || element.microflow !== undefined)) {
        const flow = element.nanoflow ?? element.microflow;
        const parameters = parametersOf(flow);
        if (parameters !== "(none)" && !parameters.startsWith("<")) {
            withParameters++;
            const mappings = element.parameterMappings;
            if (mappings.length > 0) withMappings++;
            findings.push(
                [
                    `--- ${unitName} [${type.replace("Pages$", "")}]`,
                    `    at        : ${ancestry(element)}`,
                    `    flow      : ${element.nanoflowQualifiedName ?? element.microflowQualifiedName}`,
                    `    parameters: ${parameters}`,
                    `    mappings  : ${mappings.length}`,
                    ...mappings.map(
                        (m: any) =>
                            `        -> ${m.parameterQualifiedName} expression=${JSON.stringify(m.expression)} ` +
                            `widget=${m.widget ? m.widget.name : "<none>"} localName=${JSON.stringify(m.widgetLocalName)} ` +
                            `variable=${m.variable ? "set" : "<none>"}`
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
    for (const flow of [...model.allNanoflows(), ...model.allMicroflows()]) {
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

    console.log(findings.join("\n\n"));
    console.log(`\nCalls to a flow that takes parameters: ${withParameters}; of those with explicit mappings: ${withMappings}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
