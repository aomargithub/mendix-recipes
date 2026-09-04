package com.mendix.recipes.application;

import com.mendix.recipes.application.dto.RecipeSummaryDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.Set;


public interface RecipeQueryPort {
    Set<String> SUPPORTED_FILTERS = Set.of("name", "category", "author");
    List<String> getAllCategories();
    Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable);
    Page<RecipeSummaryDto> findRecipesBy(Map<String, String> criteria, Pageable pageable);
}
