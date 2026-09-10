/**
 * The microflows behind the recipe screens.
 *
 * All of them are linear, so they are assembled through a small builder that places the objects
 * left to right and wires the sequence flows; the geometry is cosmetic but Studio Pro needs it to
 * draw the flow. The REST calls follow the shape of `FeedbackModule.SUB_Feedback_PostToAppInsights`
 * (see `out/90-reference`): the location comes from a string template so the URL can be built in
 * an expression, and the response is handed to an import mapping.
 */
import {
    IModel,
    datatypes,
    domainmodels,
    exportmappings,
    importmappings,
    microflows,
    pages,
    projects,
    security,
    services
} from "mendixmodelsdk";
import { listType, objectType, text } from "./builders";
import { RecipeDomain } from "./domain";
import { RecipeIntegration } from "./integration";

const START_X = 60;
const LANE_Y = 120;
const STEP_X = 220;

class LinearMicroflowBuilder {
    private readonly objectCollection: microflows.MicroflowObjectCollection;
    private readonly steps: microflows.MicroflowObject[] = [];
    private parameterCount = 0;

    constructor(private readonly model: IModel, private readonly languages: string[]) {
        this.objectCollection = microflows.MicroflowObjectCollection.create(model);
        const start = microflows.StartEvent.create(model);
        start.relativeMiddlePoint = { x: START_X, y: LANE_Y };
        start.size = { width: 20, height: 20 };
        this.objectCollection.objects.push(start);
        this.steps.push(start);
    }

    parameter(name: string, type: datatypes.DataType): microflows.MicroflowParameterObject {
        const parameter = microflows.MicroflowParameterObject.create(this.model);
        parameter.relativeMiddlePoint = { x: START_X + this.parameterCount * 160, y: 0 };
        parameter.size = { width: 30, height: 30 };
        parameter.name = name;
        parameter.variableType = type;
        this.objectCollection.objects.push(parameter);
        this.parameterCount++;
        return parameter;
    }

    activity(action: microflows.MicroflowAction, width = 160): microflows.ActionActivity {
        const activity = microflows.ActionActivity.create(this.model);
        activity.relativeMiddlePoint = { x: START_X + this.steps.length * STEP_X, y: LANE_Y };
        activity.size = { width, height: 60 };
        activity.action = action;
        this.objectCollection.objects.push(activity);
        this.steps.push(activity);
        return activity;
    }

    /** Closes the flow and creates the microflow document. */
    finish(
        container: projects.IFolderBase,
        name: string,
        returnType: datatypes.DataType,
        returnValue: string,
        role: security.IModuleRole
    ): microflows.Microflow {
        const end = microflows.EndEvent.create(this.model);
        end.relativeMiddlePoint = { x: START_X + this.steps.length * STEP_X, y: LANE_Y };
        end.size = { width: 20, height: 20 };
        if (returnValue) end.returnValue = returnValue;
        this.objectCollection.objects.push(end);
        this.steps.push(end);

        const microflow = microflows.Microflow.createIn(container);
        microflow.name = name;
        microflow.objectCollection = this.objectCollection;
        microflow.microflowReturnType = returnType;
        microflow.concurrencyErrorMessage = text(this.model, this.languages);
        microflow.allowedModuleRoles.push(role);

        for (let index = 0; index + 1 < this.steps.length; index++) {
            const flow = microflows.SequenceFlow.create(this.model);
            // 1 is the right-hand connection point of an object, 3 the left-hand one.
            flow.originConnectionIndex = 1;
            flow.destinationConnectionIndex = 3;
            const line = microflows.BezierCurve.create(this.model);
            line.originControlVector = { width: 30, height: 0 };
            line.destinationControlVector = { width: -30, height: 0 };
            flow.line = line;
            flow.caseValues.push(microflows.NoCase.create(this.model));
            microflow.flows.push(flow);
            flow.origin = this.steps[index];
            flow.destination = this.steps[index + 1];
        }
        return microflow;
    }
}

function stringVariable(model: IModel, name: string, expression: string): microflows.CreateVariableAction {
    const action = microflows.CreateVariableAction.create(model);
    action.variableName = name;
    action.variableType = datatypes.StringType.create(model);
    action.initialValue = expression;
    return action;
}

