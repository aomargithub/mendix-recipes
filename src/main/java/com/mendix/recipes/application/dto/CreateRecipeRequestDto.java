package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.UnknownMeasurementUnitException;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public record CreateRecipeRequestDto (
        String name,
        String description,
        List<String> steps,
        Set<Ingredient> ingredients,
        String author,
        Date postedAt,
        String postedTo,
        int preparationTimeInMinutes,
        Set<String> categories
) {
    public CreateRecipeRequestDto {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Recipe name must not be blank");
        if (description == null || description.isBlank())
            throw new IllegalArgumentException("Recipe description must not be blank");
        if (postedAt == null)
            throw new IllegalArgumentException("Recipe postedAt must not be null");
        if (postedTo == null || postedTo.isBlank())
            throw new IllegalArgumentException("Recipe postedTo must not be blank");
        if (preparationTimeInMinutes <= 0)
            throw new IllegalArgumentException("Recipe preparationTime must be greater than zero");
        if (author == null || author.isBlank())
            throw new IllegalArgumentException("Recipe author must not be blank");
        if (steps == null || steps.isEmpty() || steps.stream().anyMatch(s -> s == null || s.isBlank()))
            throw new IllegalArgumentException("Recipe must have at least one non-blank step");
        if (ingredients == null || ingredients.isEmpty())
            throw new IllegalArgumentException("Recipe must have at least one ingredient");
        if (categories == null || categories.isEmpty())
            throw new IllegalArgumentException("Recipe must have at least one category");
    }

    public record Ingredient(
            String name,
            double quantity,
            String unit
    ) {
        public Ingredient {
            if (name == null || name.isBlank())
                throw new IllegalArgumentException("Ingredient name must not be blank");
            if (quantity <= 0)
                throw new IllegalArgumentException("Ingredient quantity must be greater than zero");
            if (unit == null || unit.isBlank())
                throw new IllegalArgumentException("Ingredient unit must not be blank");
        }
        private com.mendix.recipes.domain.Ingredient toDomain() {
            try {
                MeasurementUnit measurementUnit = MeasurementUnit.valueOf(unit);
                return new com.mendix.recipes.domain.Ingredient(name, quantity, measurementUnit);
            } catch (IllegalArgumentException e) {
                throw new UnknownMeasurementUnitException(unit, MeasurementUnit.values());
            }
        }
    }

    public Recipe toDomain() {
        Set<com.mendix.recipes.domain.Ingredient> ings = ingredients.stream()
                .map(Ingredient::toDomain).collect(Collectors.toSet());
        return Recipe.of(name, description, steps, ings, author, postedAt, postedTo,
                Duration.ofMinutes(preparationTimeInMinutes), categories);
    }
}
