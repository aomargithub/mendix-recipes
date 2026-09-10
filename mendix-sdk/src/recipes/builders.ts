/**
 * Thin helpers over the Model SDK for the constructs the recipe screens use.
 *
 * Every shape here mirrors what Studio Pro itself writes, taken from the Marketplace documents
 * in this app (see `out/90-reference`); the SDK happily accepts structures Studio Pro would
 * never produce, and those only fail later during a consistency check.
 */
import { IModel, datatypes, domainmodels, microflows, pages, settings, texts } from "mendixmodelsdk";

/** Language codes configured for the app, so captions do not end up untranslated. */
export async function projectLanguages(model: IModel): Promise<string[]> {
    for (const projectSettings of model.allProjectSettings()) {
        const loaded = await projectSettings.load();
        for (const part of loaded.settingsParts) {
            if (part instanceof settings.LanguageSettings) {
                const codes = part.languages.map(language => language.code).filter(code => !!code);
                if (codes.length > 0) return codes;
            }
        }
    }
    return ["en_US"];
}

/**
 * Moves the runtime off the port the recipes API listens on. Without this the app will not start
 * locally: both default to 8080, and the API is already there.
 */
export async function setRuntimePort(model: IModel, port: number): Promise<string[]> {
    const changed: string[] = [];
    for (const projectSettings of model.allProjectSettings()) {
        const loaded = await projectSettings.load();
        for (const part of loaded.settingsParts) {
            if (!(part instanceof settings.ConfigurationSettings)) continue;
            for (const configuration of part.configurations) {
                if (configuration.runtimePortNumber === port) continue;
                changed.push(`${configuration.name}: ${configuration.runtimePortNumber} -> ${port}`);
                configuration.runtimePortNumber = port;
            }
        }
    }
    return changed;
}

export function text(model: IModel, languages: string[], value?: string): texts.Text {
    const result = texts.Text.create(model);
    if (value === undefined) return result;
    for (const languageCode of languages) {
        const translation = texts.Translation.create(model);
        translation.languageCode = languageCode;
        translation.text = value;
        result.translations.push(translation);
    }
    return result;
}

export interface TemplateContext {
    model: IModel;
    languages: string[];
}

/**
 * A caption. `template` uses `{1}`, `{2}`, ... for the attributes in `attributes`, which are read
 * from the object the widget sits in.
 */
export function clientTemplate(
    context: TemplateContext,
    template: string,
    attributes: domainmodels.IAttribute[] = []
): pages.ClientTemplate {
    const result = pages.ClientTemplate.create(context.model);
    result.template = text(context.model, context.languages, template);
    for (const attribute of attributes) {
        const attributeRef = domainmodels.AttributeRef.create(context.model);
        attributeRef.attribute = attribute;
        const parameter = pages.ClientTemplateParameter.create(context.model);
        parameter.attributeRef = attributeRef;
        result.parameters.push(parameter);
    }
    result.fallback = text(context.model, context.languages);
    return result;
}

export function dynamicText(
    context: TemplateContext,
    name: string,
    template: string,
    attributes: domainmodels.IAttribute[] = [],
    renderMode: pages.TextRenderMode = pages.TextRenderMode.Text
): pages.DynamicText {
    const widget = pages.DynamicText.create(context.model);
    widget.name = name;
    widget.content = clientTemplate(context, template, attributes);
    widget.renderMode = renderMode;
    return widget;
}

/** A widget's CSS classes live on its appearance; the `class` property itself is long gone. */
export function withClass<T extends pages.Widget>(widget: T, cssClass: string): T {
    const appearance = pages.Appearance.create(widget.model);
    appearance.class = cssClass;
    widget.appearance = appearance;
    return widget;
}

export function column(model: IModel, weight: number, ...widgets: pages.Widget[]): pages.LayoutGridColumn {
    const result = pages.LayoutGridColumn.create(model);
    result.weight = weight;
    widgets.forEach(widget => result.widgets.push(widget));
    return result;
}

