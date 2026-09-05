package com.mendix.recipes.application.dto;

import com.mendix.recipes.domain.Recipe;

import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public record GetRecipeResponseDto (
        UUID id,
        String name,
        String description,
        List<String> steps,
        Set<IngredientDto> ingredients,
        String author,
        Date postedAt,
        String postedTo,
        long preparationTimeInMinutes,
        Set<String> categories
){
    public static GetRecipeResponseDto from(Recipe recipe) {
        Set<IngredientDto> ingredientDtos = recipe.ingredients().stream().map(IngredientDto::from).collect(Collectors.toSet());
        return new GetRecipeResponseDto(recipe.id(), recipe.name(), recipe.description(), recipe.steps(),
                ingredientDtos, recipe.author(), recipe.postedAt(), recipe.postedTo(),
                recipe.preparationTime().toMinutes(), recipe.categories());
    }
}
