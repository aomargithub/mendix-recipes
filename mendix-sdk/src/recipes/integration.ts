/**
 * The integration layer: the base URL constant, the JSON structures for the three responses the
 * app consumes, and the import mappings that turn those responses into domain objects.
 *
 * Studio Pro derives a JSON structure's element tree from its JSON snippet, and an import mapping
 * is only consistent when each mapping element repeats the element type, occurrence, nillability,
 * name and path of the JSON element it maps. Rather than restate all of that by hand, the mapping
 * is built by looking each element up in the tree that `parseJsonSnippet` derives, which is a port
 * of the parser Studio Pro uses. Selecting elements by path also gives Studio Pro's flattening for
 * free: an element that is not mapped simply does not appear, and its children attach to the
 * nearest mapped ancestor.
 */
import {
    IModel,
    constants,
    datatypes,
    domainmodels,
    exportmappings,
    importmappings,
    jsonstructures,
    mappings,
    projects,
    xmlschemas
} from "mendixmodelsdk";
import { JsonNode, PrimitiveTypeName, beautify, findByPath, parseJsonSnippet, walk } from "../json-structure";
import { CATEGORIES_SAMPLE, CREATE_RECIPE_SAMPLE, RECIPES_SAMPLE, RECIPE_SAMPLE } from "./api-samples";
import { RecipeDomain } from "./domain";

const ELEMENT_TYPES: Record<JsonNode["elementType"], mappings.ElementType> = {
    Object: mappings.ElementType.Object,
    Array: mappings.ElementType.Array,
    Wrapper: mappings.ElementType.Wrapper,
    Value: mappings.ElementType.Value,
    Undefined: mappings.ElementType.Undefined
};

const PRIMITIVE_TYPES: Record<PrimitiveTypeName, xmlschemas.XmlPrimitiveType> = {
    String: xmlschemas.XmlPrimitiveType.String,
    Integer: xmlschemas.XmlPrimitiveType.Integer,
    Long: xmlschemas.XmlPrimitiveType.Long,
    Decimal: xmlschemas.XmlPrimitiveType.Decimal,
    Boolean: xmlschemas.XmlPrimitiveType.Boolean,
    DateTime: xmlschemas.XmlPrimitiveType.DateTime,
    Unknown: xmlschemas.XmlPrimitiveType.Unknown
};

function dataTypeFor(model: IModel, primitiveType: PrimitiveTypeName): datatypes.DataType {
    switch (primitiveType) {
        case "Integer":
        case "Long":
            return datatypes.IntegerType.create(model);
        case "Decimal":
            return datatypes.DecimalType.create(model);
        case "Boolean":
            return datatypes.BooleanType.create(model);
        case "DateTime":
            return datatypes.DateTimeType.create(model);
        default:
            return datatypes.StringType.create(model);
    }
}

export function createJsonStructure(
    container: projects.IFolderBase,
    name: string,
    sample: unknown
): { structure: jsonstructures.JsonStructure; root: JsonNode } {
    const model = container.model;
    const snippet = beautify(sample);
    const root = parseJsonSnippet(snippet);

    const structure = jsonstructures.JsonStructure.createIn(container);
    structure.name = name;
    structure.jsonSnippet = snippet;

    const toElement = (node: JsonNode): jsonstructures.JsonElement => {
        const element = jsonstructures.JsonElement.create(model);
        element.elementType = ELEMENT_TYPES[node.elementType];
        element.path = node.path;
        element.minOccurs = node.minOccurs;
        element.maxOccurs = node.maxOccurs;
        element.nillable = node.nillable;
        element.exposedName = node.exposedName;
        if (node.primitiveType !== undefined) element.primitiveType = PRIMITIVE_TYPES[node.primitiveType];
        if (node.maxLength !== undefined) element.maxLength = node.maxLength;
        if (node.originalValue !== undefined) element.originalValue = node.originalValue;
        node.children.forEach(child => element.children.push(toElement(child)));
        return element;
    };

    structure.elements.push(toElement(root));
    return { structure, root };
}

