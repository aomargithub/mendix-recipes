package com.mendix.recipes.infrastructure.seed;

import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.IngredientDto;
import org.junit.jupiter.api.Test;
import tools.jackson.dataformat.xml.XmlMapper;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RecipeMlXmlTests {

    private static final String HEAD = """
            <head>
              <title>Test Dish</title>
              <categories><cat>Pasta</cat></categories>
              <yield>4</yield></head>""";

    private static final String INGREDIENTS = """
            <ingredients>
              <ing><amt><qty>1</qty><unit>pound</unit></amt><item>Beef</item></ing>
            </ingredients>""";

    private static final String DIRECTIONS = """
            <directions>
              <step>  Cook   it
                well.</step></directions>""";

    @Test
    void mapsBasicFieldsWithDefaults() {
        CreateRecipeRequestDto dto = parse(HEAD, INGREDIENTS, DIRECTIONS).toDto();

        assertEquals("Test Dish", dto.name());
        assertEquals("Makes 4 servings", dto.description());
        assertEquals("Unknown", dto.author());
        assertEquals("seed data", dto.postedTo());
        assertEquals(30, dto.preparationTimeInMinutes());
        assertNotNull(dto.postedAt());
        assertEquals(Set.of("Pasta"), dto.categories());
    }

    @Test
    void parsesFractionQuantities() {
        String ingredients = """
                <ingredients>
                  <ing><amt><qty>1 1/2</qty><unit>cups</unit></amt><item>Flour</item></ing>
                  <ing><amt><qty>1/2</qty><unit>teaspoons</unit></amt><item>Salt</item></ing>
                  <ing><amt><qty>3</qty><unit>tablespoons</unit></amt><item>Butter</item></ing>
                </ingredients>""";

        CreateRecipeRequestDto dto = parse(HEAD, ingredients, DIRECTIONS).toDto();

        assertEquals(1.5, ingredient(dto, "Flour").quantity(), 1e-9);
        assertEquals(0.5, ingredient(dto, "Salt").quantity(), 1e-9);
        assertEquals(3.0, ingredient(dto, "Butter").quantity(), 1e-9);
    }

    @Test
    void normalizesUnitPlurals() {
        String ingredients = """
                <ingredients>
                  <ing><amt><qty>1</qty><unit>cups</unit></amt><item>Flour</item></ing>
                  <ing><amt><qty>1</qty><unit>teaspoons</unit></amt><item>Salt</item></ing>
                  <ing><amt><qty>1</qty><unit>tablespoons</unit></amt><item>Butter</item></ing>
                  <ing><amt><qty>1</qty><unit>can</unit></amt><item>Beans</item></ing>
                  <ing><amt><qty>1</qty><unit>package</unit></amt><item>Cake mix</item></ing>
                  <ing><amt><qty>1</qty><unit>pound</unit></amt><item>Beef</item></ing>
                </ingredients>""";

        CreateRecipeRequestDto dto = parse(HEAD, ingredients, DIRECTIONS).toDto();

        assertEquals("CUP", ingredient(dto, "Flour").unit());
        assertEquals("TEASPOON", ingredient(dto, "Salt").unit());
        assertEquals("TABLESPOON", ingredient(dto, "Butter").unit());
        assertEquals("CAN", ingredient(dto, "Beans").unit());
        assertEquals("PACKAGE", ingredient(dto, "Cake mix").unit());
        assertEquals("POUND", ingredient(dto, "Beef").unit());
    }

    @Test
    void emptyQuantityAndUnitDefaultToPiece() {
        String ingredients = """
                <ingredients>
                  <ing><amt><qty/><unit/></amt><item>Hot pepper sauce; to taste</item></ing>
                  <ing><amt><qty>3</qty><unit/></amt><item>Eggs; beaten</item></ing>
                </ingredients>""";

        CreateRecipeRequestDto dto = parse(HEAD, ingredients, DIRECTIONS).toDto();

        assertEquals(1.0, ingredient(dto, "Hot pepper sauce; to taste").quantity(), 1e-9);
        assertEquals("PIECE", ingredient(dto, "Hot pepper sauce; to taste").unit());
        assertEquals(3.0, ingredient(dto, "Eggs; beaten").quantity(), 1e-9);
        assertEquals("PIECE", ingredient(dto, "Eggs; beaten").unit());
    }

    @Test
    void flattensIngDivIngredients() {
        String ingredients = """
                <ingredients>
                  <ing><amt><qty>1</qty><unit>cup</unit></amt><item>Direct ingredient</item></ing>
                  <ing-div>
                    <title>Glaze</title>
                    <ing><amt><qty>1</qty><unit>can</unit></amt><item>Nested ingredient</item></ing>
                  </ing-div>
                </ingredients>""";

        CreateRecipeRequestDto dto = parse(HEAD, ingredients, DIRECTIONS).toDto();

        assertEquals(2, dto.ingredients().size());
        assertEquals("CUP", ingredient(dto, "Direct ingredient").unit());
        assertEquals("CAN", ingredient(dto, "Nested ingredient").unit());
    }

    @Test
    void normalizesStepWhitespace() {
        CreateRecipeRequestDto dto = parse(HEAD, INGREDIENTS, DIRECTIONS).toDto();

        assertEquals(List.of("Cook it well."), dto.steps());
    }

    @Test
    void singularYieldYieldsSingularDescription() {
        String head = """
                <head>
                  <title>Amaretto Cake</title>
                  <categories><cat>Cakes</cat></categories>
                  <yield>1</yield></head>""";

        CreateRecipeRequestDto dto = parse(head, INGREDIENTS, DIRECTIONS).toDto();

        assertEquals("Makes 1 serving", dto.description());
    }

    @Test
    void missingYieldFallsBackToDefaultDescription() {
        String head = """
                <head>
                  <title>Test Dish</title>
                  <categories><cat>Pasta</cat></categories></head>""";

        CreateRecipeRequestDto dto = parse(head, INGREDIENTS, DIRECTIONS).toDto();

        assertEquals("A classic homemade dish", dto.description());
    }

    @Test
    void unknownUnitFailsFast() {
        String ingredients = """
                <ingredients>
                  <ing><amt><qty>1</qty><unit>gallon</unit></amt><item>Water</item></ing>
                </ingredients>""";

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> parse(HEAD, ingredients, DIRECTIONS).toDto());

        assertEquals("Unsupported seed unit: gallon", ex.getMessage());
    }

    @Test
    void malformedXmlFailsFast() {
        assertThrows(RuntimeException.class,
                () -> XmlMapper.builder().build().readValue("<broken>", RecipeMlXml.class));
    }

    private static IngredientDto ingredient(CreateRecipeRequestDto dto, String name) {
        return dto.ingredients().stream()
                .filter(ingredient -> ingredient.name().equals(name))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Missing ingredient: " + name));
    }

    private static RecipeMlXml parse(String head, String ingredients, String directions) {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <recipeml version="0.5">
                  <recipe>
                    %s
                    %s
                    %s
                  </recipe>
                </recipeml>
                """.formatted(head, ingredients, directions);
        return XmlMapper.builder().build().readValue(xml, RecipeMlXml.class);
    }
}
