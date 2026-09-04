package com.mendix.recipes.infrastructure.rest;


import com.mendix.recipes.application.RecipeService;
import com.mendix.recipes.domain.Recipe;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/v1")
public class RecipeController {
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
        return ResponseEntity.ok(recipeService.findRecipesBy(searchParams, pageable));
    }

    @GetMapping("/recipes/{name}")
    public ResponseEntity<?> getRecipeByName(@PathVariable String name) {
        return ResponseEntity.ok(recipeService.getRecipeByName(name));
    }

    @GetMapping("/categories/{category}/recipes")
    public ResponseEntity<?> getRecipesByCategory(@PathVariable String category, Pageable pageable) {
        return ResponseEntity.ok(recipeService.getRecipesByCategory(category, pageable));
    }

    @PostMapping("/recipes")
    public ResponseEntity<?> addRecipe(@RequestBody Recipe recipe) {
        recipeService.addRecipe(recipe);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
