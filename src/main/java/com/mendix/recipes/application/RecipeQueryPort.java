package com.mendix.recipes.application;

import com.mendix.recipes.application.dto.RecipeSummaryDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;


public interface RecipeQueryPort {
    List<String> getAllCategories();
    Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable);
    Page<RecipeSummaryDto> search(String searchKey, Pageable pageable);
}