/** An attribute a value element maps, and the model-side type to declare for it. */
interface ValueSpec {
    attribute: domainmodels.IAttribute;
    /** Overrides the type derived from the JSON element, for an enumeration attribute. */
    dataType?: datatypes.DataType;
}

/** One object mapping element: which JSON element it maps, onto which entity, with which values. */
interface ObjectMappingSpec {
    path: string;
    entity: domainmodels.IEntity;
    /** Set on nested objects: the association between this object and the enclosing one. */
    association?: domainmodels.IAssociationBase;
    values: Record<string, domainmodels.IAttribute | ValueSpec>;
    children?: ObjectMappingSpec[];
}

/** Import and export mapping elements differ only in their concrete classes. */
interface MappingElementFactory {
    object(model: IModel): mappings.ObjectMappingElement;
    value(model: IModel): mappings.ValueMappingElement;
}

const IMPORT_ELEMENTS: MappingElementFactory = {
    object: model => importmappings.ImportObjectMappingElement.create(model),
    value: model => importmappings.ImportValueMappingElement.create(model)
};

const EXPORT_ELEMENTS: MappingElementFactory = {
    object: model => exportmappings.ExportObjectMappingElement.create(model),
    value: model => exportmappings.ExportValueMappingElement.create(model)
};

function copyElementInfo(target: mappings.MappingElement, node: JsonNode): void {
    target.elementType = ELEMENT_TYPES[node.elementType];
    target.jsonPath = node.path;
    target.minOccurs = node.minOccurs;
    target.maxOccurs = node.maxOccurs;
    target.nillable = node.nillable;
    target.exposedName = node.exposedName;
}

function buildObjectMappingElement(
    model: IModel,
    factory: MappingElementFactory,
    root: JsonNode,
    spec: ObjectMappingSpec
): mappings.ObjectMappingElement {
    const node = findByPath(root, spec.path);
    const element = factory.object(model);
    copyElementInfo(element, node);
    element.entity = spec.entity;
    if (spec.association) element.association = spec.association;

    for (const [path, valueSpec] of Object.entries(spec.values)) {
        const { attribute, dataType } = "attribute" in valueSpec ? valueSpec : { attribute: valueSpec, dataType: undefined };
        const valueNode = findByPath(root, path);
        const value = factory.value(model);
        copyElementInfo(value, valueNode);
        const primitiveType = valueNode.primitiveType ?? "String";
        value.xmlPrimitiveType = PRIMITIVE_TYPES[primitiveType];
        value.type = dataType ?? dataTypeFor(model, primitiveType);
        if (valueNode.maxLength !== undefined) value.maxLength = valueNode.maxLength;
        value.attribute = attribute;
        element.children.push(value);
    }

    for (const child of spec.children ?? []) {
        element.children.push(buildObjectMappingElement(model, factory, root, child));
    }
    return element;
}

function createImportMapping(
    container: projects.IFolderBase,
    name: string,
    structure: jsonstructures.JsonStructure,
    root: JsonNode,
    rootSpecs: ObjectMappingSpec[]
): importmappings.ImportMapping {
    const model = container.model;
    const mapping = importmappings.ImportMapping.createIn(container);
    mapping.name = name;
    mapping.jsonStructure = structure;
    mapping.parameterType = datatypes.UnknownType.create(model);
    for (const spec of rootSpecs) {
        mapping.rootMappingElements.push(buildObjectMappingElement(model, IMPORT_ELEMENTS, root, spec));
    }
    return mapping;
}

