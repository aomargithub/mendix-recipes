package com.mendix.recipes.infrastructure.seed;

import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.IngredientDto;
import com.mendix.recipes.domain.MeasurementUnit;
import tools.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import tools.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import tools.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@JacksonXmlRootElement(localName = "recipeml")
public record RecipeMlXml(
        @JacksonXmlProperty(localName = "recipe") RecipeXml recipe) {

    public record RecipeXml(
            @JacksonXmlProperty(localName = "head") HeadXml head,
            @JacksonXmlProperty(localName = "ingredients") IngredientsXml ingredients,
            @JacksonXmlProperty(localName = "directions") DirectionsXml directions) {
    }

    public record HeadXml(
            @JacksonXmlProperty(localName = "title") String title,
            @JacksonXmlProperty(localName = "categories") CategoriesXml categories,
            @JacksonXmlProperty(localName = "yield") String yield) {
    }

    public record CategoriesXml(
            @JacksonXmlElementWrapper(useWrapping = false)
            @JacksonXmlProperty(localName = "cat")
            List<String> cat) {
    }

    public record IngredientsXml(
            @JacksonXmlElementWrapper(useWrapping = false)
            @JacksonXmlProperty(localName = "ing")
            List<IngXml> ing,
            @JacksonXmlElementWrapper(useWrapping = false)
            @JacksonXmlProperty(localName = "ing-div")
            List<IngDivXml> ingDiv) {
    }

    public record IngDivXml(
            @JacksonXmlProperty(localName = "title") String title,
            @JacksonXmlElementWrapper(useWrapping = false)
            @JacksonXmlProperty(localName = "ing")
            List<IngXml> ing) {
    }

    public record IngXml(
            @JacksonXmlProperty(localName = "amt") AmtXml amt,
            @JacksonXmlProperty(localName = "item") String item) {
    }

    public record AmtXml(
            @JacksonXmlProperty(localName = "qty") String qty,
            @JacksonXmlProperty(localName = "unit") String unit) {
    }

    public record DirectionsXml(
            @JacksonXmlElementWrapper(useWrapping = false)
            @JacksonXmlProperty(localName = "step")
            List<String> step) {
    }

    public CreateRecipeRequestDto toDto() {
        return new CreateRecipeRequestDto(
                name(),
                description(recipe.head().yield()),
                steps(),
                ingredients(),
                "Unknown",
                new Date(),
                "seed data",
                30,
                categories());
    }

    private String name() {
        String title = recipe.head().title();
        if (title == null || title.isBlank()) {
            throw new IllegalStateException("Seed recipe has no title");
        }
        return title.trim();
    }

    private List<String> steps() {
        List<String> raw = recipe.directions() == null ? null : recipe.directions().step();
        if (raw == null || raw.isEmpty()) {
            throw new IllegalStateException("Seed recipe '" + name() + "' has no directions");
        }
        List<String> steps = raw.stream()
                .map(step -> step.replaceAll("\\s+", " ").trim())
                .filter(step -> !step.isEmpty())
                .toList();
        if (steps.isEmpty()) {
            throw new IllegalStateException("Seed recipe '" + name() + "' has no non-blank directions");
        }
        return steps;
    }

    private Set<IngredientDto> ingredients() {
        List<IngXml> all = new ArrayList<>();
        IngredientsXml ingredients = recipe.ingredients();
        if (ingredients != null) {
            addAll(all, ingredients.ing());
            if (ingredients.ingDiv() != null) {
                for (IngDivXml div : ingredients.ingDiv()) {
                    addAll(all, div.ing());
                }
            }
        }
        if (all.isEmpty()) {
            throw new IllegalStateException("Seed recipe '" + name() + "' has no ingredients");
        }
        return all.stream().map(RecipeMlXml::toIngredient).collect(Collectors.toSet());
    }

    private static void addAll(List<IngXml> target, List<IngXml> source) {
        if (source != null) {
            target.addAll(source);
        }
    }

    private Set<String> categories() {
        List<String> cat = recipe.head().categories() == null ? null : recipe.head().categories().cat();
        if (cat == null || cat.isEmpty()) {
            throw new IllegalStateException("Seed recipe '" + name() + "' has no categories");
        }
        return cat.stream().map(String::trim).collect(Collectors.toSet());
    }

    private static IngredientDto toIngredient(IngXml ing) {
        String item = ing.item();
        if (item == null || item.isBlank()) {
            throw new IllegalStateException("Seed ingredient has no item name");
        }
        AmtXml amt = ing.amt();
        double quantity = quantity(amt == null ? null : amt.qty());
        MeasurementUnit unit = unit(amt == null ? null : amt.unit());
        return new IngredientDto(item.trim(), quantity, unit.name());
    }

    private static double quantity(String qty) {
        if (qty == null || qty.isBlank()) {
            return 1;
        }
        double total = 0;
        for (String part : qty.trim().split("\\s+")) {
            if (part.contains("/")) {
                String[] fraction = part.split("/");
                total += Double.parseDouble(fraction[0]) / Double.parseDouble(fraction[1]);
            } else {
                total += Double.parseDouble(part);
            }
        }
        return total;
    }

    private static MeasurementUnit unit(String unit) {
        if (unit == null || unit.isBlank()) {
            return MeasurementUnit.PIECE;
        }
        return switch (unit.trim().toLowerCase()) {
            case "cup", "cups" -> MeasurementUnit.CUP;
            case "tablespoon", "tablespoons" -> MeasurementUnit.TABLESPOON;
            case "teaspoon", "teaspoons" -> MeasurementUnit.TEASPOON;
            case "gram", "grams" -> MeasurementUnit.GRAM;
            case "pound", "pounds" -> MeasurementUnit.POUND;
            case "liter", "liters", "litre", "litres" -> MeasurementUnit.LITER;
            case "can", "cans" -> MeasurementUnit.CAN;
            case "package", "packages" -> MeasurementUnit.PACKAGE;
            case "jar", "jars" -> MeasurementUnit.JAR;
            case "piece", "pieces" -> MeasurementUnit.PIECE;
            default -> throw new IllegalStateException("Unsupported seed unit: " + unit.trim());
        };
    }

    private static String description(String yield) {
        if (yield == null || yield.isBlank()) {
            return "A classic homemade dish";
        }
        String value = yield.trim();
        return "Makes " + value + ("1".equals(value) ? " serving" : " servings");
    }
}
