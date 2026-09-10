/**
 * The two recipe screens.
 *
 * Home_Web (story 4) keeps the category list on the left and the recipe list on the right, both
 * inside one data view over a `HomeContext` object. That object is what ties the two together:
 * clicking a category writes onto it and refreshes it, which re-runs the recipe list's data
 * source. Recipe_Detail (story 5) takes a `RecipeDetail` as its page parameter.
 *
 * Only built-in widgets are used. The Atlas gallery would look nicer, but it is a pluggable
 * widget whose entire property schema has to be restated in the model, and a list view expresses
 * the same thing with far less that can silently drift out of sync.
 */
import { IModel, domainmodels, microflows, pages, projects, security } from "mendixmodelsdk";
import {
    DeferredBindings,
    TemplateContext,
    actionButton,
    column,
    container as divContainer,
    datePicker,
    dropDown,
    dynamicText,
    layoutGrid,
    microflowClientAction,
    microflowSource,
    objectType,
    row,
    text,
    textArea,
    textBox,
    withClass
} from "./builders";
import { RecipeDomain } from "./domain";
import { RecipeMicroflows } from "./microflows";

export const LAYOUT = "Atlas_Core.Atlas_TopBar";
const LAYOUT_CONTENT_PLACEHOLDER = "Main";

function attributeOf(entity: domainmodels.Entity, name: string): domainmodels.IAttribute {
    const attribute = entity.attributes.find(candidate => candidate.name === name);
    if (!attribute) throw new Error(`Entity ${entity.name} has no attribute ${name}.`);
    return attribute;
}

/**
 * Drops `content` into the layout's main placeholder. The placeholder is addressed by name
 * rather than by element: layout parameters are not exposed as a collection on `Layout`, so
 * the raw by-name reference is the only handle on them, which is what Studio Pro writes too.
 */
function layoutCall(model: IModel, content: pages.Widget): pages.LayoutCall {
    const layout = model.findLayoutByQualifiedName(LAYOUT);
    if (!layout) throw new Error(`Layout ${LAYOUT} not found.`);

    const argument = pages.LayoutCallArgument.create(model);
    (argument as any).__parameter.updateWithRawValue(`${LAYOUT}.${LAYOUT_CONTENT_PLACEHOLDER}`);
    argument.widgets.push(content);

    const call = pages.LayoutCall.create(model);
    call.layout = layout;
    call.arguments.push(argument);
    return call;
}

/**
 * A data view without a footer: nothing on these screens is persisted, so the save and cancel
 * buttons Mendix puts there would commit an object that has no table to go to.
 */
function dataView(model: IModel, name: string, cssClass: string, editability: pages.EditableEnum): pages.DataView {
    const widget = pages.DataView.create(model);
    widget.name = name;
    withClass(widget, cssClass);
    widget.editability = editability;
    widget.showFooter = false;
    return widget;
}

function readOnlyDataView(model: IModel, name: string, cssClass: string): pages.DataView {
    return dataView(model, name, cssClass, pages.EditableEnum.Never);
}

function listView(model: IModel, name: string, cssClass: string): pages.ListView {
    const list = pages.ListView.create(model);
    list.name = name;
    withClass(list, cssClass);
    list.editable = false;
    return list;
}

export interface RecipePagesContext {
    model: IModel;
    module: projects.IModule;
    languages: string[];
    domain: RecipeDomain;
    flows: RecipeMicroflows;
    role: security.IModuleRole;
}

/**
 * Story 4. The stock Home_Web is kept and only its content replaced, so the navigation profile
 * that points at it stays valid.
 */
