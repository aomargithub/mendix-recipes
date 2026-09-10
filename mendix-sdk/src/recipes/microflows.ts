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
    importmappings,
    microflows,
    pages,
    projects,
    security,
    services,
    texts
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
        association: domainmodels.IAssociationBase,
        childEntity: domainmodels.Entity,
        outputVariableName: string
    ): { microflow: microflows.Microflow; parameter: microflows.MicroflowParameterObject } => {
        const builder = new LinearMicroflowBuilder(model, languages);
        const parameter = builder.parameter("RecipeDetail", objectType(model, domain.recipeDetail));
        const source = microflows.AssociationRetrieveSource.create(model);
        source.startVariableName = "RecipeDetail";
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

    const steps = retrieveOverAssociation("DS_RecipeSteps", domain.stepToRecipe, domain.recipeStep, "RecipeSteps");
    const ingredients = retrieveOverAssociation(
        "DS_RecipeIngredients",
        domain.ingredientToRecipe,
        domain.recipeIngredient,
        "RecipeIngredients"
    );
    const recipeCategories = retrieveOverAssociation(
        "DS_RecipeCategories",
        domain.categoryToRecipe,
        domain.recipeCategory,
        "RecipeCategories"
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
        actShowAllRecipes
    };
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