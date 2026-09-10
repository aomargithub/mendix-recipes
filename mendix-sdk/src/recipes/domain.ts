/**
 * The domain model behind the recipe screens.
 *
 * Everything the app shows comes from the recipes REST API and is thrown away at the end of the
 * session, so every entity here is non-persistable. `HomeContext` is the exception in spirit
 * rather than in kind: it holds no API data, only which category the user picked, which is what
 * lets the recipe list on the home page react to a click in the category list.
 */
import { IModel, domainmodels, enumerations, projects, security } from "mendixmodelsdk";
import { moduleOf } from "../common";
import { text } from "./builders";

/** Mirrors `com.mendix.recipes.domain.MeasurementUnit`; the API rejects any other value. */
export const MEASUREMENT_UNITS = [
    "LITER",
    "CUP",
    "TABLESPOON",
    "TEASPOON",
    "GRAM",
    "POUND",
    "PIECE",
    "CAN",
    "PACKAGE",
    "JAR"
];

export interface RecipeDomain {
    homeContext: domainmodels.Entity;
    category: domainmodels.Entity;
    recipeSummary: domainmodels.Entity;
    recipeDetail: domainmodels.Entity;
    recipeStep: domainmodels.Entity;
    recipeIngredient: domainmodels.Entity;
    recipeCategory: domainmodels.Entity;
    stepToRecipe: domainmodels.Association;
    ingredientToRecipe: domainmodels.Association;
    categoryToRecipe: domainmodels.Association;
    measurementUnit: enumerations.Enumeration;
    newRecipe: domainmodels.Entity;
    newRecipeStep: domainmodels.Entity;
    newRecipeIngredient: domainmodels.Entity;
    newRecipeCategory: domainmodels.Entity;
    newRecipeToSteps: domainmodels.Association;
    newRecipeToIngredients: domainmodels.Association;
    newRecipeToCategories: domainmodels.Association;
}

type AttributeSpec = {
    name: string;
    type: "String" | "Integer" | "Decimal" | "DateTime";
} | {
    name: string;
    type: "Enumeration";
    enumeration: enumerations.IEnumeration;
};

function attributeType(model: IModel, spec: AttributeSpec): domainmodels.AttributeType {
    switch (spec.type) {
        case "String": {
            const type = domainmodels.StringAttributeType.create(model);
            // Unlimited: the API imposes no length and truncating an import is a silent data loss.
            type.length = 0;
            return type;
        }
        case "Integer":
            return domainmodels.IntegerAttributeType.create(model);
        case "Decimal":
            return domainmodels.DecimalAttributeType.create(model);
        case "DateTime":
            return domainmodels.DateTimeAttributeType.create(model);
        case "Enumeration": {
            const type = domainmodels.EnumerationAttributeType.create(model);
            type.enumeration = spec.enumeration;
            return type;
        }
    }
}

function createEntity(
    domainModel: domainmodels.DomainModel,
    name: string,
    location: { x: number; y: number },
    attributes: AttributeSpec[]
): domainmodels.Entity {
    const model = domainModel.model;
    const entity = domainmodels.Entity.createIn(domainModel);
    entity.name = name;
    entity.location = location;

    const generalization = domainmodels.NoGeneralization.create(model);
    generalization.persistable = false;
    entity.generalization = generalization;

    for (const spec of attributes) {
        const attribute = domainmodels.Attribute.createIn(entity);
        attribute.name = spec.name;
        attribute.type = attributeType(model, spec);
        attribute.value = domainmodels.StoredValue.create(model);
    }
    return entity;
}

function createAssociation(
    domainModel: domainmodels.DomainModel,
    parent: domainmodels.Entity,
    child: domainmodels.Entity,
    type: domainmodels.AssociationType = domainmodels.AssociationType.Reference
): domainmodels.Association {
    const association = domainmodels.Association.createIn(domainModel);
    // Mendix names an association <owner>_<target>; `parent` is the side holding the reference.
    association.name = `${parent.name}_${child.name}`;
    association.parent = parent;
    association.child = child;
    association.type = type;
    association.owner = domainmodels.AssociationOwner.Default;
    association.parentConnection = { x: 0, y: 15 };
    association.childConnection = { x: 100, y: 15 };
    return association;
}