export async function buildHomePage(
    context: RecipePagesContext,
    home: pages.Page,
    showRecipe: microflows.IMicroflow,
    newRecipe: microflows.IMicroflow
): Promise<void> {
    const { model, languages, domain, flows } = context;
    const templates: TemplateContext = { model, languages };
    const deferred: DeferredBindings = [];

    const homeDataView = readOnlyDataView(model, "homeContextDataView", "recipes-home");
    homeDataView.dataSource = microflowSource(model, flows.dsHomeContext);

    // Left: the categories, plus a way back to the unfiltered list.
    const categoryList = listView(model, "categoryList", "recipes-category-list");
    categoryList.dataSource = microflowSource(model, flows.dsCategories);
    categoryList.clickAction = microflowClientAction(model, flows.actSelectCategory);
    categoryList.widgets.push(
        dynamicText(templates, "categoryName", "{1}", [attributeOf(domain.category, "Name")])
    );

    const showAll = actionButton(
        templates,
        "showAllRecipesButton",
        "All recipes",
        microflowClientAction(model, flows.actShowAllRecipes)
    );

    const leftColumn = column(
        model,
        3,
        divContainer(
            model,
            "categoriesPanel",
            "recipes-panel",
            dynamicText(templates, "categoriesHeader", "Categories", [], pages.TextRenderMode.H2),
            showAll,
            categoryList
        )
    );

    // Right: the recipes, filtered by whatever category sits on the HomeContext.
    const recipeList = listView(model, "recipeList", "recipes-recipe-list");
    recipeList.dataSource = microflowSource(
        model,
        flows.dsRecipes,
        [{ parameterName: flows.dsRecipesHomeContextParameter.name, widget: homeDataView }],
        deferred
    );
    recipeList.clickAction = microflowClientAction(model, showRecipe);
    // Paragraphs, not plain text: a text widget in `Text` mode renders as a span, so the servings
    // and the preparation time ran into each other on one line with nothing between them.
    recipeList.widgets.push(
        dynamicText(templates, "recipeName", "{1}", [attributeOf(domain.recipeSummary, "Name")], pages.TextRenderMode.H3),
        dynamicText(
            templates,
            "recipeDescription",
            "{1}",
            [attributeOf(domain.recipeSummary, "DescriptionPrefix")],
            pages.TextRenderMode.Paragraph
        ),
        dynamicText(
            templates,
            "recipePreparationTime",
            "Ready in {1} minutes",
            [attributeOf(domain.recipeSummary, "PreparationTimeInMinutes")],
            pages.TextRenderMode.Paragraph
        )
    );

    const rightColumn = column(
        model,
        9,
        divContainer(
            model,
            "recipesPanel",
            "recipes-panel",
            dynamicText(
                templates,
                "recipesHeader",
                "Recipes",
                [],
                pages.TextRenderMode.H2
            ),
            actionButton(templates, "addRecipeButton", "Add a recipe", microflowClientAction(model, newRecipe)),
            dynamicText(
                templates,
                "selectedCategory",
                "Filtered by: {1}",
                [attributeOf(domain.homeContext, "SelectedCategory")],
                pages.TextRenderMode.Paragraph
            ),
            recipeList
        )
    );

    const grid = layoutGrid(
        model,
        "homeGrid",
        row(model, column(model, -1, dynamicText(templates, "pageHeader", "Recipes", [], pages.TextRenderMode.H1))),
        row(model, leftColumn, rightColumn)
    );
    homeDataView.widgets.push(grid);

    home.layoutCall = layoutCall(model, homeDataView);
    deferred.forEach(bind => bind());
}

