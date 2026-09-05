package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.application.RecipeService;
import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.SortNotSupportedException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.mendix.recipes.TestRecipes.createRequest;
import static com.mendix.recipes.TestRecipes.recipe;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecipeControllerUnitTests {

    private RecipeService recipeService;
    private RecipeController controller;

    @BeforeEach
    void setUp() {
        recipeService = mock(RecipeService.class);
        controller = new RecipeController(recipeService);
    }

    @Test
    void sortParamIsRejectedOnRecipesEndpoint() {
        assertThrows(SortNotSupportedException.class,
                () -> controller.findRecipesBy(Map.of("sort", "name"), Pageable.unpaged()));
    }

    @Test
    void sortParamIsRejectedCaseInsensitive() {
        assertThrows(SortNotSupportedException.class,
                () -> controller.findRecipesBy(Map.of("SORT", "name"), Pageable.unpaged()));
    }

    @Test
    void sortParamIsRejectedOnCategoryEndpoint() {
        assertThrows(SortNotSupportedException.class,
                () -> controller.getRecipesByCategory("italian", Map.of("sort", "name"),
                        Pageable.unpaged()));
    }

    @Test
    void pagingParamsAreStrippedFromSearchCriteria() {
        Map<String, String> params = new HashMap<>();
        params.put("name", "pasta");
        params.put("page", "1");
        params.put("size", "10");
        stubRecipesPage();

        controller.findRecipesBy(params, PageRequest.of(1, 10));

        ArgumentCaptor<Map<String, String>> criteria = ArgumentCaptor.forClass(Map.class);
        verify(recipeService).findRecipesBy(criteria.capture(), eq(PageRequest.of(1, 10)));
        assertEquals(Map.of("name", "pasta"), criteria.getValue());
    }

    @Test
    void noPagingParamsYieldsUnpaged() {
        stubRecipesPage();

        controller.findRecipesBy(Map.of("name", "pasta"), PageRequest.of(0, 20));

        verify(recipeService).findRecipesBy(eq(Map.of("name", "pasta")), eq(Pageable.unpaged()));
    }

    @Test
    void pagingParamsYieldRequestedPageable() {
        stubRecipesPage();

        controller.findRecipesBy(Map.of("page", "2", "size", "10"), PageRequest.of(2, 10));

        verify(recipeService).findRecipesBy(eq(Map.of()), eq(PageRequest.of(2, 10)));
    }

    @Test
    void getRecipeByIdReturnsOkWithRecipe() {
        Recipe recipe = recipe("Pasta");
        when(recipeService.getRecipeById(recipe.id())).thenReturn(recipe);

        ResponseEntity<?> response = controller.getRecipeById(recipe.id());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(recipe, response.getBody());
    }

    @Test
    void addRecipeReturnsCreatedWithLocation() {
        UUID id = UUID.randomUUID();
        when(recipeService.addRecipe(any(CreateRecipeRequestDto.class))).thenReturn(id);

        ResponseEntity<?> response = controller.addRecipe(createRequest("Pasta"), new MockHttpServletRequest());

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals("/v1/recipes/" + id, response.getHeaders().getLocation().toString());
    }

    @Test
    void addRecipeLocationIncludesContextPath() {
        UUID id = UUID.randomUUID();
        when(recipeService.addRecipe(any(CreateRecipeRequestDto.class))).thenReturn(id);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setContextPath("/recipes");

        ResponseEntity<?> response = controller.addRecipe(createRequest("Pasta"), request);

        assertEquals("/recipes/v1/recipes/" + id, response.getHeaders().getLocation().toString());
    }

    @Test
    void categoryEndpointIgnoresNonPagingParams() {
        stubRecipesPage();

        controller.getRecipesByCategory("italian", Map.of("foo", "bar"), PageRequest.of(0, 10));

        verify(recipeService).getRecipesByCategory(eq("italian"), eq(Pageable.unpaged()));
    }

    @Test
    void getAllCategoriesReturnsOkWithCategories() {
        when(recipeService.getAllCategories()).thenReturn(List.of("italian"));

        ResponseEntity<?> response = controller.getAllCategories();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(List.of("italian"), response.getBody());
    }

    private void stubRecipesPage() {
        Page<RecipeSummaryDto> page = new PageImpl<>(List.of(), Pageable.unpaged(), 0);
        when(recipeService.findRecipesBy(anyMap(), any(Pageable.class))).thenReturn(page);
        when(recipeService.getRecipesByCategory(any(), any(Pageable.class))).thenReturn(page);
    }
}
