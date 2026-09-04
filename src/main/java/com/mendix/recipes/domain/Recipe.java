package com.mendix.recipes.domain;

import java.util.Date;
import java.util.List;
import java.util.Set;

public record Recipe(
        String name,
        String description,
        List<String> steps,
        Set<Ingredient> ingredients,
        String author,
        Date postedAt,
        String postedTo,
        Set<String> categories
) {
    public Recipe {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Recipe name must not be blank");
        if (description == null || description.isBlank())
            throw new IllegalArgumentException("Recipe description must not be blank");
        if (postedAt == null)
            throw new IllegalArgumentException("Recipe postedAt must not be null");
        if (postedTo == null || postedTo.isBlank())
            throw new IllegalArgumentException("Recipe postedTo must not be blank");
        if (author == null || author.isBlank())
            throw new IllegalArgumentException("Recipe author must not be blank");
        if (steps == null || steps.isEmpty() || steps.stream().anyMatch(s -> s == null || s.isBlank()))
            throw new IllegalArgumentException("Recipe must have at least one non-blank step");
        if (ingredients == null || ingredients.isEmpty())
            throw new IllegalArgumentException("Recipe must have at least one ingredient");

        name = name.trim();
        steps = List.copyOf(steps);          // immutable + null-hostile
        ingredients = Set.copyOf(ingredients);
        categories = categories == null ? Set.of() : Set.copyOf(categories);
    }
}
