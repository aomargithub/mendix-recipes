package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Recipe;

import java.time.Duration;
import java.util.UUID;

public record RecipeSummaryDto(
        UUID id,
        String name,
        String descriptionPrefix,
        Duration preparationTime
) {
    private static final int PREFIX_LEN = 20;
    public static RecipeSummaryDto from(Recipe recipe) {
        String prefix = recipe.description().length() > PREFIX_LEN ? recipe.description().substring(0, PREFIX_LEN) :
                recipe.description()+ " ... ";
        return new RecipeSummaryDto(recipe.id(), recipe.name(), prefix , recipe.preparationTime());
    }
}
