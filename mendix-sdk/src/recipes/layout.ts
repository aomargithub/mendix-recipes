/**
 * Strips the chrome the recipes app has no use for out of the shared top bar.
 *
 * The feedback button and the language selector are snippet calls that Atlas puts in
 * `Atlas_Core.Atlas_TopBar` itself, so they can only be removed there. That layout belongs to a
 * Marketplace module: updating Atlas_Core from the Marketplace will put them back, and this
 * function has to be run again. Removing them from a copy of the layout instead would avoid that,
 * but a copy is a thousand lines of widget tree to keep in step with Atlas by hand.
 */
import { IModel, pages } from "mendixmodelsdk";

const UNWANTED_SNIPPETS = ["Atlas_Core.FeedbackWidget", "Atlas_Core.LanguageSelectorWidget"];

export async function removeTopBarChrome(model: IModel, layoutName: string): Promise<string[]> {
    const layoutInterface = model.allLayouts().find(candidate => candidate.qualifiedName === layoutName);
    if (!layoutInterface) throw new Error(`Layout ${layoutName} not found.`);
    const layout = await layoutInterface.load();

    const doomed: pages.SnippetCallWidget[] = [];
    layout.traverse(structure => {
        if (!(structure instanceof pages.SnippetCallWidget)) return;
        const snippet = structure.snippetCall?.snippet?.qualifiedName;
        if (snippet && UNWANTED_SNIPPETS.includes(snippet)) doomed.push(structure);
    });

    const removed: string[] = [];
    for (const widget of doomed) {
        const snippet = widget.snippetCall.snippet?.qualifiedName;
        // The language selector sits alone in a container that exists only to push it to the
        // right-hand end of the bar; left behind, that container is an empty div in every page.
        const parent = widget.container;
        removed.push(`${layoutName}/${widget.name} -> ${snippet}`);
        widget.delete();
        if (parent instanceof pages.DivContainer && parent.widgets.length === 0) {
            removed.push(`${layoutName}/${parent.name} (left empty)`);
            parent.delete();
        }
    }
    return removed;
}
