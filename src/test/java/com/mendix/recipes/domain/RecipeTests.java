package com.mendix.recipes.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static com.mendix.recipes.TestRecipes.AUTHOR;
import static com.mendix.recipes.TestRecipes.CATEGORIES;
import static com.mendix.recipes.TestRecipes.DESCRIPTION;
import static com.mendix.recipes.TestRecipes.INGREDIENTS;
import static com.mendix.recipes.TestRecipes.POSTED_TO;
import static com.mendix.recipes.TestRecipes.PREPARATION_TIME;
import static com.mendix.recipes.TestRecipes.STEPS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecipeTests {

    @Test
    void validRecipeKeepsAllFields() {
        UUID id = UUID.randomUUID();
        Date postedAt = new Date();

        Recipe recipe = new Recipe(id, "Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, postedAt,
                POSTED_TO, PREPARATION_TIME, CATEGORIES);

        assertEquals(id, recipe.id());
        assertEquals("Pasta", recipe.name());
        assertEquals(DESCRIPTION, recipe.description());
        assertEquals(STEPS, recipe.steps());
        assertEquals(INGREDIENTS, recipe.ingredients());
        assertEquals(AUTHOR, recipe.author());
        assertEquals(postedAt, recipe.postedAt());
        assertEquals(POSTED_TO, recipe.postedTo());
        assertEquals(PREPARATION_TIME, recipe.preparationTime());
        assertEquals(CATEGORIES, recipe.categories());
    }

    @Test
    void nullIdIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(null, "Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                        POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe id must not be null", ex.getMessage());
    }

    @Test
    void blankNameIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "   ", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR,
                        new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe name must not be blank", ex.getMessage());
    }

    @Test
    void blankDescriptionIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", " ", STEPS, INGREDIENTS, AUTHOR,
                        new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe description must not be blank", ex.getMessage());
    }

    @Test
    void nullPostedAtIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR,
                        null, POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe postedAt must not be null", ex.getMessage());
    }

    @Test
    void blankPostedToIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR,
                        new Date(), "", PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe postedTo must not be blank", ex.getMessage());
    }

    @Test
    void nullPreparationTimeIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR,
                        new Date(), POSTED_TO, null, CATEGORIES));
        assertEquals("Recipe preparationTime must not be null", ex.getMessage());
    }

    @Test
    void blankAuthorIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, INGREDIENTS, " ",
                        new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe author must not be blank", ex.getMessage());
    }

    @Test
    void emptyStepsAreRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, List.of(), INGREDIENTS,
                        AUTHOR, new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe must have at least one non-blank step", ex.getMessage());
    }

    @Test
    void blankStepIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, List.of("  "), INGREDIENTS,
                        AUTHOR, new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe must have at least one non-blank step", ex.getMessage());
    }

    @Test
    void missingIngredientsAreRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, Set.of(),
                        AUTHOR, new Date(), POSTED_TO, PREPARATION_TIME, CATEGORIES));
        assertEquals("Recipe must have at least one ingredient", ex.getMessage());
    }

    @Test
    void missingCategoriesAreRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Recipe(UUID.randomUUID(), "Pasta", DESCRIPTION, STEPS, INGREDIENTS,
                        AUTHOR, new Date(), POSTED_TO, PREPARATION_TIME, Set.of()));
        assertEquals("Recipe must have at least one category", ex.getMessage());
    }

    @Test
    void nameIsTrimmed() {
        Recipe recipe = Recipe.of("  Pasta  ", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, CATEGORIES);
        assertEquals("Pasta", recipe.name());
    }

    @Test
    void categoriesAreNormalizedToLowerCase() {
        Recipe recipe = Recipe.of("Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, Set.of("Italian", "VEGAN"));
        assertEquals(Set.of("italian", "vegan"), recipe.categories());
    }

    @Test
    void stepsAreCopiedAndImmutable() {
        List<String> steps = new ArrayList<>(List.of("Step one"));
        Recipe recipe = Recipe.of("Pasta", DESCRIPTION, steps, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, CATEGORIES);
        steps.add("Step two");

        assertEquals(1, recipe.steps().size());
        assertThrows(UnsupportedOperationException.class, () -> recipe.steps().add("Step three"));
    }

    @Test
    void ingredientsAndCategoriesAreImmutable() {
        Recipe recipe = Recipe.of("Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, new HashSet<>(CATEGORIES));
        assertThrows(UnsupportedOperationException.class, () -> recipe.ingredients().add(
                new Ingredient("garlic", 1, MeasurementUnit.PIECE)));
        assertThrows(UnsupportedOperationException.class, () -> recipe.categories().add("french"));
    }

    @Test
    void ofGeneratesDistinctIds() {
        Recipe first = Recipe.of("Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, CATEGORIES);
        Recipe second = Recipe.of("Pasta", DESCRIPTION, STEPS, INGREDIENTS, AUTHOR, new Date(),
                POSTED_TO, PREPARATION_TIME, CATEGORIES);
        assertNotEquals(first.id(), second.id());
        assertTrue(first.id() != null && second.id() != null);
    }
}