/**
 * The measurement units the API accepts. An enumeration rather than free text because an export
 * mapping writes the enumeration value's name, so the drop-down cannot produce a unit the API
 * would reject.
 */
function createMeasurementUnitEnumeration(
    container: projects.IModule,
    languages: string[]
): enumerations.Enumeration {
    // Deleted here rather than alongside the other documents, because an enumeration cannot go
    // while an attribute still refers to it, and those attributes only go with their entities.
    for (const existing of container.model.allEnumerations()) {
        if (existing.name === "MeasurementUnit" && moduleOf(existing) === container) (existing as any).delete();
    }

    const enumeration = enumerations.Enumeration.createIn(container);
    enumeration.name = "MeasurementUnit";
    for (const unit of MEASUREMENT_UNITS) {
        const value = enumerations.EnumerationValue.createIn(enumeration);
        value.name = unit;
        value.caption = text(container.model, languages, unit.charAt(0) + unit.slice(1).toLowerCase());
    }
    return enumeration;
}

/**
 * Grants `role` read access to everything on `entity`. Without this the client silently shows
 * blank values whenever project security is switched on.
 */
function grantReadAccess(
    entity: domainmodels.Entity,
    associations: domainmodels.Association[],
    role: security.IModuleRole
): void {
    const model = entity.model;
    const rule = domainmodels.AccessRule.create(model);
    rule.moduleRoles.push(role);
    rule.allowCreate = true;
    rule.allowDelete = true;
    rule.defaultMemberAccessRights = domainmodels.MemberAccessRights.ReadWrite;

    for (const attribute of entity.attributes) {
        const access = domainmodels.MemberAccess.createIn(rule);
        access.attribute = attribute;
        access.accessRights = domainmodels.MemberAccessRights.ReadWrite;
    }
    for (const association of associations) {
        if (association.parent !== entity) continue;
        const access = domainmodels.MemberAccess.createIn(rule);
        access.association = association;
        access.accessRights = domainmodels.MemberAccessRights.ReadWrite;
    }
    entity.accessRules.push(rule);
}

/**
 * Drops what an earlier run left behind. Associations go first: deleting an entity that still has
 * one leaves the association pointing at nothing.
 */
function removePreviousRun(domainModel: domainmodels.DomainModel, entityNames: string[]): void {
    const doomed = new Set(entityNames);
    for (const association of [...domainModel.associations]) {
        if (doomed.has(association.parent.name) || doomed.has(association.child.name)) association.delete();
    }
    for (const entity of [...domainModel.entities]) {
        if (doomed.has(entity.name)) entity.delete();
    }
}

/** Every entity this script owns, in the order the build log lists them. */
export const GENERATED_ENTITIES = [
    "HomeContext",
    "Category",
    "RecipeSummary",
    "RecipeDetail",
    "RecipeStep",
    "RecipeIngredient",
    "RecipeCategory",
    "NewRecipe",
    "NewRecipeStep",
    "NewRecipeIngredient",
    "NewRecipeCategory"
];