/** A GET whose response is fed straight into `mapping`. */
function restGet(
    model: IModel,
    urlVariable: string,
    mapping: importmappings.IImportMapping,
    outputVariableName: string,
    resultType: datatypes.DataType,
    singleObject: boolean
): microflows.RestCallAction {
    const templateArgument = microflows.TemplateArgument.create(model);
    templateArgument.expression = `$${urlVariable}`;
    const locationTemplate = microflows.StringTemplate.create(model);
    locationTemplate.text = "{1}";
    locationTemplate.arguments.push(templateArgument);

    const httpConfiguration = microflows.HttpConfiguration.create(model);
    httpConfiguration.overrideLocation = true;
    httpConfiguration.customLocationTemplate = locationTemplate;
    httpConfiguration.newHttpMethod = services.HttpMethod.Get;

    const range = microflows.ConstantRange.create(model);
    range.singleObject = singleObject;

    const mappingCall = microflows.ImportMappingCall.create(model);
    mappingCall.mapping = mapping;
    mappingCall.range = range;

    const resultHandling = microflows.ResultHandling.create(model);
    resultHandling.importMappingCall = mappingCall;
    resultHandling.storeInVariable = true;
    resultHandling.outputVariableName = outputVariableName;
    resultHandling.variableType = resultType;

    // A GET carries no body, but the action always needs a request handling; an empty custom
    // template is the neutral choice and matches the default request handling type.
    const emptyBody = microflows.CustomRequestHandling.create(model);
    emptyBody.template = microflows.StringTemplate.create(model);

    const action = microflows.RestCallAction.create(model);
    action.httpConfiguration = httpConfiguration;
    action.requestHandling = emptyBody;
    action.requestHandlingType = microflows.RequestHandlingType.Custom;
    action.resultHandling = resultHandling;
    action.resultHandlingType = microflows.ResultHandlingType.Mapping;
    return action;
}

/** A POST whose body is produced by `mapping` from the object in `argumentVariableName`. */
function restPost(
    model: IModel,
    urlVariable: string,
    mapping: exportmappings.IExportMapping,
    argumentVariableName: string
): microflows.RestCallAction {
    const templateArgument = microflows.TemplateArgument.create(model);
    templateArgument.expression = `$${urlVariable}`;
    const locationTemplate = microflows.StringTemplate.create(model);
    locationTemplate.text = "{1}";
    locationTemplate.arguments.push(templateArgument);

    const httpConfiguration = microflows.HttpConfiguration.create(model);
    httpConfiguration.overrideLocation = true;
    httpConfiguration.customLocationTemplate = locationTemplate;
    httpConfiguration.newHttpMethod = services.HttpMethod.Post;
    const contentType = microflows.HttpHeaderEntry.create(model);
    contentType.key = "Content-Type";
    contentType.value = "'application/json'";
    httpConfiguration.headerEntries.push(contentType);

    const requestHandling = microflows.MappingRequestHandling.create(model);
    requestHandling.mapping = mapping;
    requestHandling.mappingArgumentVariableName = argumentVariableName;
    requestHandling.contentType = microflows.ContentType.Json;

    const action = microflows.RestCallAction.create(model);
    action.httpConfiguration = httpConfiguration;
    action.requestHandling = requestHandling;
    action.requestHandlingType = microflows.RequestHandlingType.Mapping;
    // The API answers 201 with an empty body and a Location header, so there is nothing to import.
    action.resultHandlingType = microflows.ResultHandlingType.None;
    return action;
}

function setAttribute(
    model: IModel,
    attribute: domainmodels.IAttribute,
    expression: string
): microflows.MemberChange {
    const change = microflows.MemberChange.create(model);
    change.attribute = attribute;
    change.type = microflows.ChangeActionItemType.Set;
    change.value = expression;
    return change;
}

function changeAssociation(
    model: IModel,
    association: domainmodels.IAssociationBase,
    type: microflows.ChangeActionItemType,
    expression: string
): microflows.MemberChange {
    const change = microflows.MemberChange.create(model);
    change.association = association;
    change.type = type;
    change.value = expression;
    return change;
}

/** Nothing here is committed, so a change action only ever exists to refresh the client. */
function changeObject(
    model: IModel,
    variableName: string,
    items: microflows.MemberChange[],
    refreshInClient: boolean
): microflows.ChangeObjectAction {
    const change = microflows.ChangeObjectAction.create(model);
    change.changeVariableName = variableName;
    change.refreshInClient = refreshInClient;
    change.commit = microflows.CommitEnum.No;
    items.forEach(item => change.items.push(item));
    return change;
}

