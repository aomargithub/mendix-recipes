/**
 * Reads the committed branch back and checks it.
 *
 * There is no `mx check` here: the Team Server clone needs a scope this token does not have, so
 * there is no .mpr to run the consistency checker over. What is available is the model itself,
 * and the two mistakes an SDK-built model is most likely to contain are both visible in it:
 * a document that was never created, and a reference that names something which does not exist.
 * Studio Pro reports the second as a consistency error; here it is a dangling by-name reference.
 */
import {
    ByNameReferenceListProperty,
    ByNameReferenceProperty,
    IModel,
    IStructure,
    LocalByNameReferenceProperty,
    domainmodels,
    microflows,
    pages,
    projects
} from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";

import { APP_ID, BRANCH, documentsOf, findOwnModule } from "./common";

const TARGET_BRANCH = process.env.MENDIX_TARGET_BRANCH ?? "recipes-stories-4-5";

/** Documents the build is expected to have produced, and the page it rebuilt. */
const EXPECTED_DOCUMENTS = [
    "Categories_ImportMapping",
    "Categories_Response",
    "Recipe_Detail",
    "Recipe_ImportMapping",
    "Recipe_Response",
    "Recipes_ImportMapping",
    "Recipes_Response",
    "ACT_SelectCategory",
    "ACT_ShowAllRecipes",
    "ACT_ShowRecipe",
    "DS_Categories",
    "DS_HomeContext",
    "DS_RecipeCategories",
    "DS_RecipeIngredients",
    "DS_Recipes",
    "DS_RecipeSteps",
    "Home_Web"
];

const EXPECTED_ENTITIES: Record<string, string[]> = {
    HomeContext: ["SelectedCategory"],
    Category: ["Name"],
    RecipeSummary: ["RecipeId", "Name", "DescriptionPrefix", "PreparationTimeInMinutes"],
    RecipeDetail: [
        "RecipeId",
        "Name",
        "Description",
        "Author",
        "PostedAt",
        "PostedTo",
        "PreparationTimeInMinutes"
    ],
    RecipeStep: ["Description"],
    RecipeIngredient: ["Name", "Quantity", "Unit"],
    RecipeCategory: ["Name"]
};

const EXPECTED_ASSOCIATIONS = ["RecipeStep_RecipeDetail", "RecipeIngredient_RecipeDetail", "RecipeCategory_RecipeDetail"];

class Report {
    private readonly failures: string[] = [];

    check(condition: boolean, description: string): void {
        console.log(`${condition ? "  ok  " : "  FAIL"}  ${description}`);
        if (!condition) this.failures.push(description);
    }

    fail(description: string): void {
        console.log(`  FAIL  ${description}`);
        this.failures.push(description);
    }

    summarize(): void {
        console.log("");
        if (this.failures.length === 0) {
            console.log("All checks passed.");
            return;
        }
        console.log(`${this.failures.length} check(s) failed:`);
        this.failures.forEach(failure => console.log(`  - ${failure}`));
        process.exit(1);
    }
}

/**
 * Two reference kinds are declared against a class that Studio Pro never instantiates, so the
 * SDK's resolver cannot follow them and reports even Studio Pro's own references as unresolved
 * (see `probe-layout-parameters.ts`). Both are resolved here against the class that really
 * carries the name, which is what makes the reference valid in the product.
 */
const RESOLVE_BY_HAND: Record<string, (model: IModel, owner: string, name: string) => Promise<boolean>> = {
    "Pages$LayoutParameter": async (model, layoutName, placeholderName) => {
        const layoutInterface = model.allLayouts().find(candidate => candidate.qualifiedName === layoutName);
        if (!layoutInterface) return false;
        const layout = await layoutInterface.load();
        return contains(layout, structure => structure instanceof pages.Placeholder && structure.name === placeholderName);
    },
    "Microflows$MicroflowParameter": async (model, microflowName, parameterName) => {
        const microflowInterface = model.allMicroflows().find(candidate => candidate.qualifiedName === microflowName);
        if (!microflowInterface) return false;
        const microflow = await microflowInterface.load();
        return microflow.objectCollection.objects.some(
            object => object instanceof microflows.MicroflowParameterObject && object.name === parameterName
        );
    }
};

function contains(root: unknown, predicate: (structure: IStructure) => boolean): boolean {
    return (root as IStructure).traverseFind(structure => (predicate(structure) ? true : null)) === true;
}

async function resolvesByHand(model: IModel, targetType: string, qualifiedName: string): Promise<boolean> {
    const resolver = RESOLVE_BY_HAND[targetType];
    if (!resolver) return false;
    const separator = qualifiedName.lastIndexOf(".");
    if (separator < 0) return false;
    return resolver(model, qualifiedName.slice(0, separator), qualifiedName.slice(separator + 1));
}

