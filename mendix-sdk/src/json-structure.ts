/**
 * Port of Studio Pro's `Mendix.Modeler.Integration.JsonElementFactory`.
 *
 * Studio Pro derives the element tree of a JSON structure from its JSON snippet, and an import
 * mapping is only consistent when every mapping element repeats the element type, occurrence,
 * nillability, custom name and path of the JSON element it maps. Deriving the tree the same way
 * Studio Pro does keeps a model that the SDK writes indistinguishable from a hand-modelled one,
 * and keeps it stable when someone later re-parses the snippet in Studio Pro.
 */

export type ElementTypeName = "Object" | "Array" | "Wrapper" | "Value" | "Undefined";

export type PrimitiveTypeName = "String" | "Integer" | "Long" | "Decimal" | "Boolean" | "DateTime" | "Unknown";

export interface JsonNode {
    path: string;
    elementType: ElementTypeName;
    exposedName: string;
    primitiveType?: PrimitiveTypeName;
    minOccurs: number;
    /** -1 means unbounded. */
    maxOccurs: number;
    nillable: boolean;
    maxLength?: number;
    originalValue?: string;
    children: JsonNode[];
}

type JsonValue =
    | { kind: "object"; entries: [string, JsonValue][] }
    | { kind: "array"; items: JsonValue[] }
    | { kind: "string"; value: string }
    | { kind: "number"; raw: string }
    | { kind: "boolean"; value: boolean }
    | { kind: "null" };

const ISO8601_WITH_DECIMALS = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,16}(?:Z|[+-]\d{2}:\d{2})/;

/** Reads JSON while preserving key order and the literal spelling of numbers. */
function readJson(text: string): JsonValue {
    let index = 0;

    function skipWhitespace() {
        while (index < text.length && /\s/.test(text[index])) {
            index++;
        }
    }

    function expect(character: string) {
        if (text[index] !== character) {
            throw new Error(`Expected '${character}' at position ${index} of the JSON snippet.`);
        }
        index++;
    }

    function readString(): string {
        expect('"');
        let result = "";
        while (text[index] !== '"') {
            if (text[index] === "\\") {
                const escape = text[index + 1];
                index += 2;
                switch (escape) {
                    case "n": result += "\n"; break;
                    case "r": result += "\r"; break;
                    case "t": result += "\t"; break;
                    case "b": result += "\b"; break;
                    case "f": result += "\f"; break;
                    case "u":
                        result += String.fromCharCode(parseInt(text.substr(index, 4), 16));
                        index += 4;
                        break;
                    default: result += escape;
                }
            } else {
                result += text[index++];
            }
        }
        expect('"');
        return result;
    }

    function readValue(): JsonValue {
        skipWhitespace();
        const character = text[index];
        if (character === "{") {
            index++;
            const entries: [string, JsonValue][] = [];
            skipWhitespace();
            if (text[index] === "}") {
                index++;
                return { kind: "object", entries };
            }
            for (;;) {
                skipWhitespace();
                const key = readString();
                skipWhitespace();
                expect(":");
                entries.push([key, readValue()]);
                skipWhitespace();
                if (text[index] === ",") {
                    index++;
                    continue;
                }
                expect("}");
                return { kind: "object", entries };
            }
        }
        if (character === "[") {
            index++;
            const items: JsonValue[] = [];
            skipWhitespace();
            if (text[index] === "]") {
                index++;
                return { kind: "array", items };
            }
            for (;;) {
                items.push(readValue());
                skipWhitespace();
                if (text[index] === ",") {
                    index++;
                    continue;
                }
                expect("]");
                return { kind: "array", items };
            }
        }
        if (character === '"') {
            return { kind: "string", value: readString() };
        }
        if (text.startsWith("true", index)) {
            index += 4;
            return { kind: "boolean", value: true };
        }
        if (text.startsWith("false", index)) {
            index += 5;
            return { kind: "boolean", value: false };
        }
        if (text.startsWith("null", index)) {
            index += 4;
            return { kind: "null" };
        }
        const start = index;
        while (index < text.length && /[-+0-9.eE]/.test(text[index])) {
            index++;
        }
        if (start === index) {
            throw new Error(`Unexpected character '${character}' at position ${index} of the JSON snippet.`);
        }
        return { kind: "number", raw: text.slice(start, index) };
    }

    const value = readValue();
    skipWhitespace();
    if (index !== text.length) {
        throw new Error("Trailing content after the JSON snippet.");
    }
    return value;
}

