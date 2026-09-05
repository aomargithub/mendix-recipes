package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Recipe;
import org.junit.jupiter.api.Test;

import static com.mendix.recipes.TestRecipes.PREPARATION_TIME;
import static com.mendix.recipes.TestRecipes.recipe;
import static org.junit.jupiter.api.Assertions.assertEquals;

class RecipeSummaryDtoTests {

    @Test
    void shortDescriptionPassesThroughUnchanged() {
        Recipe recipe = recipe("Pasta", "Short dish");

        RecipeSummaryDto dto = RecipeSummaryDto.from(recipe);

        assertEquals("Short dish", dto.descriptionPrefix());
    }

    @Test
    void longDescriptionPassesThroughUnchanged() {
        Recipe recipe = recipe("Pasta", "This description is definitely longer than twenty characters");

        RecipeSummaryDto dto = RecipeSummaryDto.from(recipe);

        assertEquals("This description is definitely longer than twenty characters", dto.descriptionPrefix());
    }

    @Test
    void summaryFieldsAreMappedFromRecipe() {
        Recipe recipe = recipe("Pasta");

        RecipeSummaryDto dto = RecipeSummaryDto.from(recipe);

        assertEquals(recipe.id(), dto.id());
        assertEquals("Pasta", dto.name());
        assertEquals(PREPARATION_TIME, dto.preparationTime());
    }
}