function attributeOf(entity: domainmodels.Entity, name: string): domainmodels.IAttribute {
    const attribute = entity.attributes.find(candidate => candidate.name === name);
    if (!attribute) throw new Error(`Entity ${entity.name} has no attribute ${name}.`);
    return attribute;
}

export interface RecipeMicroflows {
    dsHomeContext: microflows.Microflow;
    dsCategories: microflows.Microflow;
    dsRecipes: microflows.Microflow;
    dsRecipesHomeContextParameter: microflows.MicroflowParameterObject;
    dsRecipeSteps: microflows.Microflow;
    dsRecipeStepsParameter: microflows.MicroflowParameterObject;
    dsRecipeIngredients: microflows.Microflow;
    dsRecipeIngredientsParameter: microflows.MicroflowParameterObject;
    dsRecipeCategories: microflows.Microflow;
    dsRecipeCategoriesParameter: microflows.MicroflowParameterObject;
    actSelectCategory: microflows.Microflow;
    actShowAllRecipes: microflows.Microflow;
    dsNewRecipeSteps: microflows.Microflow;
    dsNewRecipeStepsParameter: microflows.MicroflowParameterObject;
    dsNewRecipeIngredients: microflows.Microflow;
    dsNewRecipeIngredientsParameter: microflows.MicroflowParameterObject;
    dsNewRecipeCategories: microflows.Microflow;
    dsNewRecipeCategoriesParameter: microflows.MicroflowParameterObject;
    actAddStep: microflows.Microflow;
    actAddIngredient: microflows.Microflow;
    actAddCategory: microflows.Microflow;
    actRemoveStep: microflows.Microflow;
    actRemoveIngredient: microflows.Microflow;
    actRemoveCategory: microflows.Microflow;
    actSaveRecipe: microflows.Microflow;
}

export interface RecipeMicroflowContext {
    container: projects.IFolderBase;
    languages: string[];
    domain: RecipeDomain;
    integration: RecipeIntegration;
    role: security.IModuleRole;
}

/**
 * Everything except `ACT_ShowRecipe`, which needs the detail page to exist first and is therefore
 * created by `buildShowRecipeMicroflow` once the pages are in place.
 */
