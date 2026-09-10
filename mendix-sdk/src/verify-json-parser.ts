/**
 * Checks the JsonElementFactory port in json-structure.ts against JSON structures that were
 * authored in Studio Pro (the ones shipped with the Feedback Marketplace module): parsing their
 * snippet has to reproduce their stored element tree exactly.
 */
import { jsonstructures, mappings, xmlschemas } from "mendixmodelsdk";
import { openWorkingCopy } from "./common";
import { ElementTypeName, JsonNode, parseJsonSnippet, PrimitiveTypeName } from "./json-structure";

interface Flat {
    path: string;
    elementType: string;
    primitiveType: string;
    exposedName: string;
    minOccurs: number;
    maxOccurs: number;
    nillable: boolean;
    maxLength: number;
    originalValue: string;
}

function flattenModel(element: mappings.Element, into: Flat[] = []): Flat[] {
    into.push({
        path: element.path,
        elementType: element.elementType.name,
        primitiveType: element.primitiveType.name,
        exposedName: element.exposedName,
        minOccurs: element.minOccurs,
        maxOccurs: element.maxOccurs,
        nillable: element.nillable,
        maxLength: element.maxLength,
        originalValue: element instanceof jsonstructures.JsonElement ? element.originalValue : ""
    });
    element.children.forEach(child => flattenModel(child, into));
    return into;
}

function flattenParsed(node: JsonNode, into: Flat[] = []): Flat[] {
    into.push({
        path: node.path,
        elementType: node.elementType,
        primitiveType: node.primitiveType ?? "Unknown",
        exposedName: node.exposedName,
        minOccurs: node.minOccurs,
        maxOccurs: node.maxOccurs,
        nillable: node.nillable,
        maxLength: node.maxLength ?? -1,
        originalValue: node.originalValue ?? ""
    });
    node.children.forEach(child => flattenParsed(child, into));
    return into;
}

async function main() {
    const { model } = await openWorkingCopy();
    let failures = 0;

    for (const structure of model.allJsonStructures()) {
        const loaded = await structure.load();
        if (loaded.elements.length === 0 || !loaded.jsonSnippet) {
            continue;
        }
        const expected = flattenModel(loaded.elements[0]);
        const actual = flattenParsed(parseJsonSnippet(loaded.jsonSnippet));
        const same = JSON.stringify(expected) === JSON.stringify(actual);
        console.log(`${same ? "OK  " : "FAIL"}  ${loaded.qualifiedName} (${expected.length} elements)`);
        if (!same) {
            failures++;
            const rows = Math.max(expected.length, actual.length);
            for (let i = 0; i < rows; i++) {
                const e = JSON.stringify(expected[i]);
                const a = JSON.stringify(actual[i]);
                if (e !== a) {
                    console.log(`   expected: ${e}`);
                    console.log(`   actual  : ${a}`);
                }
            }
        }
    }

    if (failures > 0) {
        console.error(`\n${failures} JSON structure(s) did not round-trip.`);
        process.exit(1);
    }
    console.log("\nAll Studio Pro authored JSON structures round-trip through the port.");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
