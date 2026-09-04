package com.mendix.recipes.domain;

import java.util.List;

public interface RecipesRepository {

    List<String> getAllCategories();
    boolean addRecipe(Recipe recipe);
    Recipe getRecipeByName(String name);
}
