package com.mendix.recipes.domain;

public record Ingredient(
        String name,
        double quantity,
        MeasurementUnit unit
) {
    public Ingredient {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Ingredient name must not be blank");
        if (quantity <= 0)
            throw new IllegalArgumentException("Ingredient quantity must be greater than zero");
        if (unit == null)
            throw new IllegalArgumentException("Ingredient unit must not be null");
    }
}
