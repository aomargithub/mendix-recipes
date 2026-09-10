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
    clientTemplate,
    column,
    container as divContainer,
    dynamicText,
    layoutGrid,
    microflowClientAction,
    microflowSource,
    objectType,
    row,
    text,
    withClass
} from "./builders";
import { RecipeDomain } from "./domain";
import { RecipeMicroflows } from "./microflows";

const LAYOUT = "Atlas_Core.Atlas_TopBar";
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

/** A read-only data view: no control bar, no footer, nothing editable. */
function readOnlyDataView(model: IModel, name: string, cssClass: string): pages.DataView {
    const dataView = pages.DataView.create(model);
    dataView.name = name;
    withClass(dataView, cssClass);
    dataView.editability = pages.EditableEnum.Never;
    dataView.showFooter = false;
    return dataView;
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
    showRecipe: microflows.IMicroflow
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

    const showAll = pages.ActionButton.create(model);
    showAll.name = "showAllRecipesButton";
    showAll.caption = clientTemplate(templates, "All recipes");
    showAll.tooltip = text(model, languages);
    showAll.renderType = pages.RenderType.Link;
    showAll.action = microflowClientAction(model, flows.actShowAllRecipes);

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
    recipeList.widgets.push(
        dynamicText(templates, "recipeName", "{1}", [attributeOf(domain.recipeSummary, "Name")], pages.TextRenderMode.H3),
        dynamicText(templates, "recipeDescription", "{1}", [
            attributeOf(domain.recipeSummary, "DescriptionPrefix")
        ]),
        dynamicText(templates, "recipePreparationTime", "{1} minutes", [
            attributeOf(domain.recipeSummary, "PreparationTimeInMinutes")
        ])
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
            dynamicText(templates, "selectedCategory", "Filtered by: {1}", [
                attributeOf(domain.homeContext, "SelectedCategory")
            ]),
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

    const back = pages.ActionButton.create(model);
    back.name = "backButton";
    back.caption = clientTemplate(templates, "Back");
    back.tooltip = text(model, languages);
    back.renderType = pages.RenderType.Link;
    back.action = pages.ClosePageClientAction.create(model);

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
                dynamicText(templates, "detailDescription", "{1}", [
                    attributeOf(domain.recipeDetail, "Description")
                ]),
                dynamicText(templates, "detailPreparationTime", "Preparation time: {1} minutes", [
                    attributeOf(domain.recipeDetail, "PreparationTimeInMinutes")
                ]),
                dynamicText(templates, "detailAuthor", "By {1}, posted to {2}", [
                    attributeOf(domain.recipeDetail, "Author"),
                    attributeOf(domain.recipeDetail, "PostedTo")
                ]),
                dynamicText(templates, "detailPostedAt", "Posted at {1}", [
                    attributeOf(domain.recipeDetail, "PostedAt")
                ])
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