function upperCaseFirst(value: string): string {
    return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/**
 * Studio Pro rejects an element whose custom name is a Java or Mendix reserved word, and reports
 * it as a character-set problem, which is what makes it confusing: `id` is rejected while `name`
 * is not. `Mendix.Common.JavaReservedWords` and `MendixReservedWords`, matched case-insensitively.
 */
const RESERVED_WORDS = new Set(
    [
        "_", "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
        "com", "const", "continue", "default", "do", "double", "else", "enum", "extends", "false",
        "final", "finally", "float", "for", "if", "goto", "implements", "import", "instanceof", "int",
        "interface", "long", "native", "new", "null", "package", "private", "protected", "public", "return",
        "short", "static", "strictfp", "super", "switch", "synchronized", "this", "throw", "throws", "transient",
        "true", "try", "void", "volatile", "while",
        "MendixObject", "__filename__", "changedby", "changeddate", "context", "createddate", "currentUser",
        "empty", "guid", "id", "object", "owner", "submetaobjectname", "type", "con"
    ].map(word => word.toLowerCase())
);

/** Port of `NameUtil.ReplaceInvalidChars(name, checkForReservedWords: true)`. */
function replaceInvalidChars(value: string): string {
    let name = /^\d/.test(value) ? `_${value}` : value;
    name = name.replace(/[^A-Za-z0-9_]/g, "_");
    while (RESERVED_WORDS.has(name.toLowerCase())) {
        name = `_${name}`;
    }
    return name;
}

/** Enough of Humanizer's inflector for the field names this app maps. */
function singularize(value: string): string {
    if (/[^aeiou]ies$/i.test(value)) {
        return value.slice(0, -3) + "y";
    }
    if (/(s|x|z|ch|sh)es$/i.test(value)) {
        return value.slice(0, -2);
    }
    if (/[^s]s$/i.test(value)) {
        return value.slice(0, -1);
    }
    return value;
}

function uniqueName(proposed: string, taken: Set<string>): string {
    if (!taken.has(proposed)) {
        taken.add(proposed);
        return proposed;
    }
    for (let suffix = 2; ; suffix++) {
        const candidate = `${proposed}_${suffix}`;
        if (!taken.has(candidate)) {
            taken.add(candidate);
            return candidate;
        }
    }
}

function originalName(name: string | null, container: JsonNode | null, elementType: ElementTypeName): string {
    if (name === null || container === null) {
        return `(${elementType})`;
    }
    return name === "" ? "(Empty)" : name;
}

function childPath(container: JsonNode | null, name: string): string {
    return container === null ? name : `${container.path}|${name}`;
}

function exposedNameFor(
    container: JsonNode | null,
    parentOfContainer: JsonNode | null,
    name: string | null,
    elementType: ElementTypeName,
    taken: Set<string>
): string {
    const singularizedFromParent = (): string | null => {
        if (container === null || parentOfContainer === null) {
            return null;
        }
        if (container.elementType === "Array" && parentOfContainer.elementType === "Array") {
            return null;
        }
        const singular = singularize(container.exposedName);
        return singular === container.exposedName ? `${singular}Item` : singular;
    };

    const blank = name === null || name.trim() === "";
    let proposed: string;
    switch (elementType) {
        case "Undefined":
            proposed = blank ? "Unknown" : name!;
            break;
        case "Object":
            proposed = blank ? singularizedFromParent() ?? "JsonObject" : name!;
            break;
        case "Wrapper":
            proposed = singularizedFromParent() ?? "Wrapper";
            break;
        case "Array":
            proposed = blank ? singularizedFromParent() ?? "JsonArray" : name!;
            break;
        case "Value":
            proposed = !blank ? name! : container !== null && container.elementType === "Wrapper" ? "Value" : "Empty";
            break;
    }
    const cleaned = upperCaseFirst(replaceInvalidChars(proposed));
    return elementType === "Value" ? cleaned : uniqueName(cleaned, taken);
}

function primitiveOf(value: JsonValue): { primitiveType: PrimitiveTypeName; originalValue: string; isString: boolean } {
    switch (value.kind) {
        case "string": {
            if (ISO8601_WITH_DECIMALS.test(value.value)) {
                const parsed = new Date(value.value);
                if (!isNaN(parsed.getTime())) {
                    return {
                        primitiveType: "DateTime",
                        originalValue: `"${parsed.toISOString().replace("Z", "0000Z")}"`,
                        isString: false
                    };
                }
            }
            return { primitiveType: "String", originalValue: JSON.stringify(value.value), isString: true };
        }
        case "number": {
            const isInteger = !/[.eE]/.test(value.raw);
            if (isInteger) {
                const asNumber = Number(value.raw);
                const fitsInt32 = Number.isSafeInteger(asNumber) && asNumber >= -2147483648 && asNumber <= 2147483647;
                return { primitiveType: fitsInt32 ? "Integer" : "Long", originalValue: value.raw, isString: false };
            }
            return { primitiveType: "Decimal", originalValue: value.raw, isString: false };
        }
        case "boolean":
            return { primitiveType: "Boolean", originalValue: value.value ? "true" : "false", isString: false };
        default:
            return { primitiveType: "Unknown", originalValue: "null", isString: false };
    }
}

/** Builds the element tree Studio Pro would derive from `snippet`. */
export function parseJsonSnippet(snippet: string): JsonNode {
    const root = readElement(readJson(snippet), null, null, "Root", new Set<string>());
    if (root === null) {
        throw new Error("A JSON snippet must have an object or array as its root.");
    }
    return root;
}

function readElement(
    value: JsonValue,
    container: JsonNode | null,
    parentOfContainer: JsonNode | null,
    name: string | null,
    taken: Set<string>
): JsonNode | null {
    if (value.kind === "object") {
        return readObject(value, container, parentOfContainer, name, taken);
    }
    if (value.kind === "array") {
        return readArray(value, container, parentOfContainer, name, taken);
    }
    if (container === null) {
        return null;
    }
    return container.elementType === "Array"
        ? readPrimitiveArrayItem(value, container, parentOfContainer, taken)
        : readPrimitive(value, container, name, name, taken);
}

function createChild(
    container: JsonNode | null,
    path: string,
    exposedName: string,
    elementType: ElementTypeName,
    minOccurs: number,
    maxOccurs: number
): JsonNode {
    return { path, exposedName, elementType, minOccurs, maxOccurs, nillable: true, children: [] };
}

function occurrence(container: JsonNode | null): { minOccurs: number; maxOccurs: number } {
    return {
        minOccurs: container === null ? 1 : 0,
        maxOccurs: container === null || container.elementType !== "Array" ? 1 : -1
    };
}

/** Mirrors `AddOrReplace`: repeated array items merge into the first item's element. */
function addOrReplace(container: JsonNode, element: JsonNode) {
    const existing = container.children.find(child => child.path === element.path);
    if (existing === undefined) {
        container.children.push(element);
        return;
    }
    if (existing.elementType === "Value" && existing.primitiveType === "Unknown") {
        container.children[container.children.indexOf(existing)] = element;
    }
}

function readObject(
    value: Extract<JsonValue, { kind: "object" }>,
    container: JsonNode | null,
    parentOfContainer: JsonNode | null,
    name: string | null,
    taken: Set<string>
): JsonNode {
    const { minOccurs, maxOccurs } = occurrence(container);
    const node = createChild(
        container,
        childPath(container, originalName(name, container, "Object")),
        exposedNameFor(container, parentOfContainer, name, "Object", taken),
        "Object",
        minOccurs,
        maxOccurs
    );
    for (const [key, child] of value.entries) {
        const childNode = readElement(child, node, container, key, taken);
        if (childNode !== null) {
            addOrReplace(node, childNode);
        }
    }
    return node;
}

function readArray(
    value: Extract<JsonValue, { kind: "array" }>,
    container: JsonNode | null,
    parentOfContainer: JsonNode | null,
    name: string | null,
    taken: Set<string>
): JsonNode {
    const { minOccurs, maxOccurs } = occurrence(container);
    const node = createChild(
        container,
        childPath(container, originalName(name, container, "Array")),
        exposedNameFor(container, parentOfContainer, name, "Array", taken),
        "Array",
        minOccurs,
        maxOccurs
    );
    for (const item of value.items) {
        const itemTaken = node.children.length === 0 ? taken : new Set<string>();
        const itemNode = readElement(item, node, container, null, itemTaken);
        if (itemNode !== null) {
            addOrReplace(node, itemNode);
        }
    }
    return node;
}

function readPrimitiveArrayItem(
    value: JsonValue,
    container: JsonNode,
    parentOfContainer: JsonNode | null,
    taken: Set<string>
): JsonNode {
    const node = createChild(
        container,
        childPath(container, originalName(null, container, "Wrapper")),
        exposedNameFor(container, parentOfContainer, null, "Wrapper", taken),
        "Wrapper",
        container === null ? 1 : 0,
        -1
    );
    node.children.push(readPrimitive(value, node, null, null, taken));
    return node;
}

function readPrimitive(
    value: JsonValue,
    container: JsonNode,
    name: string | null,
    proposedExposedName: string | null,
    taken: Set<string>
): JsonNode {
    const { primitiveType, originalValue, isString } = primitiveOf(value);
    const node: JsonNode = {
        path: childPath(container, originalName(name, container, "Value")),
        exposedName: exposedNameFor(container, null, proposedExposedName, "Value", taken),
        elementType: "Value",
        primitiveType,
        minOccurs: 0,
        maxOccurs: 1,
        nillable: true,
        originalValue,
        children: []
    };
    if (isString) {
        node.maxLength = 0;
    }
    return node;
}

/** Formats a snippet the way Studio Pro's "Format JSON" would. */
export function beautify(json: unknown): string {
    return JSON.stringify(json, null, 4).replace(/\n/g, "\r\n");
}

export function walk(node: JsonNode, visit: (node: JsonNode) => void) {
    visit(node);
    node.children.forEach(child => walk(child, visit));
}

export function findByPath(root: JsonNode, path: string): JsonNode {
    let found: JsonNode | undefined;
    walk(root, node => {
        if (node.path === path) {
            found = node;
        }
    });
    if (found === undefined) {
        throw new Error(`No JSON element with path '${path}'. Available: ${describe(root)}`);
    }
    return found;
}

export function describe(root: JsonNode): string {
    const lines: string[] = [];
    walk(root, node =>
        lines.push(
            `${node.path}  [${node.elementType}` +
                `${node.primitiveType ? "/" + node.primitiveType : ""}` +
                `, ${node.minOccurs}..${node.maxOccurs === -1 ? "*" : node.maxOccurs}` +
                `, name=${node.exposedName}]`
        )
    );
    return "\n" + lines.join("\n");
}
