package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Recipe;

public record RecipeSummaryDto(
        String name,
        String descriptionPrefix
) {
    private static final int PREFIX_LEN = 20;
    public static RecipeSummaryDto from(Recipe recipe) {
        String prefix = recipe.description().length() > PREFIX_LEN ? recipe.description().substring(0, PREFIX_LEN) : recipe.description();
        return new RecipeSummaryDto(recipe.name(), prefix + " ... ");
    }
}
