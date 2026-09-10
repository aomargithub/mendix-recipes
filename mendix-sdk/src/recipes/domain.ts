/**
 * The domain model behind the recipe screens.
 *
 * Everything the app shows comes from the recipes REST API and is thrown away at the end of the
 * session, so every entity here is non-persistable. `HomeContext` is the exception in spirit
 * rather than in kind: it holds no API data, only which category the user picked, which is what
 * lets the recipe list on the home page react to a click in the category list.
 */
import { IModel, domainmodels, projects, security } from "mendixmodelsdk";

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
}

type AttributeSpec = {
    name: string;
    type: "String" | "Integer" | "Decimal" | "DateTime";
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
    child: domainmodels.Entity
): domainmodels.Association {
    const association = domainmodels.Association.createIn(domainModel);
    // Mendix names an association <owner>_<target>; `parent` is the many side holding the reference.
    association.name = `${parent.name}_${child.name}`;
    association.parent = parent;
    association.child = child;
    association.type = domainmodels.AssociationType.Reference;
    association.owner = domainmodels.AssociationOwner.Default;
    association.parentConnection = { x: 0, y: 15 };
    association.childConnection = { x: 100, y: 15 };
    return association;
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

export async function buildDomainModel(
    module: projects.IModule,
    role: security.IModuleRole
): Promise<RecipeDomain> {
    const domainModel = await module.domainModel.load();

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

    const stepToRecipe = createAssociation(domainModel, recipeStep, recipeDetail);
    const ingredientToRecipe = createAssociation(domainModel, recipeIngredient, recipeDetail);
    const categoryToRecipe = createAssociation(domainModel, recipeCategory, recipeDetail);
    const associations = [stepToRecipe, ingredientToRecipe, categoryToRecipe];

    for (const entity of [
        homeContext,
        category,
        recipeSummary,
        recipeDetail,
        recipeStep,
        recipeIngredient,
        recipeCategory
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
        categoryToRecipe
    };
}
