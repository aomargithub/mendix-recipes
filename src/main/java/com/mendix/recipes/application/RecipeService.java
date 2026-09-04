package com.mendix.recipes.application;

import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class RecipeService {

    private final RecipesRepository recipesRepository;
    private final RecipeQueryPort recipeQueryPort;

    public RecipeService(RecipesRepository recipesRepository, RecipeQueryPort recipeQueryPort) {
        this.recipesRepository = recipesRepository;
        this.recipeQueryPort = recipeQueryPort;
    }
    public Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable) {
        Page<RecipeSummaryDto> result = recipeQueryPort.getRecipesByCategory(category, pageable);
        if (result.getTotalElements() == 0) {
            throw new ResourceNotFoundException("Category", category);
        }
        return result;
    }

    public Page<RecipeSummaryDto> findRecipesBy(Map<String, String> criteria, Pageable pageable) {
        Set<String> unknown = criteria.keySet().stream()
                .filter(key -> !RecipeQueryPort.SUPPORTED_FILTERS.contains(key))
                .collect(Collectors.toSet());
        if (!unknown.isEmpty()) {
            throw new UnknownFilterException(unknown, RecipeQueryPort.SUPPORTED_FILTERS);
        }
        return recipeQueryPort.findRecipesBy(criteria, pageable);
    }

    public List<String> getAllCategories() {
        return recipesRepository.getAllCategories();
    }

    public Recipe getRecipeByName(String name) {
        Recipe recipe = recipesRepository.getRecipeByName(name);
        if (recipe == null) {
            throw new ResourceNotFoundException("Recipe", name);
        }
        return recipe;
    }

    public void addRecipe(Recipe recipe) {
        if (!recipesRepository.addRecipe(recipe)) {
            throw new RecipeNameAlreadyExistsException(recipe.name());
        }

    }
}
