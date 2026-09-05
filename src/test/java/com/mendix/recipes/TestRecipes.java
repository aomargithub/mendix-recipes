package com.mendix.recipes;

import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.domain.Ingredient;
import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.Recipe;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Set;

public final class TestRecipes {

    public static final String DESCRIPTION = "A tasty dish with a description long enough to matter";
    public static final List<String> STEPS = List.of("Step one", "Step two");
    public static final Set<Ingredient> INGREDIENTS =
            Set.of(new Ingredient("spaghetti", 200, MeasurementUnit.GRAM));
    public static final String AUTHOR = "Chef";
    public static final String POSTED_TO = "website";
    public static final Duration PREPARATION_TIME = Duration.ofMinutes(5);
    public static final Set<String> CATEGORIES = Set.of("italian");

    private TestRecipes() {
    }

    public static Recipe recipe(String name) {
        return recipe(name, AUTHOR, CATEGORIES, new Date());
    }

    public static Recipe recipe(String name, String description) {
        return Recipe.of(name, description, STEPS, INGREDIENTS, AUTHOR, new Date(), POSTED_TO,
                PREPARATION_TIME, CATEGORIES);
    }

    public static Recipe recipe(String name, String author, Set<String> categories, Date postedAt) {
        return Recipe.of(name, DESCRIPTION, STEPS, INGREDIENTS, author, postedAt, POSTED_TO,
                PREPARATION_TIME, categories);
    }

    public static CreateRecipeRequestDto createRequest(String name) {
        return new CreateRecipeRequestDto(
                name,
                DESCRIPTION,
                List.of("Step one", "Step two"),
                Set.of(new CreateRecipeRequestDto.Ingredient("spaghetti", 200, "GRAM")),
                AUTHOR,
                new Date(),
                POSTED_TO,
                5,
                CATEGORIES);
    }
}
