package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Recipe;

import java.time.Duration;
import java.util.UUID;

public record RecipeSummaryDto(
        UUID id,
        String name,
        String descriptionPrefix,
        long preparationTimeInMinutes
) {
    public static RecipeSummaryDto from(Recipe recipe) {
        return new RecipeSummaryDto(recipe.id(), recipe.name(), recipe.description() , recipe.preparationTime().toMinutes());
    }
}