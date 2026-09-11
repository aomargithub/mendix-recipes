import { MendixPlatformClient, OnlineWorkingCopy } from "mendixplatformsdk";
import { IModel, projects } from "mendixmodelsdk";

export const APP_ID = "69590a87-1a06-47a2-8bae-aa407a618aa9";
export const BRANCH = "main";

/** Modules that ship with Mendix or come from the Marketplace; not part of the assignment. */
const PLATFORM_MODULES = new Set([
    "System",
    "Administration",
    "Atlas_Core",
    "Atlas_Web_Content",
    "Atlas_UI_Resources",
    "WebActions",
    "NativeMobileResources",
    "Nanoflow_Commons",
    "Data_Widgets",
    "Communication_Widgets",
    "MxModelReflection",
    "CommunityCommons"
]);

export async function openWorkingCopy(): Promise<{ workingCopy: OnlineWorkingCopy; model: IModel }> {
    if (!process.env.MENDIX_TOKEN) {
        throw new Error("MENDIX_TOKEN is not set in the environment.");
    }
    const client = new MendixPlatformClient();
    const app = client.getApp(APP_ID);
    const workingCopy = await app.createTemporaryWorkingCopy(process.env.MENDIX_BRANCH ?? BRANCH);
    const model = await workingCopy.openModel();
    return { workingCopy, model };
}

export function isOwnModule(module: projects.IModule): boolean {
    return !module.fromAppStore && !PLATFORM_MODULES.has(module.name);
}

/** The single module holding the assignment work. Throws when it cannot be identified. */
export function findOwnModule(model: IModel): projects.IModule {
    const candidates = model.allModules().filter(isOwnModule);
    if (candidates.length === 0) {
        throw new Error("Could not identify an application module in this app.");
    }
    if (candidates.length > 1) {
        const withRecipeDocs = candidates.filter(m =>
            model.allDocuments().some(d => moduleOf(d) === m && /recipe|categor/i.test(d.name))
        );
        if (withRecipeDocs.length === 1) {
            return withRecipeDocs[0];
        }
    }
    return candidates[0];
}

export function moduleOf(document: { container?: unknown }): projects.IModule | null {
    let container: any = (document as any).container ?? (document as any).containerAsFolderBase;
    while (container) {
        if (container.structureTypeName === "Projects$Module") {
            return container as projects.IModule;
        }
        container = container.container ?? container.containerAsFolderBase ?? null;
    }
    return null;
}

export function documentsOf(model: IModel, module: projects.IModule): projects.IDocument[] {
    return model
        .allDocuments()
        .filter(d => moduleOf(d) === module)
        .sort((a, b) => a.name.localeCompare(b.name));
}