export function buildMicroflows(context: RecipeMicroflowContext): RecipeMicroflows {
    const { container, languages, domain, integration, role } = context;
    const model = container.model;
    const baseUrl = `@${integration.baseUrl.qualifiedName}`;

    const dsHomeContext = (() => {
        const builder = new LinearMicroflowBuilder(model, languages);
        const create = microflows.CreateObjectAction.create(model);
        create.entity = domain.homeContext;
        create.outputVariableName = "HomeContext";
        builder.activity(create, 190);
        return builder.finish(
            container,
            "DS_HomeContext",
            objectType(model, domain.homeContext),
            "$HomeContext",
            role
        );
    })();

    const dsCategories = (() => {
        const builder = new LinearMicroflowBuilder(model, languages);
        builder.activity(stringVariable(model, "Url", `${baseUrl} + '/v1/categories'`), 190);
        builder.activity(
            restGet(
                model,
                "Url",
                integration.categoriesMapping,
                "Categories",
                listType(model, domain.category),
                false
            ),
            190
        );
        return builder.finish(container, "DS_Categories", listType(model, domain.category), "$Categories", role);
    })();

    let dsRecipesHomeContextParameter!: microflows.MicroflowParameterObject;
    const dsRecipes = (() => {
        const builder = new LinearMicroflowBuilder(model, languages);
        dsRecipesHomeContextParameter = builder.parameter("HomeContext", objectType(model, domain.homeContext));
        // No category selected means "show everything", which is the unfiltered recipes endpoint.
        // Category names contain spaces, so the selected one has to be encoded into the path.
        const url =
            `${baseUrl} + ` +
            "(if $HomeContext/SelectedCategory = empty or trim($HomeContext/SelectedCategory) = '' " +
            "then '/v1/recipes' " +
            "else '/v1/categories/' + urlEncode($HomeContext/SelectedCategory) + '/recipes')";
        builder.activity(stringVariable(model, "Url", url), 190);
        builder.activity(
            restGet(model, "Url", integration.recipesMapping, "Recipes", listType(model, domain.recipeSummary), false),
            190
        );
        return builder.finish(container, "DS_Recipes", listType(model, domain.recipeSummary), "$Recipes", role);
    })();

    const retrieveOverAssociation = (
        name: string,
        startEntity: domainmodels.Entity,
        association: domainmodels.IAssociationBase,
        childEntity: domainmodels.Entity,
        outputVariableName: string
    ): { microflow: microflows.Microflow; parameter: microflows.MicroflowParameterObject } => {
        const builder = new LinearMicroflowBuilder(model, languages);
        const parameter = builder.parameter(startEntity.name, objectType(model, startEntity));
        const source = microflows.AssociationRetrieveSource.create(model);
        source.startVariableName = startEntity.name;
        source.association = association;
        const retrieve = microflows.RetrieveAction.create(model);
        retrieve.retrieveSource = source;
        retrieve.outputVariableName = outputVariableName;
        builder.activity(retrieve, 190);
        const microflow = builder.finish(
            container,
            name,
            listType(model, childEntity),
            `$${outputVariableName}`,
            role
        );
        return { microflow, parameter };
    };

    const steps = retrieveOverAssociation(
        "DS_RecipeSteps",
        domain.recipeDetail,
        domain.stepToRecipe,
        domain.recipeStep,
        "RecipeSteps"
    );
    const ingredients = retrieveOverAssociation(
        "DS_RecipeIngredients",
        domain.recipeDetail,
        domain.ingredientToRecipe,
        domain.recipeIngredient,
        "RecipeIngredients"
    );
    const recipeCategories = retrieveOverAssociation(
        "DS_RecipeCategories",
        domain.recipeDetail,
        domain.categoryToRecipe,
        domain.recipeCategory,
        "RecipeCategories"
    );

    const newSteps = retrieveOverAssociation(
        "DS_NewRecipeSteps",
        domain.newRecipe,
        domain.newRecipeToSteps,
        domain.newRecipeStep,
        "NewRecipeSteps"
    );
    const newIngredients = retrieveOverAssociation(
        "DS_NewRecipeIngredients",
        domain.newRecipe,
        domain.newRecipeToIngredients,
        domain.newRecipeIngredient,
        "NewRecipeIngredients"
    );
    const newCategories = retrieveOverAssociation(
        "DS_NewRecipeCategories",
        domain.newRecipe,
        domain.newRecipeToCategories,
        domain.newRecipeCategory,
        "NewRecipeCategories"
    );

    const changeSelectedCategory = (name: string, withCategoryParameter: boolean, expression: string) => {
        const builder = new LinearMicroflowBuilder(model, languages);
        if (withCategoryParameter) builder.parameter("Category", objectType(model, domain.category));
        builder.parameter("HomeContext", objectType(model, domain.homeContext));
        const change = microflows.ChangeObjectAction.create(model);
        change.changeVariableName = "HomeContext";
        // The recipe list is a data source on the same object, so refreshing it re-runs DS_Recipes.
        change.refreshInClient = true;
        change.commit = microflows.CommitEnum.No;
        change.items.push(setAttribute(model, attributeOf(domain.homeContext, "SelectedCategory"), expression));
        builder.activity(change, 200);
        return builder.finish(container, name, datatypes.VoidType.create(model), "", role);
    };

    const actSelectCategory = changeSelectedCategory("ACT_SelectCategory", true, "$Category/Name");
    const actShowAllRecipes = changeSelectedCategory("ACT_ShowAllRecipes", false, "''");

    // Adding and removing a row on the add-recipe form. Both end by refreshing the NewRecipe the
    // form sits on, which is what re-runs the DS_NewRecipe* data sources listing the rows.
    const addRow = (
        name: string,
        childEntity: domainmodels.Entity,
        association: domainmodels.IAssociationBase,
        initialValues: microflows.MemberChange[] = []
    ): microflows.Microflow => {
        const builder = new LinearMicroflowBuilder(model, languages);
        builder.parameter("NewRecipe", objectType(model, domain.newRecipe));
        const create = microflows.CreateObjectAction.create(model);
        create.entity = childEntity;
        create.outputVariableName = childEntity.name;
        initialValues.forEach(item => create.items.push(item));
        builder.activity(create, 200);
        builder.activity(
            changeObject(
                model,
                "NewRecipe",
                [changeAssociation(model, association, microflows.ChangeActionItemType.Add, `$${childEntity.name}`)],
                true
            ),
            200
        );
        return builder.finish(container, name, datatypes.VoidType.create(model), "", role);
    };

    const removeRow = (
        name: string,
        childEntity: domainmodels.Entity,
        association: domainmodels.IAssociationBase
    ): microflows.Microflow => {
        const builder = new LinearMicroflowBuilder(model, languages);
        // Both parameters come from the page: the row from the list view, the recipe from the data
        // view around it. The client matches them by type, so neither needs to be mapped by hand.
        builder.parameter(childEntity.name, objectType(model, childEntity));
        builder.parameter("NewRecipe", objectType(model, domain.newRecipe));
        builder.activity(
            changeObject(
                model,
                "NewRecipe",
                [changeAssociation(model, association, microflows.ChangeActionItemType.Remove, `$${childEntity.name}`)],
                true
            ),
            200
        );
        const remove = microflows.DeleteAction.create(model);
        remove.deleteVariableName = childEntity.name;
        builder.activity(remove, 190);
        return builder.finish(container, name, datatypes.VoidType.create(model), "", role);
    };

    const oneUnit = setAttribute(model, attributeOf(domain.newRecipeIngredient, "Quantity"), "1");
    const actAddStep = addRow("ACT_AddStep", domain.newRecipeStep, domain.newRecipeToSteps);
    const actAddIngredient = addRow("ACT_AddIngredient", domain.newRecipeIngredient, domain.newRecipeToIngredients, [
        oneUnit
    ]);
    const actAddCategory = addRow("ACT_AddCategory", domain.newRecipeCategory, domain.newRecipeToCategories);
    const actRemoveStep = removeRow("ACT_RemoveStep", domain.newRecipeStep, domain.newRecipeToSteps);
    const actRemoveIngredient = removeRow(
        "ACT_RemoveIngredient",
        domain.newRecipeIngredient,
        domain.newRecipeToIngredients
    );
    const actRemoveCategory = removeRow("ACT_RemoveCategory", domain.newRecipeCategory, domain.newRecipeToCategories);

    const actSaveRecipe = (() => {
        const builder = new LinearMicroflowBuilder(model, languages);
        builder.parameter("NewRecipe", objectType(model, domain.newRecipe));
        builder.parameter("HomeContext", objectType(model, domain.homeContext));
        builder.activity(stringVariable(model, "Url", `${baseUrl} + '/v1/recipes'`), 190);
        builder.activity(restPost(model, "Url", integration.createRecipeMapping, "NewRecipe"), 190);
        // The recipe list on the home page hangs off this object, so touching it picks the new
        // recipe up; without it the form would close onto a list that has not moved.
        builder.activity(changeObject(model, "HomeContext", [], true), 200);
        builder.activity(microflows.CloseFormAction.create(model), 160);
        return builder.finish(container, "ACT_SaveRecipe", datatypes.VoidType.create(model), "", role);
    })();

    return {
        dsHomeContext,
        dsCategories,
        dsRecipes,
        dsRecipesHomeContextParameter,
        dsRecipeSteps: steps.microflow,
        dsRecipeStepsParameter: steps.parameter,
        dsRecipeIngredients: ingredients.microflow,
        dsRecipeIngredientsParameter: ingredients.parameter,
        dsRecipeCategories: recipeCategories.microflow,
        dsRecipeCategoriesParameter: recipeCategories.parameter,
        actSelectCategory,
        actShowAllRecipes,
        dsNewRecipeSteps: newSteps.microflow,
        dsNewRecipeStepsParameter: newSteps.parameter,
        dsNewRecipeIngredients: newIngredients.microflow,
        dsNewRecipeIngredientsParameter: newIngredients.parameter,
        dsNewRecipeCategories: newCategories.microflow,
        dsNewRecipeCategoriesParameter: newCategories.parameter,
        actAddStep,
        actAddIngredient,
        actAddCategory,
        actRemoveStep,
        actRemoveIngredient,
        actRemoveCategory,
        actSaveRecipe
    };
}

