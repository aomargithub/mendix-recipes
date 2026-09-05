package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Ingredient;
import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.UnknownMeasurementUnitException;

public record IngredientDto (
        String name,
        double quantity,
        String unit
) {
    public IngredientDto {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("Ingredient name must not be blank");
        if (quantity <= 0)
            throw new IllegalArgumentException("Ingredient quantity must be greater than zero");
        if (unit == null || unit.isBlank())
            throw new IllegalArgumentException("Ingredient unit must not be blank");
    }
    public Ingredient toDomain() {
        try {
            MeasurementUnit measurementUnit = MeasurementUnit.valueOf(unit);
            return new Ingredient(name, quantity, measurementUnit);
        } catch (IllegalArgumentException e) {
            throw new UnknownMeasurementUnitException(unit, MeasurementUnit.values());
        }
    }

    public static IngredientDto from(Ingredient ingredient) {
        return new IngredientDto(ingredient.name(), ingredient.quantity(), ingredient.unit().name());
    }
}
