import * as fs from "fs";
import * as path from "path";
import { JavaScriptSerializer, domainmodels, projects } from "mendixmodelsdk";
import { documentsOf, findOwnModule, isOwnModule, moduleOf, openWorkingCopy } from "./common";

const OUT_DIR = path.join(__dirname, "..", "out");

function write(relativePath: string, contents: string) {
    const target = path.join(OUT_DIR, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
}

function describeAttributeType(type: domainmodels.IAttributeType): string {
    if (type instanceof domainmodels.StringAttributeType) {
        return `String(${type.length})`;
    }
    if (type instanceof domainmodels.EnumerationAttributeType) {
        return `Enum(${type.enumeration?.qualifiedName ?? "?"})`;
    }
    return type.structureTypeName.replace("DomainModels$", "").replace("AttributeType", "");
}

async function dumpDomainModel(module: projects.IModule, lines: string[]) {
    const domainModel = await module.domainModel.load();
    lines.push(`# Domain model of ${module.name}`, "");
    if (domainModel.entities.length === 0) {
        lines.push("_(no entities)_", "");
    }
    for (const entity of domainModel.entities) {
        const persistable =
            entity.generalization instanceof domainmodels.NoGeneralization
                ? ` (persistable: ${entity.generalization.persistable})`
                : "";
        const generalization =
            entity.generalization instanceof domainmodels.Generalization
                ? ` extends ${entity.generalization.generalizationQualifiedName}`
                : "";
        lines.push(`## Entity ${entity.name}${generalization}${persistable}`);
        for (const attribute of entity.attributes) {
            lines.push(`  - ${attribute.name}: ${describeAttributeType(attribute.type)}`);
        }
        if (entity.attributes.length === 0) {
            lines.push("  _(no attributes)_");
        }
        lines.push("");
    }
    for (const association of domainModel.associations) {
        lines.push(
            `## Association ${association.name}: ${association.parent.name} -> ${association.child.name} ` +
                `[${association.type}, owner=${association.owner}]`
        );
    }
    lines.push("");
}

function documentKind(document: { structureTypeName: string }): string {
    return document.structureTypeName.split("$")[1] ?? document.structureTypeName;
}

async function main() {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });

    console.log("Creating temporary working copy of branch 'main'...");
    const { workingCopy, model } = await openWorkingCopy();
    console.log(`Working copy id: ${workingCopy.workingCopyId}`);

    const inventory: string[] = [];
    inventory.push("# Module / document inventory", "");
    for (const module of model.allModules().sort((a, b) => a.name.localeCompare(b.name))) {
        const documents = documentsOf(model, module);
        const tag = module.fromAppStore ? "(Marketplace)" : isOwnModule(module) ? "**[own module]**" : "(platform)";
        inventory.push(`## ${module.name} ${tag} - ${documents.length} document(s)`);
        for (const document of documents) {
            inventory.push(`  - ${documentKind(document)}: ${document.name}`);
        }
        inventory.push("");
    }

    inventory.push("## Project-level documents", "");
    for (const document of model.allProjectDocuments()) {
        inventory.push(`  - ${documentKind(document)}: ${(document as any).name ?? "(unnamed)"}`);
    }
    inventory.push("");

    write("01-inventory.md", inventory.join("\n"));
    console.log(inventory.join("\n"));

    const ownModule = findOwnModule(model);
    console.log(`\n=== Own module: ${ownModule.name} ===\n`);

    const domainLines: string[] = [];
    await dumpDomainModel(ownModule, domainLines);
    write("02-domain-model.md", domainLines.join("\n"));
    console.log(domainLines.join("\n"));

    for (const document of documentsOf(model, ownModule)) {
        const kind = documentKind(document);
        console.log(`\n${"=".repeat(100)}\n=== ${kind}: ${document.name}\n${"=".repeat(100)}\n`);
        if (kind === "ImageCollection") {
            // Serializing these only yields megabytes of base64 image data.
            const loaded = (await document.load()) as any;
            console.log(`(${loaded.images.length} images, base64 payloads omitted)`);
            write(
                `03-documents/${kind}_${document.name}.txt`,
                loaded.images.map((i: any) => i.name).join("\n") + "\n"
            );
            continue;
        }
        const loaded = await document.load();
        const js = JavaScriptSerializer.serializeToJs(loaded as any);
        write(`03-documents/${kind}_${document.name}.js`, js);
        console.log(js);
    }

    const navigation = model.allNavigationDocuments()[0];
    if (navigation) {
        const loaded = await navigation.load();
        const js = JavaScriptSerializer.serializeToJs(loaded as any);
        write("04-navigation.js", js);
        console.log(`\n${"=".repeat(100)}\n=== Navigation\n${"=".repeat(100)}\n`);
        console.log(js);
    }

    const constants = model.allConstants().filter(c => moduleOf(c) === ownModule);
    for (const constant of constants) {
        const loaded = await constant.load();
        console.log(`\nConstant ${loaded.qualifiedName}: defaultValue="${loaded.defaultValue}"`);
    }

    console.log(`\nWrote inspection output to ${OUT_DIR}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