/**
 * Fills in a blank recipe and opens the add-recipe form with it. Like `ACT_ShowRecipe` this needs
 * the page, so it is created after the pages are.
 *
 * The recipe starts with one row in each of the three lists, because the API rejects a recipe
 * without steps, ingredients or categories, and an empty form gives no hint of that.
 */
export function buildNewRecipeMicroflow(
    context: RecipeMicroflowContext,
    formPage: pages.Page,
    newRecipeParameter: pages.PageParameter,
    homeContextParameter: pages.PageParameter
): microflows.Microflow {
    const { container, languages, domain, role } = context;
    const model = container.model;
    const builder = new LinearMicroflowBuilder(model, languages);
    builder.parameter("HomeContext", objectType(model, domain.homeContext));

    const create = microflows.CreateObjectAction.create(model);
    create.entity = domain.newRecipe;
    create.outputVariableName = "NewRecipe";
    create.items.push(setAttribute(model, attributeOf(domain.newRecipe, "Author"), "'Unknown'"));
    create.items.push(setAttribute(model, attributeOf(domain.newRecipe, "PostedAt"), "[%CurrentDateTime%]"));
    create.items.push(setAttribute(model, attributeOf(domain.newRecipe, "PostedTo"), "'Mendix app'"));
    create.items.push(setAttribute(model, attributeOf(domain.newRecipe, "PreparationTimeInMinutes"), "30"));
    builder.activity(create, 200);

    const createRow = (entity: domainmodels.Entity, initialValues: microflows.MemberChange[] = []) => {
        const action = microflows.CreateObjectAction.create(model);
        action.entity = entity;
        action.outputVariableName = entity.name;
        initialValues.forEach(item => action.items.push(item));
        builder.activity(action, 200);
    };
    createRow(domain.newRecipeStep);
    createRow(domain.newRecipeIngredient, [
        setAttribute(model, attributeOf(domain.newRecipeIngredient, "Quantity"), "1")
    ]);
    createRow(domain.newRecipeCategory);

    const add = microflows.ChangeActionItemType.Add;
    builder.activity(
        changeObject(
            model,
            "NewRecipe",
            [
                changeAssociation(model, domain.newRecipeToSteps, add, "$NewRecipeStep"),
                changeAssociation(model, domain.newRecipeToIngredients, add, "$NewRecipeIngredient"),
                changeAssociation(model, domain.newRecipeToCategories, add, "$NewRecipeCategory")
            ],
            false
        ),
        200
    );

    const pageSettings = pages.PageSettings.create(model);
    pageSettings.page = formPage;
    for (const [parameter, argument] of [
        [newRecipeParameter, "$NewRecipe"],
        [homeContextParameter, "$HomeContext"]
    ] as [pages.PageParameter, string][]) {
        const mapping = pages.PageParameterMapping.create(model);
        mapping.parameter = parameter;
        mapping.variable = pages.PageVariable.create(model);
        mapping.argument = argument;
        pageSettings.parameterMappings.push(mapping);
    }
    const showPage = microflows.ShowPageAction.create(model);
    showPage.pageSettings = pageSettings;
    builder.activity(showPage, 210);

    return builder.finish(container, "ACT_NewRecipe", datatypes.VoidType.create(model), "", role);
}