/** Story 5. */
export async function buildDetailPage(
    context: RecipePagesContext
): Promise<{ page: pages.Page; parameter: pages.PageParameter }> {
    const { model, module, languages, domain, flows, role } = context;
    const templates: TemplateContext = { model, languages };
    const deferred: DeferredBindings = [];

    const page = pages.Page.createIn(module);
    page.name = "Recipe_Detail";
    page.title = text(model, languages, "Recipe");
    page.canvasWidth = 1200;
    page.allowedRoles.push(role);

    const pageParameter = pages.PageParameter.createIn(page);
    pageParameter.name = "RecipeDetail";
    pageParameter.parameterType = objectType(model, domain.recipeDetail);

    const pageVariable = pages.PageVariable.create(model);
    deferred.push(() => {
        pageVariable.pageParameter = pageParameter;
    });
    const source = pages.DataViewSource.create(model);
    const entityRef = domainmodels.DirectEntityRef.create(model);
    entityRef.entity = domain.recipeDetail;
    source.entityRef = entityRef;
    source.sourceVariable = pageVariable;

    const dataView = readOnlyDataView(model, "recipeDataView", "recipe-detail");
    dataView.dataSource = source;

    const childList = (
        name: string,
        flow: microflows.Microflow,
        parameter: microflows.MicroflowParameterObject,
        widgets: pages.Widget[]
    ): pages.ListView => {
        const list = listView(model, name, "recipe-detail-list");
        list.dataSource = microflowSource(
            model,
            flow,
            [{ parameterName: parameter.name, widget: dataView, pageParameter }],
            deferred
        );
        widgets.forEach(widget => list.widgets.push(widget));
        return list;
    };

    const stepList = childList("stepList", flows.dsRecipeSteps, flows.dsRecipeStepsParameter, [
        dynamicText(templates, "stepDescription", "{1}", [attributeOf(domain.recipeStep, "Description")])
    ]);
    const ingredientList = childList(
        "ingredientList",
        flows.dsRecipeIngredients,
        flows.dsRecipeIngredientsParameter,
        [
            dynamicText(templates, "ingredient", "{1} {2} {3}", [
                attributeOf(domain.recipeIngredient, "Quantity"),
                attributeOf(domain.recipeIngredient, "Unit"),
                attributeOf(domain.recipeIngredient, "Name")
            ])
        ]
    );
    const categoryList = childList(
        "recipeCategoryList",
        flows.dsRecipeCategories,
        flows.dsRecipeCategoriesParameter,
        [dynamicText(templates, "recipeCategoryName", "{1}", [attributeOf(domain.recipeCategory, "Name")])]
    );

    const back = actionButton(templates, "backButton", "Back", pages.ClosePageClientAction.create(model));

    // As on the home page, each of these is a paragraph so they stack instead of running together.
    const paragraph = (name: string, template: string, attributes: domainmodels.IAttribute[]) =>
        dynamicText(templates, name, template, attributes, pages.TextRenderMode.Paragraph);

    const grid = layoutGrid(
        model,
        "detailGrid",
        row(model, column(model, -1, back)),
        row(
            model,
            column(
                model,
                -1,
                dynamicText(templates, "detailName", "{1}", [attributeOf(domain.recipeDetail, "Name")], pages.TextRenderMode.H1),
                paragraph("detailDescription", "{1}", [attributeOf(domain.recipeDetail, "Description")]),
                paragraph("detailPreparationTime", "Preparation time: {1} minutes", [
                    attributeOf(domain.recipeDetail, "PreparationTimeInMinutes")
                ]),
                paragraph("detailAuthor", "By {1}, posted to {2}", [
                    attributeOf(domain.recipeDetail, "Author"),
                    attributeOf(domain.recipeDetail, "PostedTo")
                ]),
                paragraph("detailPostedAt", "Posted at {1}", [attributeOf(domain.recipeDetail, "PostedAt")])
            )
        ),
        row(
            model,
            column(
                model,
                5,
                divContainer(
                    model,
                    "ingredientsPanel",
                    "recipes-panel",
                    dynamicText(templates, "ingredientsHeader", "Ingredients", [], pages.TextRenderMode.H2),
                    ingredientList
                )
            ),
            column(
                model,
                7,
                divContainer(
                    model,
                    "stepsPanel",
                    "recipes-panel",
                    dynamicText(templates, "stepsHeader", "Steps", [], pages.TextRenderMode.H2),
                    stepList
                )
            )
        ),
        row(
            model,
            column(
                model,
                -1,
                divContainer(
                    model,
                    "recipeCategoriesPanel",
                    "recipes-panel",
                    dynamicText(templates, "recipeCategoriesHeader", "Categories", [], pages.TextRenderMode.H2),
                    categoryList
                )
            )
        )
    );
    dataView.widgets.push(grid);

    page.layoutCall = layoutCall(model, dataView);
    deferred.forEach(bind => bind());

    return { page, parameter: pageParameter };
}

export interface NewRecipePage {
    page: pages.Page;
    newRecipeParameter: pages.PageParameter;
    homeContextParameter: pages.PageParameter;
}

/**
 * The add-recipe form, which posts a `CreateRecipeRequestDto` back to the API.
 *
 * Steps, ingredients and categories are lists the API insists on, so each gets an editable list
 * view with its own add and remove links rather than a text field the user has to guess the
 * separator for. Every row is a non-persistable object hanging off the recipe being edited; none
 * of it is committed, and closing the form throws the lot away.
 */
