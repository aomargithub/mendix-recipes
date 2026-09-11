# Domain model of MyFirstModule

## Entity HomeContext (persistable: false)
  - SelectedCategory: String(0)

## Entity Category (persistable: false)
  - Name: String(0)

## Entity RecipeSummary (persistable: false)
  - RecipeId: String(0)
  - Name: String(0)
  - DescriptionPrefix: String(0)
  - PreparationTimeInMinutes: Integer

## Entity RecipeDetail (persistable: false)
  - RecipeId: String(0)
  - Name: String(0)
  - Description: String(0)
  - Author: String(0)
  - PostedAt: DateTime
  - PostedTo: String(0)
  - PreparationTimeInMinutes: Integer

## Entity RecipeStep (persistable: false)
  - Description: String(0)

## Entity RecipeIngredient (persistable: false)
  - Name: String(0)
  - Quantity: Decimal
  - Unit: String(0)

## Entity RecipeCategory (persistable: false)
  - Name: String(0)

## Entity NewRecipe (persistable: false)
  - Name: String(0)
  - Description: String(0)
  - Author: String(0)
  - PostedAt: DateTime
  - PostedTo: String(0)
  - PreparationTimeInMinutes: Integer

## Entity NewRecipeStep (persistable: false)
  - Description: String(0)

## Entity NewRecipeIngredient (persistable: false)
  - Name: String(0)
  - Quantity: Decimal
  - Unit: String(0)

## Entity NewRecipeCategory (persistable: false)
  - Name: String(0)

## Association RecipeStep_RecipeDetail: RecipeStep -> RecipeDetail [Reference, owner=Default]
## Association RecipeIngredient_RecipeDetail: RecipeIngredient -> RecipeDetail [Reference, owner=Default]
## Association RecipeCategory_RecipeDetail: RecipeCategory -> RecipeDetail [Reference, owner=Default]
## Association NewRecipe_NewRecipeStep: NewRecipe -> NewRecipeStep [ReferenceSet, owner=Default]
## Association NewRecipe_NewRecipeIngredient: NewRecipe -> NewRecipeIngredient [ReferenceSet, owner=Default]
## Association NewRecipe_NewRecipeCategory: NewRecipe -> NewRecipeCategory [ReferenceSet, owner=Default]