function createExportMapping(
    container: projects.IFolderBase,
    name: string,
    structure: jsonstructures.JsonStructure,
    root: JsonNode,
    rootSpec: ObjectMappingSpec
): exportmappings.ExportMapping {
    const model = container.model;
    const mapping = exportmappings.ExportMapping.createIn(container);
    mapping.name = name;
    mapping.jsonStructure = structure;
    const rootElement = buildObjectMappingElement(model, EXPORT_ELEMENTS, root, rootSpec);
    // The object at the root of an export mapping is the microflow's argument, not something the
    // mapping looks up or creates, and there is nothing sensible to fall back on if it is missing.
    rootElement.objectHandling = mappings.ObjectHandlingEnum.Parameter;
    rootElement.objectHandlingBackup = mappings.ObjectHandlingBackupEnum.Error;
    mapping.rootMappingElements.push(rootElement);
    return mapping;
}

export interface RecipeIntegration {
    baseUrl: constants.Constant;
    categoriesMapping: importmappings.ImportMapping;
    recipesMapping: importmappings.ImportMapping;
    recipeMapping: importmappings.ImportMapping;
    createRecipeMapping: exportmappings.ExportMapping;
}

function attributeOf(entity: domainmodels.Entity, name: string): domainmodels.IAttribute {
    const attribute = entity.attributes.find(candidate => candidate.name === name);
    if (!attribute) throw new Error(`Entity ${entity.name} has no attribute ${name}.`);
    return attribute;
}

