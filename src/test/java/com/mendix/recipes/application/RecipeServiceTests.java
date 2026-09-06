package com.mendix.recipes.application;

import com.mendix.recipes.application.dto.GetRecipeResponseDto;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.RecipeNameAlreadyExistsException;
import com.mendix.recipes.domain.RecipesRepository;
import com.mendix.recipes.domain.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

import static com.mendix.recipes.TestRecipes.createRequest;
import static com.mendix.recipes.TestRecipes.recipe;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecipeServiceTests {

    private RecipesRepository recipesRepository;
    private RecipeQueryPort recipeQueryPort;
    private RecipeService recipeService;

    @BeforeEach
    void setUp() {
        recipesRepository = mock(RecipesRepository.class);
        recipeQueryPort = mock(RecipeQueryPort.class);
        recipeService = new RecipeService(recipesRepository, recipeQueryPort);
    }

    @Test
    void searchForwardsTrimmedKeyAndPageable() {
        Pageable pageable = PageRequest.of(1, 10);
        Page<RecipeSummaryDto> expected = new PageImpl<>(List.of(), pageable, 0);
        when(recipeQueryPort.search("pasta", pageable)).thenReturn(expected);

        Page<RecipeSummaryDto> result = recipeService.search("  pasta  ", pageable);

        assertSame(expected, result);
    }

    @Test
    void searchForwardsNullKey() {
        Pageable pageable = Pageable.unpaged();
        Page<RecipeSummaryDto> expected = new PageImpl<>(List.of(), pageable, 0);
        when(recipeQueryPort.search(null, pageable)).thenReturn(expected);

        assertSame(expected, recipeService.search(null, pageable));
    }

    @Test
    void getRecipesByCategoryThrowsWhenCategoryIsUnknown() {
        when(recipeQueryPort.getRecipesByCategory(eq("mexican"), any())).thenReturn(null);

        assertThrows(ResourceNotFoundException.class,
                () -> recipeService.getRecipesByCategory("mexican", Pageable.unpaged()));
    }

    @Test
    void getRecipesByCategoryDelegatesToPort() {
        Pageable pageable = PageRequest.of(0, 5);
        Page<RecipeSummaryDto> expected = new PageImpl<>(List.of(), pageable, 0);
        when(recipeQueryPort.getRecipesByCategory("italian", pageable)).thenReturn(expected);

        Page<RecipeSummaryDto> result = recipeService.getRecipesByCategory("italian", pageable);

        assertSame(expected, result);
    }

    @Test
    void getRecipeByIdThrowsWhenRecipeIsUnknown() {
        UUID id = UUID.randomUUID();
        when(recipesRepository.getRecipeById(id)).thenReturn(null);

        assertThrows(ResourceNotFoundException.class, () -> recipeService.getRecipeById(id));
    }

    @Test
    void getRecipeByIdMapsRecipeToResponseDto() {
        Recipe recipe = recipe("Pasta");
        when(recipesRepository.getRecipeById(recipe.id())).thenReturn(recipe);

        GetRecipeResponseDto result = recipeService.getRecipeById(recipe.id());

        assertEquals(recipe.id(), result.id());
        assertEquals("Pasta", result.name());
        assertEquals(5, result.preparationTimeInMinutes());
    }

    @Test
    void addRecipeMapsRequestAndReturnsNewId() {
        when(recipesRepository.addRecipe(any(Recipe.class))).thenReturn(true);

        UUID id = recipeService.addRecipe(createRequest("Pasta"));

        ArgumentCaptor<Recipe> captor = ArgumentCaptor.forClass(Recipe.class);
        verify(recipesRepository).addRecipe(captor.capture());
        assertEquals("Pasta", captor.getValue().name());
        assertEquals(id, captor.getValue().id());
    }

    @Test
    void addRecipeRejectsDuplicateName() {
        when(recipesRepository.addRecipe(any(Recipe.class))).thenReturn(false);

        RecipeNameAlreadyExistsException ex = assertThrows(RecipeNameAlreadyExistsException.class,
                () -> recipeService.addRecipe(createRequest("Pasta")));

        assertEquals("A recipe with name Pasta already exists", ex.getMessage());
    }

    @Test
    void getAllCategoriesDelegatesToPort() {
        when(recipeQueryPort.getAllCategories()).thenReturn(List.of("italian"));

        assertEquals(List.of("italian"), recipeService.getAllCategories());
    }
}
