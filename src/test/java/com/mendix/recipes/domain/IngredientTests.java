package com.mendix.recipes.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IngredientTests {

    @Test
    void validIngredientKeepsAllFields() {
        Ingredient ingredient = new Ingredient("spaghetti", 200, MeasurementUnit.GRAM);
        assertEquals("spaghetti", ingredient.name());
        assertEquals(200, ingredient.quantity());
        assertEquals(MeasurementUnit.GRAM, ingredient.unit());
    }

    @Test
    void blankNameIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Ingredient("  ", 200, MeasurementUnit.GRAM));
        assertEquals("Ingredient name must not be blank", ex.getMessage());
    }

    @Test
    void nonPositiveQuantityIsRejected() {
        IllegalArgumentException zero = assertThrows(IllegalArgumentException.class,
                () -> new Ingredient("spaghetti", 0, MeasurementUnit.GRAM));
        IllegalArgumentException negative = assertThrows(IllegalArgumentException.class,
                () -> new Ingredient("spaghetti", -5, MeasurementUnit.GRAM));
        assertEquals("Ingredient quantity must be greater than zero", zero.getMessage());
        assertEquals("Ingredient quantity must be greater than zero", negative.getMessage());
    }

    @Test
    void nullUnitIsRejected() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> new Ingredient("spaghetti", 200, null));
        assertEquals("Ingredient unit must not be null", ex.getMessage());
    }
}