export function row(model: IModel, ...columns: pages.LayoutGridColumn[]): pages.LayoutGridRow {
    const result = pages.LayoutGridRow.create(model);
    columns.forEach(item => result.columns.push(item));
    return result;
}

export function layoutGrid(model: IModel, name: string, ...rows: pages.LayoutGridRow[]): pages.LayoutGrid {
    const result = pages.LayoutGrid.create(model);
    result.name = name;
    result.width = pages.ContainerWidth.FullWidth;
    rows.forEach(item => result.rows.push(item));
    return result;
}

export function container(model: IModel, name: string, cssClass: string, ...widgets: pages.Widget[]): pages.DivContainer {
    const result = pages.DivContainer.create(model);
    result.name = name;
    withClass(result, cssClass);
    widgets.forEach(widget => result.widgets.push(widget));
    return result;
}

/** Calls `microflow` from a widget. The enclosing data context supplies the parameters. */
export function microflowClientAction(model: IModel, microflow: microflows.IMicroflow): pages.MicroflowClientAction {
    const settingsElement = pages.MicroflowSettings.create(model);
    settingsElement.microflow = microflow;
    const action = pages.MicroflowClientAction.create(model);
    action.microflowSettings = settingsElement;
    return action;
}

/**
 * References that can only be made once both ends live in the same model unit, so they are
 * collected while the widget tree is assembled and applied after it is attached to its page.
 */
export type DeferredBindings = (() => void)[];

/**
 * Where a data source parameter gets its object from.
 *
 * Studio Pro offers a fixed list of variables at each point on a page and matches a mapping
 * against it by identity, not by entity type, so a mapping is only accepted when it names the
 * variable exactly as Studio Pro would have built it. A data view that reads a page parameter
 * contributes a variable naming *both* the data view and that parameter; a data view fed by
 * anything else contributes one naming the data view alone. Naming only the data view in the
 * first case matches nothing, and the page fails its consistency check with CE0115.
 */
export interface ParameterSource {
    parameterName: string;
    widget: pages.EntityWidget;
    /** Set when `widget` is a data view whose own object comes from a page parameter. */
    pageParameter?: pages.PageParameter;
}

/**
 * A microflow data source. Unlike a client action, which receives the enclosing data context
 * implicitly, a data source names its parameters and says which variable supplies each object.
 */
export function microflowSource(
    model: IModel,
    microflow: microflows.IMicroflow,
    parameterSources: ParameterSource[] = [],
    deferred?: DeferredBindings
): pages.MicroflowSource {
    const settingsElement = pages.MicroflowSettings.create(model);
    settingsElement.microflow = microflow;
    for (const { parameterName, widget, pageParameter } of parameterSources) {
        const mapping = pages.MicroflowParameterMapping.create(model);
        // A microflow parameter is referred to by qualified name. The typed setter wants an
        // `IMicroflowParameter`, which the parameter box in a microflow is not, so the reference
        // is written the way the Model SDK's own serializer writes one it cannot resolve.
        (mapping as any).__parameter.updateWithRawValue(`${microflow.qualifiedName}.${parameterName}`);
        // Mapping a parameter straight onto a widget was dropped in Mendix 8.4; a page variable
        // now stands between the two, and it references its provider by name on the page.
        const variable = pages.PageVariable.create(model);
        mapping.variable = variable;
        settingsElement.parameterMappings.push(mapping);
        if (!deferred) throw new Error("Mapping a data source parameter onto a widget needs a deferred binding list.");
        deferred.push(() => {
            variable.widget = widget;
            if (pageParameter) variable.pageParameter = pageParameter;
        });
    }
    const source = pages.MicroflowSource.create(model);
    source.microflowSettings = settingsElement;
    return source;
}

export function objectType(model: IModel, entity: domainmodels.IEntity): datatypes.ObjectType {
    const type = datatypes.ObjectType.create(model);
    type.entity = entity;
    return type;
}

export function listType(model: IModel, entity: domainmodels.IEntity): datatypes.ListType {
    const type = datatypes.ListType.create(model);
    type.entity = entity;
    return type;
}