/**
 * Fetches one recipe and opens the detail page with it. Split out from `buildMicroflows` because
 * it needs the page, and the page in turn needs the other microflows.
 */
export function buildShowRecipeMicroflow(
    context: RecipeMicroflowContext,
    detailPage: pages.Page,
    detailPageParameter: pages.PageParameter
): microflows.Microflow {
    const { container, languages, domain, integration, role } = context;
    const model = container.model;
    const builder = new LinearMicroflowBuilder(model, languages);
    builder.parameter("RecipeSummary", objectType(model, domain.recipeSummary));

    builder.activity(
        stringVariable(
            model,
            "Url",
            `@${integration.baseUrl.qualifiedName} + '/v1/recipes/' + $RecipeSummary/RecipeId`
        ),
        190
    );
    builder.activity(
        restGet(
            model,
            "Url",
            integration.recipeMapping,
            "RecipeDetail",
            objectType(model, domain.recipeDetail),
            true
        ),
        190
    );

    const parameterMapping = pages.PageParameterMapping.create(model);
    parameterMapping.parameter = detailPageParameter;
    parameterMapping.variable = pages.PageVariable.create(model);
    parameterMapping.argument = "$RecipeDetail";

    const pageSettings = pages.PageSettings.create(model);
    pageSettings.page = detailPage;
    pageSettings.parameterMappings.push(parameterMapping);

    const showPage = microflows.ShowPageAction.create(model);
    showPage.pageSettings = pageSettings;
    builder.activity(showPage, 210);

    return builder.finish(container, "ACT_ShowRecipe", datatypes.VoidType.create(model), "", role);
}