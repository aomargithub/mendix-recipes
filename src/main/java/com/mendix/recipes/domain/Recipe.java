package com.mendix.recipes.domain;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public record Recipe(
        UUID id,
        String name,
        String description,
        List<String> steps,
        Set<Ingredient> ingredients,
        String author,
        Date postedAt,
        String postedTo,
        Duration preparationTime,
        Set<String> categories
) {
    public Recipe {
        if (id == null) {
            throw new IllegalArgumentException("Recipe id must not be null");
        }
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Recipe name must not be blank");
        if (description == null || description.isBlank())
            throw new IllegalArgumentException("Recipe description must not be blank");
        if (postedAt == null)
            throw new IllegalArgumentException("Recipe postedAt must not be null");
        if (postedTo == null || postedTo.isBlank())
            throw new IllegalArgumentException("Recipe postedTo must not be blank");
        if (preparationTime == null)
            throw new IllegalArgumentException("Recipe preparationTime must not be null");
        if (author == null || author.isBlank())
            throw new IllegalArgumentException("Recipe author must not be blank");
        if (steps == null || steps.isEmpty() || steps.stream().anyMatch(s -> s == null || s.isBlank()))
            throw new IllegalArgumentException("Recipe must have at least one non-blank step");
        if (ingredients == null || ingredients.isEmpty())
            throw new IllegalArgumentException("Recipe must have at least one ingredient");
        if (categories == null || categories.isEmpty())
            throw new IllegalArgumentException("Recipe must have at least one category");

        name = name.trim();
        steps = List.copyOf(steps);          // immutable + null-hostile
        ingredients = Set.copyOf(ingredients);
        categories = categories.stream().map(String::toLowerCase).collect(Collectors.toUnmodifiableSet());
    }

    public static Recipe of (
            String name,
            String description,
            List<String> steps,
            Set<Ingredient> ingredients,
            String author,
            Date postedAt,
            String postedTo,
            Duration preparationTime,
            Set<String> categories
    )
    {
        return new Recipe(UUID.randomUUID(), name, description, steps, ingredients, author, postedAt, postedTo,
                preparationTime, categories);
    }
}
