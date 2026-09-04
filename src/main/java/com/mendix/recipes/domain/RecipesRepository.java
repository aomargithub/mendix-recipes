package com.mendix.recipes.domain;

public interface RecipesRepository {
    boolean addRecipe(Recipe recipe);
    Recipe getRecipeByName(String name);
}
