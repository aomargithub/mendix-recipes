package com.mendix.recipes.application;

import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.GetRecipeResponseDto;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class RecipeService {

    private final RecipesRepository recipesRepository;
    private final RecipeQueryPort recipeQueryPort;

    public RecipeService(RecipesRepository recipesRepository, RecipeQueryPort recipeQueryPort) {
        this.recipesRepository = recipesRepository;
        this.recipeQueryPort = recipeQueryPort;
    }
    public Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable) {
        Page<RecipeSummaryDto> recipes = recipeQueryPort.getRecipesByCategory(category, pageable);
        if (recipes == null) {
            throw new ResourceNotFoundException("Category", category);
        }
        return recipes;
    }

    public Page<RecipeSummaryDto> search(String searchKey, Pageable pageable) {
        return recipeQueryPort.search(searchKey == null ? null : searchKey.trim(), pageable);
    }

    public List<String> getAllCategories() {
        return recipeQueryPort.getAllCategories();
    }

    public GetRecipeResponseDto getRecipeById(UUID id) {
        Recipe recipe = recipesRepository.getRecipeById(id);
        if (recipe == null) {
            throw new ResourceNotFoundException("Recipe", id);
        }
        return GetRecipeResponseDto.from(recipe);
    }

    public UUID addRecipe(CreateRecipeRequestDto request) {
        Recipe recipe = request.toDomain();
        if (!recipesRepository.addRecipe(recipe)) {
            throw new RecipeNameAlreadyExistsException(recipe.name());
        }
        return recipe.id();
    }
}
