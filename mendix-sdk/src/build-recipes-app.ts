/**
 * Builds the recipe consumption layer in the Mendix app and commits it to a new Team Server
 * branch. Never commits to `main`.
 *
 * Stories 4 and 5 need everything below the screens as well, because branch `main` holds only the
 * app template: an empty domain model and the stock Home_Web. See `out/01-inventory.md`.
 */
import { IModel, projects, security } from "mendixmodelsdk";
import { MendixPlatformClient } from "mendixplatformsdk";
import { APP_ID, BRANCH, findOwnModule } from "./common";
import { projectLanguages } from "./recipes/builders";
import { buildDomainModel } from "./recipes/domain";
import { buildIntegration } from "./recipes/integration";
import { buildMicroflows, buildShowRecipeMicroflow } from "./recipes/microflows";
import { buildDetailPage, buildHomePage, RecipePagesContext } from "./recipes/pages";

const TARGET_BRANCH = process.env.MENDIX_TARGET_BRANCH ?? "recipes-stories-4-5";
const API_BASE_URL = process.env.RECIPES_API_BASE_URL ?? "http://localhost:8080/mendix-recipes";
const COMMIT_MESSAGE =
    "Add the recipes REST integration, the category-filtered recipe list and the recipe detail page";

/** Removes documents from an earlier run so the script can be run again. */
function removeExisting(model: IModel, module: projects.IModule, names: string[]): string[] {
    const removed: string[] = [];
    for (const document of model.allDocuments()) {
        if (!names.includes(document.name)) continue;
        let container: any = (document as any).container;
        while (container && container.structureTypeName !== "Projects$Module") container = container.container;
        if (container !== module) continue;
        (document as any).delete();
        removed.push(document.name);
    }
    return removed;
}

function userRole(module: projects.IModule): security.IModuleRole {
    const role = module.moduleSecurity.moduleRoles.find(candidate => candidate.name === "User");
    if (role) return role;
    const first = module.moduleSecurity.moduleRoles[0];
    if (!first) throw new Error(`Module ${module.name} has no module roles to grant access to.`);
    return first;
}

async function main(): Promise<void> {
    if (!process.env.MENDIX_TOKEN) throw new Error("MENDIX_TOKEN is not set in the environment.");
    if (TARGET_BRANCH === BRANCH) throw new Error(`Refusing to commit to '${BRANCH}'.`);

    const client = new MendixPlatformClient();
    const app = client.getApp(APP_ID);
    console.log(`Creating a temporary working copy from '${BRANCH}'...`);
    const workingCopy = await app.createTemporaryWorkingCopy(BRANCH);
    const model = await workingCopy.openModel();

    const module = findOwnModule(model);
    const languages = await projectLanguages(model);
    const role = userRole(module);
    console.log(`Module: ${module.name}; languages: ${languages.join(", ")}; module role: ${role.name}`);

    const generated = [
        "RecipesApiBaseUrl",
        "Categories_Response",
        "Recipes_Response",
        "Recipe_Response",
        "Categories_ImportMapping",
        "Recipes_ImportMapping",
        "Recipe_ImportMapping",
        "DS_HomeContext",
        "DS_Categories",
        "DS_Recipes",
        "DS_RecipeSteps",
        "DS_RecipeIngredients",
        "DS_RecipeCategories",
        "ACT_SelectCategory",
        "ACT_ShowAllRecipes",
        "ACT_ShowRecipe",
        "Recipe_Detail"
    ];
    const removed = removeExisting(model, module, generated);
    if (removed.length > 0) console.log(`Replacing existing documents: ${removed.join(", ")}`);

    console.log("Building the domain model...");
    const domain = await buildDomainModel(module, role);

    console.log("Building the constant, JSON structures and import mappings...");
    const integration = buildIntegration(module, domain, API_BASE_URL);

    console.log("Building the microflows...");
    const microflowContext = { container: module, languages, domain, integration, role };
    const flows = buildMicroflows(microflowContext);

    console.log("Building the pages...");
    const pageContext: RecipePagesContext = { model, module, languages, domain, flows, role };
    const detail = await buildDetailPage(pageContext);
    const showRecipe = buildShowRecipeMicroflow(microflowContext, detail.page, detail.parameter);

    const home = model.allPages().find(page => page.qualifiedName === `${module.name}.Home_Web`);
    if (!home) throw new Error(`Page ${module.name}.Home_Web not found.`);
    const loadedHome = await home.load();
    await buildHomePage(pageContext, loadedHome, showRecipe);

    console.log("Flushing changes...");
    await model.flushChanges();

    console.log(`Committing to branch '${TARGET_BRANCH}'...`);
    await workingCopy.commitToRepository(TARGET_BRANCH, { commitMessage: COMMIT_MESSAGE, force: true });
    console.log(`Committed to '${TARGET_BRANCH}'.`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