/**
 * A by-name reference that holds a name but resolves to nothing. Studio Pro would flag it as
 * "... does not exist"; here it means a builder wrote a name for an element it never created,
 * or wrote it in the wrong unit.
 */
async function danglingReferences(model: IModel, root: IStructure): Promise<string[]> {
    const suspects: { where: string; name: string; targetType: string }[] = [];
    const dangling: string[] = [];

    root.traverse(child => {
        for (const property of child.loadedProperties()) {
            const where = `${child.structureTypeName}.${property.name}`;
            if (property instanceof ByNameReferenceProperty) {
                const name = property.qualifiedName();
                if (name !== null && property.get() === null) {
                    suspects.push({ where, name, targetType: property.targetType });
                }
            } else if (property instanceof LocalByNameReferenceProperty) {
                const name = property.localName();
                if (name !== null && property.get() === null) dangling.push(`${where} -> ${name}`);
            } else if (property instanceof ByNameReferenceListProperty) {
                const names = property.qualifiedNames();
                const resolved = property.get().length;
                if (names.length !== resolved) {
                    dangling.push(`${where} -> ${names.join(", ")} (${resolved} of ${names.length} resolved)`);
                }
            }
        }
    });

    for (const suspect of suspects) {
        if (!(await resolvesByHand(model, suspect.targetType, suspect.name))) {
            dangling.push(`${suspect.where} -> ${suspect.name}`);
        }
    }
    return dangling;
}

async function checkDomainModel(module: projects.IModule, report: Report): Promise<void> {
    console.log("\nDomain model");
    const domainModel = await module.domainModel.load();
    for (const [entityName, attributeNames] of Object.entries(EXPECTED_ENTITIES)) {
        const entity = domainModel.entities.find(candidate => candidate.name === entityName);
        if (!entity) {
            report.fail(`entity ${entityName} exists`);
            continue;
        }
        const generalization = entity.generalization;
        const persistable = generalization instanceof domainmodels.NoGeneralization && generalization.persistable;
        report.check(!persistable, `entity ${entityName} is non-persistable`);
        const missing = attributeNames.filter(name => !entity.attributes.some(a => a.name === name));
        report.check(missing.length === 0, `entity ${entityName} has ${attributeNames.join(", ")}`);
    }
    for (const associationName of EXPECTED_ASSOCIATIONS) {
        const association = domainModel.associations.find(candidate => candidate.name === associationName);
        report.check(association !== undefined, `association ${associationName} exists`);
    }
    // A second build run must replace what the first one made, not add to it.
    report.check(
        domainModel.entities.length === Object.keys(EXPECTED_ENTITIES).length,
        `domain model holds ${Object.keys(EXPECTED_ENTITIES).length} entities (found ${domainModel.entities.length})`
    );
    report.check(
        domainModel.associations.length === EXPECTED_ASSOCIATIONS.length,
        `domain model holds ${EXPECTED_ASSOCIATIONS.length} associations (found ${domainModel.associations.length})`
    );
}

async function checkDocuments(model: IModel, module: projects.IModule, report: Report): Promise<void> {
    console.log("\nDocuments");
    const present = documentsOf(model, module).map(document => document.name);
    for (const expected of EXPECTED_DOCUMENTS) {
        const occurrences = present.filter(name => name === expected).length;
        report.check(occurrences === 1, `document ${expected} exists exactly once (found ${occurrences})`);
    }

    console.log("\nReferences");
    for (const document of documentsOf(model, module)) {
        const loaded = await document.load();
        const dangling = await danglingReferences(model, loaded as unknown as IStructure);
        if (dangling.length === 0) {
            report.check(true, `${document.name}: all references resolve`);
        } else {
            dangling.forEach(reference => report.fail(`${document.name}: unresolved ${reference}`));
        }
    }
}

async function main(): Promise<void> {
    if (!process.env.MENDIX_TOKEN) throw new Error("MENDIX_TOKEN is not set in the environment.");
    if (TARGET_BRANCH === BRANCH) throw new Error(`Refusing to verify '${BRANCH}' as the generated branch.`);

    const client = new MendixPlatformClient();
    const app = client.getApp(APP_ID);
    console.log(`Opening branch '${TARGET_BRANCH}'...`);
    const workingCopy = await app.createTemporaryWorkingCopy(TARGET_BRANCH);
    const model = await workingCopy.openModel();

    const module = findOwnModule(model);
    console.log(`Module: ${module.name}`);

    const report = new Report();
    await checkDomainModel(module, report);
    await checkDocuments(model, module, report);
    report.summarize();
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