export async function buildNewRecipePage(context: RecipePagesContext): Promise<NewRecipePage> {
    const { model, module, languages, domain, flows, role } = context;
    const templates: TemplateContext = { model, languages };
    const deferred: DeferredBindings = [];

    const page = pages.Page.createIn(module);
    page.name = "Recipe_New";
    page.title = text(model, languages, "Add a recipe");
    page.canvasWidth = 1200;
    page.allowedRoles.push(role);

    const newRecipeParameter = pages.PageParameter.createIn(page);
    newRecipeParameter.name = "NewRecipe";
    newRecipeParameter.parameterType = objectType(model, domain.newRecipe);

    // Carried along only so that saving can refresh the recipe list the form was opened from.
    const homeContextParameter = pages.PageParameter.createIn(page);
    homeContextParameter.name = "HomeContext";
    homeContextParameter.parameterType = objectType(model, domain.homeContext);

    const pageVariable = pages.PageVariable.create(model);
    deferred.push(() => {
        pageVariable.pageParameter = newRecipeParameter;
    });
    const source = pages.DataViewSource.create(model);
    const entityRef = domainmodels.DirectEntityRef.create(model);
    entityRef.entity = domain.newRecipe;
    source.entityRef = entityRef;
    source.sourceVariable = pageVariable;

    const form = dataView(model, "newRecipeDataView", "recipe-form", pages.EditableEnum.Always);
    form.dataSource = source;

    const field = (name: string, label: string, attribute: string) =>
        textBox(templates, name, label, attributeOf(domain.newRecipe, attribute));

    const detailsColumn = column(
        model,
        6,
        divContainer(
            model,
            "recipeFieldsPanel",
            "recipes-panel",
            dynamicText(templates, "recipeFieldsHeader", "Recipe", [], pages.TextRenderMode.H2),
            field("nameInput", "Name", "Name"),
            textArea(templates, "descriptionInput", "Description", attributeOf(domain.newRecipe, "Description")),
            field("preparationTimeInput", "Preparation time (minutes)", "PreparationTimeInMinutes"),
            field("authorInput", "Author", "Author"),
            field("postedToInput", "Posted to", "PostedTo"),
            datePicker(templates, "postedAtInput", "Posted at", attributeOf(domain.newRecipe, "PostedAt"))
        )
    );

    /** One of the three repeating sections, with a row template and add and remove links. */
    const rowsPanel = (
        key: string,
        header: string,
        addCaption: string,
        dataSourceFlow: microflows.Microflow,
        dataSourceParameter: microflows.MicroflowParameterObject,
        addFlow: microflows.Microflow,
        removeFlow: microflows.Microflow,
        rowWidgets: pages.Widget[]
    ): pages.DivContainer => {
        const list = listView(model, `${key}List`, "recipe-form-list");
        list.editable = true;
        list.dataSource = microflowSource(
            model,
            dataSourceFlow,
            [{ parameterName: dataSourceParameter.name, widget: form, pageParameter: newRecipeParameter }],
            deferred
        );
        rowWidgets.forEach(widget => list.widgets.push(widget));
        list.widgets.push(
            actionButton(templates, `${key}RemoveButton`, "Remove", microflowClientAction(model, removeFlow))
        );
        return divContainer(
            model,
            `${key}Panel`,
            "recipes-panel",
            dynamicText(templates, `${key}Header`, header, [], pages.TextRenderMode.H2),
            list,
            actionButton(templates, `${key}AddButton`, addCaption, microflowClientAction(model, addFlow))
        );
    };

    const listsColumn = column(
        model,
        6,
        rowsPanel(
            "step",
            "Steps",
            "Add a step",
            flows.dsNewRecipeSteps,
            flows.dsNewRecipeStepsParameter,
            flows.actAddStep,
            flows.actRemoveStep,
            [textBox(templates, "stepDescriptionInput", "Step", attributeOf(domain.newRecipeStep, "Description"))]
        ),
        rowsPanel(
            "ingredient",
            "Ingredients",
            "Add an ingredient",
            flows.dsNewRecipeIngredients,
            flows.dsNewRecipeIngredientsParameter,
            flows.actAddIngredient,
            flows.actRemoveIngredient,
            [
                textBox(
                    templates,
                    "ingredientQuantityInput",
                    "Quantity",
                    attributeOf(domain.newRecipeIngredient, "Quantity")
                ),
                dropDown(templates, "ingredientUnitInput", "Unit", attributeOf(domain.newRecipeIngredient, "Unit")),
                textBox(templates, "ingredientNameInput", "Ingredient", attributeOf(domain.newRecipeIngredient, "Name"))
            ]
        ),
        rowsPanel(
            "recipeCategory",
            "Categories",
            "Add a category",
            flows.dsNewRecipeCategories,
            flows.dsNewRecipeCategoriesParameter,
            flows.actAddCategory,
            flows.actRemoveCategory,
            [
                textBox(
                    templates,
                    "recipeCategoryNameInput",
                    "Category",
                    attributeOf(domain.newRecipeCategory, "Name")
                )
            ]
        )
    );

    const grid = layoutGrid(
        model,
        "newRecipeGrid",
        row(
            model,
            column(
                model,
                -1,
                dynamicText(templates, "formHeader", "Add a recipe", [], pages.TextRenderMode.H1)
            )
        ),
        row(model, detailsColumn, listsColumn),
        row(
            model,
            column(
                model,
                -1,
                actionButton(
                    templates,
                    "saveRecipeButton",
                    "Save recipe",
                    microflowClientAction(model, flows.actSaveRecipe),
                    pages.RenderType.Button
                ),
                actionButton(templates, "cancelRecipeButton", "Cancel", pages.ClosePageClientAction.create(model))
            )
        )
    );
    form.widgets.push(grid);

    page.layoutCall = layoutCall(model, form);
    deferred.forEach(bind => bind());

    return { page, newRecipeParameter, homeContextParameter };
}