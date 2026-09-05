package com.mendix.recipes.infrastructure.rest;


import com.mendix.recipes.application.RecipeService;
import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/v1")
public class RecipeController {
    private static final Set<String> PAGING_PARAMS = Set.of("page", "size", "sort");
    private static final Set<String> PAGE_SIZE_PARAMS = Set.of("page", "size");

    private final RecipeService recipeService;

    public RecipeController (RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @GetMapping("/categories")
    public ResponseEntity<?> getAllCategories() {
        return ResponseEntity.ok(recipeService.getAllCategories());
    }

    @GetMapping("/recipes")
    public ResponseEntity<?> findRecipesBy(@RequestParam Map<String, String> searchParams, Pageable pageable) {
        Pageable effectivePageable = unpagedUnlessPagingRequested(searchParams, pageable);
        return ResponseEntity.ok(recipeService.findRecipesBy(cleanSearchCriteria(searchParams), effectivePageable));
    }

    @GetMapping("/recipes/{id}")
    public ResponseEntity<?> getRecipeById(@PathVariable UUID id) {
        return ResponseEntity.ok(recipeService.getRecipeById(id));
    }

    @GetMapping("/categories/{category}/recipes")
    public ResponseEntity<?> getRecipesByCategory(@PathVariable String category,
            @RequestParam Map<String, String> params, Pageable pageable) {
        Pageable effectivePageable = unpagedUnlessPagingRequested(params, pageable);
        return ResponseEntity.ok(recipeService.getRecipesByCategory(category, effectivePageable));
    }

    @PostMapping("/recipes")
    public ResponseEntity<?> addRecipe(@RequestBody CreateRecipeRequestDto request) {
        UUID id = recipeService.addRecipe(request);
        return ResponseEntity.created(URI.create("/v1/recipes/" + id)).build();
    }

    private Map<String, String> cleanSearchCriteria(Map<String, String> params) {
        Map<String, String> criteria = new HashMap<>(params);
        criteria.keySet().removeAll(PAGING_PARAMS);
        return criteria;
    }

    private static Pageable unpagedUnlessPagingRequested(Map<String, String> params, Pageable pageable) {
        boolean pagingRequested = params.keySet().stream().anyMatch(PAGE_SIZE_PARAMS::contains);
        return pagingRequested ? pageable : Pageable.unpaged(pageable.getSort());
    }
}
