package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Ingredient;
import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.UnknownMeasurementUnitException;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Set;

import static com.mendix.recipes.TestRecipes.AUTHOR;
import static com.mendix.recipes.TestRecipes.DESCRIPTION;
import static com.mendix.recipes.TestRecipes.POSTED_TO;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CreateRecipeRequestDtoTests {

    @Test
    void validRequestMapsToDomainRecipe() {
        Date postedAt = new Date();
        CreateRecipeRequestDto request = new CreateRecipeRequestDto(
                "Pasta", DESCRIPTION, List.of("Step one", "Step two"),
                Set.of(new IngredientDto("spaghetti", 200, "GRAM")),
                AUTHOR, postedAt, POSTED_TO, 15, Set.of("Italian"));

        Recipe recipe = request.toDomain();

        assertEquals("Pasta", recipe.name());
        assertEquals(DESCRIPTION, recipe.description());
        assertEquals(List.of("Step one", "Step two"), recipe.steps());
        assertEquals(Set.of(new Ingredient("spaghetti", 200, MeasurementUnit.GRAM)), recipe.ingredients());
        assertEquals(AUTHOR, recipe.author());
        assertEquals(postedAt, recipe.postedAt());
        assertEquals(POSTED_TO, recipe.postedTo());
        assertEquals(Duration.ofMinutes(15), recipe.preparationTime());
        assertEquals(Set.of("italian"), recipe.categories());
    }

    @Test
    void unknownUnitIsRejectedWithSupportedUnits() {
        CreateRecipeRequestDto request = new CreateRecipeRequestDto(
                "Pasta", DESCRIPTION, List.of("Step one"),
                Set.of(new IngredientDto("spaghetti", 200, "GALLON")),
                AUTHOR, new Date(), POSTED_TO, 15, Set.of("italian"));

        UnknownMeasurementUnitException ex = assertThrows(UnknownMeasurementUnitException.class,
                request::toDomain);

        assertEquals("Unknown Unit: GALLON, currently supported units: "
                + "[LITER, CUP, TABLESPOON, TEASPOON, GRAM, POUND, PIECE, CAN, PACKAGE, JAR]",
                ex.getMessage());
    }

    @Test
    void blankNameIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new CreateRecipeRequestDto("  ", DESCRIPTION, List.of("Step one"),
                        Set.of(new IngredientDto("spaghetti", 200, "GRAM")),
                        AUTHOR, new Date(), POSTED_TO, 15, Set.of("italian")));
        assertEquals("Recipe name must not be blank", ex.getMessage());
    }

    @Test
    void missingStepsAreRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new CreateRecipeRequestDto("Pasta", DESCRIPTION, List.of(),
                        Set.of(new IngredientDto("spaghetti", 200, "GRAM")),
                        AUTHOR, new Date(), POSTED_TO, 15, Set.of("italian")));
        assertEquals("Recipe must have at least one non-blank step", ex.getMessage());
    }

    @Test
    void zeroPreparationTimeIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new CreateRecipeRequestDto("Pasta", DESCRIPTION, List.of("Step one"),
                        Set.of(new IngredientDto("spaghetti", 200, "GRAM")),
                        AUTHOR, new Date(), POSTED_TO, 0, Set.of("italian")));
        assertEquals("Recipe preparationTime must be greater than zero", ex.getMessage());
    }

    @Test
    void nullPostedAtIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new CreateRecipeRequestDto("Pasta", DESCRIPTION, List.of("Step one"),
                        Set.of(new IngredientDto("spaghetti", 200, "GRAM")),
                        AUTHOR, null, POSTED_TO, 15, Set.of("italian")));
        assertEquals("Recipe postedAt must not be null", ex.getMessage());
    }
}
