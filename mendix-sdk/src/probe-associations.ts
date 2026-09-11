/**
 * Read-only probe. `DomainModels$Association` exposes `parent` and `child`, and which end is
 * which decides how the recipe detail entities have to be wired. Existing associations in the
 * app answer that unambiguously.
 */
import { openWorkingCopy } from "./common";

async function main(): Promise<void> {
    const { model } = await openWorkingCopy();

    for (const domainModel of model.allDomainModels()) {
        const loaded = await domainModel.load();
        if (loaded.associations.length === 0 && loaded.crossAssociations.length === 0) continue;
        const moduleName = (loaded.container as any)?.name ?? "?";
        console.log(`\n## ${moduleName}`);
        for (const association of loaded.associations) {
            console.log(
                `  ${association.name}\n` +
                    `      type=${association.type.name} owner=${association.owner.name} ` +
                    `delete=${association.deleteBehavior ? "set" : "-"}\n` +
                    `      parent=${association.parent ? association.parent.name : "?"} ` +
                    `child=${association.child ? association.child.name : "?"}`
            );
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