export async function buildDomainModel(
    module: projects.IModule,
    role: security.IModuleRole,
    languages: string[]
): Promise<RecipeDomain> {
    const domainModel = await module.domainModel.load();
    removePreviousRun(domainModel, GENERATED_ENTITIES);
    const measurementUnit = createMeasurementUnitEnumeration(module, languages);

    const homeContext = createEntity(domainModel, "HomeContext", { x: 60, y: 60 }, [
        { name: "SelectedCategory", type: "String" }
    ]);
    const category = createEntity(domainModel, "Category", { x: 60, y: 220 }, [{ name: "Name", type: "String" }]);
    const recipeSummary = createEntity(domainModel, "RecipeSummary", { x: 340, y: 60 }, [
        { name: "RecipeId", type: "String" },
        { name: "Name", type: "String" },
        { name: "DescriptionPrefix", type: "String" },
        { name: "PreparationTimeInMinutes", type: "Integer" }
    ]);
    const recipeDetail = createEntity(domainModel, "RecipeDetail", { x: 340, y: 280 }, [
        { name: "RecipeId", type: "String" },
        { name: "Name", type: "String" },
        { name: "Description", type: "String" },
        { name: "Author", type: "String" },
        { name: "PostedAt", type: "DateTime" },
        { name: "PostedTo", type: "String" },
        { name: "PreparationTimeInMinutes", type: "Integer" }
    ]);
    const recipeStep = createEntity(domainModel, "RecipeStep", { x: 700, y: 200 }, [
        { name: "Description", type: "String" }
    ]);
    const recipeIngredient = createEntity(domainModel, "RecipeIngredient", { x: 700, y: 340 }, [
        { name: "Name", type: "String" },
        { name: "Quantity", type: "Decimal" },
        { name: "Unit", type: "String" }
    ]);
    const recipeCategory = createEntity(domainModel, "RecipeCategory", { x: 700, y: 500 }, [
        { name: "Name", type: "String" }
    ]);

    // What the add-recipe form fills in, shaped like `CreateRecipeRequestDto`. Kept apart from the
    // entities above: those mirror what the API returns, which is not what it accepts.
    const newRecipe = createEntity(domainModel, "NewRecipe", { x: 1060, y: 60 }, [
        { name: "Name", type: "String" },
        { name: "Description", type: "String" },
        { name: "Author", type: "String" },
        { name: "PostedAt", type: "DateTime" },
        { name: "PostedTo", type: "String" },
        { name: "PreparationTimeInMinutes", type: "Integer" }
    ]);
    const newRecipeStep = createEntity(domainModel, "NewRecipeStep", { x: 1420, y: 60 }, [
        { name: "Description", type: "String" }
    ]);
    const newRecipeIngredient = createEntity(domainModel, "NewRecipeIngredient", { x: 1420, y: 200 }, [
        { name: "Name", type: "String" },
        { name: "Quantity", type: "Decimal" },
        { name: "Unit", type: "Enumeration", enumeration: measurementUnit }
    ]);
    const newRecipeCategory = createEntity(domainModel, "NewRecipeCategory", { x: 1420, y: 380 }, [
        { name: "Name", type: "String" }
    ]);

    const stepToRecipe = createAssociation(domainModel, recipeStep, recipeDetail);
    const ingredientToRecipe = createAssociation(domainModel, recipeIngredient, recipeDetail);
    const categoryToRecipe = createAssociation(domainModel, recipeCategory, recipeDetail);
    // Owned by NewRecipe and set-valued, unlike the three above: the form adds and removes rows
    // from the recipe it is editing, and the export mapping walks the same way round.
    const referenceSet = domainmodels.AssociationType.ReferenceSet;
    const newRecipeToSteps = createAssociation(domainModel, newRecipe, newRecipeStep, referenceSet);
    const newRecipeToIngredients = createAssociation(domainModel, newRecipe, newRecipeIngredient, referenceSet);
    const newRecipeToCategories = createAssociation(domainModel, newRecipe, newRecipeCategory, referenceSet);

    const associations = [
        stepToRecipe,
        ingredientToRecipe,
        categoryToRecipe,
        newRecipeToSteps,
        newRecipeToIngredients,
        newRecipeToCategories
    ];

    for (const entity of [
        homeContext,
        category,
        recipeSummary,
        recipeDetail,
        recipeStep,
        recipeIngredient,
        recipeCategory,
        newRecipe,
        newRecipeStep,
        newRecipeIngredient,
        newRecipeCategory
    ]) {
        grantReadAccess(entity, associations, role);
    }

    return {
        homeContext,
        category,
        recipeSummary,
        recipeDetail,
        recipeStep,
        recipeIngredient,
        recipeCategory,
        stepToRecipe,
        ingredientToRecipe,
        categoryToRecipe,
        measurementUnit,
        newRecipe,
        newRecipeStep,
        newRecipeIngredient,
        newRecipeCategory,
        newRecipeToSteps,
        newRecipeToIngredients,
        newRecipeToCategories
    };
}
