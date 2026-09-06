package com.mendix.recipes.infrastructure.rest;


import com.mendix.recipes.application.RecipeService;
import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.GetRecipeResponseDto;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.SortNotSupportedException;
import com.mendix.recipes.domain.UnknownParameterException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/v1")
public class RecipeController {
    private static final Set<String> PAGING_PARAMS = Set.of("page", "size");
    private static final Set<String> SUPPORTED_PARAMS = Set.of("q", "page", "size");

    private final RecipeService recipeService;

    public RecipeController (RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping("/categories")
    public ResponseEntity<List<String>> getAllCategories() {
        return ResponseEntity.ok(recipeService.getAllCategories());
    }

    @GetMapping("/recipes")
    public ResponseEntity<Page<RecipeSummaryDto>> findRecipes(
            @RequestParam(name = "q", required = false) String searchKey,
            @RequestParam Map<String, String> params,
            Pageable pageable) {
        rejectSorting(params);
        rejectUnknownParameters(params);
        Pageable effectivePageable = unpagedUnlessPagingRequested(params, pageable);
        return ResponseEntity.ok(recipeService.search(searchKey, effectivePageable));
    }

    @GetMapping("/recipes/{id}")
    public ResponseEntity<GetRecipeResponseDto> getRecipeById(@PathVariable UUID id) {
        return ResponseEntity.ok(recipeService.getRecipeById(id));
    }

    @GetMapping("/categories/{category}/recipes")
    public ResponseEntity<Page<RecipeSummaryDto>> getRecipesByCategory(@PathVariable String category,
            @RequestParam Map<String, String> params, Pageable pageable) {
        rejectSorting(params);
        Pageable effectivePageable = unpagedUnlessPagingRequested(params, pageable);
        return ResponseEntity.ok(recipeService.getRecipesByCategory(category, effectivePageable));
    }

    @PostMapping("/recipes")
    public ResponseEntity<Void> addRecipe(@RequestBody CreateRecipeRequestDto request, HttpServletRequest httpRequest) {
        UUID id = recipeService.addRecipe(request);
        return ResponseEntity.created(URI.create(httpRequest.getContextPath() + "/v1/recipes/" + id)).build();
    }

    private static void rejectSorting(Map<String, String> params) {
        if (params.keySet().stream().anyMatch("sort"::equalsIgnoreCase)) {
            throw new SortNotSupportedException();
        }
    }

    private static void rejectUnknownParameters(Map<String, String> params) {
        Set<String> unknown = params.keySet().stream()
                .filter(param -> !SUPPORTED_PARAMS.contains(param))
                .collect(Collectors.toSet());
        if (!unknown.isEmpty()) {
            throw new UnknownParameterException(unknown, SUPPORTED_PARAMS);
        }
    }

    private static Pageable unpagedUnlessPagingRequested(Map<String, String> params, Pageable pageable) {
        boolean pagingRequested = params.keySet().stream().anyMatch(PAGING_PARAMS::contains);
        return pagingRequested ? pageable : Pageable.unpaged();
    }
}
