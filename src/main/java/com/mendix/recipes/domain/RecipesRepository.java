package com.mendix.recipes.domain;

import java.util.UUID;

public interface RecipesRepository {
    boolean addRecipe(Recipe recipe);
    Recipe getRecipeById(UUID id);
}