export function buildIntegration(
    container: projects.IFolderBase,
    domain: RecipeDomain,
    apiBaseUrl: string
): RecipeIntegration {
    const model = container.model;

    const baseUrl = constants.Constant.createIn(container);
    baseUrl.name = "RecipesApiBaseUrl";
    baseUrl.type = datatypes.StringType.create(model);
    baseUrl.defaultValue = apiBaseUrl;
    baseUrl.exposedToClient = false;

    // `GET /v1/categories` returns a bare array of names, so the repeating wrapper around each
    // name is the element that becomes a Category; the array itself maps to nothing.
    const categories = createJsonStructure(container, "Categories_Response", CATEGORIES_SAMPLE);
    const categoriesMapping = createImportMapping(
        container,
        "Categories_ImportMapping",
        categories.structure,
        categories.root,
        [
            {
                path: "(Array)|(Wrapper)",
                entity: domain.category,
                values: { "(Array)|(Wrapper)|(Value)": attributeOf(domain.category, "Name") }
            }
        ]
    );

    // The recipe endpoints answer with a Spring `PagedModel`; only the items inside `content`
    // are of interest, so the envelope and the paging block stay unmapped.
    const recipes = createJsonStructure(container, "Recipes_Response", RECIPES_SAMPLE);
    const recipesMapping = createImportMapping(container, "Recipes_ImportMapping", recipes.structure, recipes.root, [
        {
            path: "(Object)|content|(Object)",
            entity: domain.recipeSummary,
            values: {
                "(Object)|content|(Object)|id": attributeOf(domain.recipeSummary, "RecipeId"),
                "(Object)|content|(Object)|name": attributeOf(domain.recipeSummary, "Name"),
                "(Object)|content|(Object)|descriptionPrefix": attributeOf(domain.recipeSummary, "DescriptionPrefix"),
                "(Object)|content|(Object)|preparationTimeInMinutes": attributeOf(
                    domain.recipeSummary,
                    "PreparationTimeInMinutes"
                )
            }
        }
    ]);

    const recipe = createJsonStructure(container, "Recipe_Response", RECIPE_SAMPLE);
    const recipeMapping = createImportMapping(container, "Recipe_ImportMapping", recipe.structure, recipe.root, [
        {
            path: "(Object)",
            entity: domain.recipeDetail,
            values: {
                "(Object)|id": attributeOf(domain.recipeDetail, "RecipeId"),
                "(Object)|name": attributeOf(domain.recipeDetail, "Name"),
                "(Object)|description": attributeOf(domain.recipeDetail, "Description"),
                "(Object)|author": attributeOf(domain.recipeDetail, "Author"),
                "(Object)|postedAt": attributeOf(domain.recipeDetail, "PostedAt"),
                "(Object)|postedTo": attributeOf(domain.recipeDetail, "PostedTo"),
                "(Object)|preparationTimeInMinutes": attributeOf(domain.recipeDetail, "PreparationTimeInMinutes")
            },
            children: [
                {
                    path: "(Object)|steps|(Wrapper)",
                    entity: domain.recipeStep,
                    association: domain.stepToRecipe,
                    values: { "(Object)|steps|(Wrapper)|(Value)": attributeOf(domain.recipeStep, "Description") }
                },
                {
                    path: "(Object)|ingredients|(Object)",
                    entity: domain.recipeIngredient,
                    association: domain.ingredientToRecipe,
                    values: {
                        "(Object)|ingredients|(Object)|name": attributeOf(domain.recipeIngredient, "Name"),
                        "(Object)|ingredients|(Object)|quantity": attributeOf(domain.recipeIngredient, "Quantity"),
                        "(Object)|ingredients|(Object)|unit": attributeOf(domain.recipeIngredient, "Unit")
                    }
                },
                {
                    path: "(Object)|categories|(Wrapper)",
                    entity: domain.recipeCategory,
                    association: domain.categoryToRecipe,
                    values: { "(Object)|categories|(Wrapper)|(Value)": attributeOf(domain.recipeCategory, "Name") }
                }
            ]
        }
    ]);

    // The one mapping that runs the other way: `POST /v1/recipes` takes a `CreateRecipeRequestDto`.
    // `Unit` is an enumeration, so its value element has to declare the enumeration rather than the
    // string the JSON element suggests; the runtime then writes the value's name, which is exactly
    // what `MeasurementUnit.valueOf` expects on the far side.
    const unitType = datatypes.EnumerationType.create(model);
    unitType.enumeration = domain.measurementUnit;

    const createRecipe = createJsonStructure(container, "CreateRecipe_Request", CREATE_RECIPE_SAMPLE);
    const createRecipeMapping = createExportMapping(
        container,
        "CreateRecipe_ExportMapping",
        createRecipe.structure,
        createRecipe.root,
        {
            path: "(Object)",
            entity: domain.newRecipe,
            values: {
                "(Object)|name": attributeOf(domain.newRecipe, "Name"),
                "(Object)|description": attributeOf(domain.newRecipe, "Description"),
                "(Object)|author": attributeOf(domain.newRecipe, "Author"),
                "(Object)|postedAt": attributeOf(domain.newRecipe, "PostedAt"),
                "(Object)|postedTo": attributeOf(domain.newRecipe, "PostedTo"),
                "(Object)|preparationTimeInMinutes": attributeOf(domain.newRecipe, "PreparationTimeInMinutes")
            },
            children: [
                {
                    path: "(Object)|steps|(Wrapper)",
                    entity: domain.newRecipeStep,
                    association: domain.newRecipeToSteps,
                    values: { "(Object)|steps|(Wrapper)|(Value)": attributeOf(domain.newRecipeStep, "Description") }
                },
                {
                    path: "(Object)|ingredients|(Object)",
                    entity: domain.newRecipeIngredient,
                    association: domain.newRecipeToIngredients,
                    values: {
                        "(Object)|ingredients|(Object)|name": attributeOf(domain.newRecipeIngredient, "Name"),
                        "(Object)|ingredients|(Object)|quantity": attributeOf(domain.newRecipeIngredient, "Quantity"),
                        "(Object)|ingredients|(Object)|unit": {
                            attribute: attributeOf(domain.newRecipeIngredient, "Unit"),
                            dataType: unitType
                        }
                    }
                },
                {
                    path: "(Object)|categories|(Wrapper)",
                    entity: domain.newRecipeCategory,
                    association: domain.newRecipeToCategories,
                    values: {
                        "(Object)|categories|(Wrapper)|(Value)": attributeOf(domain.newRecipeCategory, "Name")
                    }
                }
            ]
        }
    );

    return { baseUrl, categoriesMapping, recipesMapping, recipeMapping, createRecipeMapping };
}

/** Every path of a derived tree, for the build log. */
export function describeTree(root: JsonNode): string[] {
    const lines: string[] = [];
    walk(root, node => lines.push(node.path));
    return lines;
}
