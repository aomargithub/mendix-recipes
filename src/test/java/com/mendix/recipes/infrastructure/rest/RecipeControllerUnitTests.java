package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.application.RecipeService;
import com.mendix.recipes.application.dto.CreateRecipeRequestDto;
import com.mendix.recipes.application.dto.GetRecipeResponseDto;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.SortNotSupportedException;
import com.mendix.recipes.domain.UnknownParameterException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.mendix.recipes.TestRecipes.createRequest;
import static com.mendix.recipes.TestRecipes.recipe;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
                () -> controller.findRecipes(null, Map.of("sort", "name"), Pageable.unpaged()));
    }

    @Test
    void sortParamIsRejectedCaseInsensitive() {
        assertThrows(SortNotSupportedException.class,
                () -> controller.findRecipes(null, Map.of("SORT", "name"), Pageable.unpaged()));
    }

    @Test
    void sortParamIsRejectedOnCategoryEndpoint() {
        assertThrows(SortNotSupportedException.class,
                () -> controller.getRecipesByCategory("italian", Map.of("sort", "name"),
                        Pageable.unpaged()));
    }

    @Test
    void searchKeyIsForwardedToService() {
        stubRecipesPage();

        controller.findRecipes("pasta", Map.of("q", "pasta"), Pageable.unpaged());

        verify(recipeService).search(eq("pasta"), eq(Pageable.unpaged()));
    }

    @Test
    void unknownParamsAreRejected() {
        UnknownParameterException ex = assertThrows(UnknownParameterException.class,
                () -> controller.findRecipes(null, Map.of("foo", "bar"), Pageable.unpaged()));

        assertTrue(ex.getMessage().contains("foo"));
        verify(recipeService, never()).search(any(), any(Pageable.class));
    }

    @Test
    void legacyFilterParamsAreRejected() {
        assertThrows(UnknownParameterException.class,
                () -> controller.findRecipes(null, Map.of("name", "pasta"), Pageable.unpaged()));
        assertThrows(UnknownParameterException.class,
                () -> controller.findRecipes(null, Map.of("category", "mexican"), Pageable.unpaged()));
        assertThrows(UnknownParameterException.class,
                () -> controller.findRecipes(null, Map.of("author", "chef"), Pageable.unpaged()));
    }

    @Test
    void noPagingParamsYieldsUnpaged() {
        stubRecipesPage();

        controller.findRecipes("pasta", Map.of("q", "pasta"), PageRequest.of(0, 20));

        verify(recipeService).search(eq("pasta"), eq(Pageable.unpaged()));
    }

    @Test
    void pagingParamsYieldRequestedPageable() {
        stubRecipesPage();

        controller.findRecipes(null, Map.of("page", "2", "size", "10"), PageRequest.of(2, 10));

        verify(recipeService).search(isNull(), eq(PageRequest.of(2, 10)));
    }

    @Test
    void searchKeyAndPagingParamsAreAcceptedTogether() {
        stubRecipesPage();

        controller.findRecipes("pasta", Map.of("q", "pasta", "page", "1", "size", "10"),
                PageRequest.of(1, 10));

        verify(recipeService).search(eq("pasta"), eq(PageRequest.of(1, 10)));
    }

    @Test
    void getRecipeByIdReturnsOkWithRecipe() {
        GetRecipeResponseDto dto = GetRecipeResponseDto.from(recipe("Pasta"));
        when(recipeService.getRecipeById(dto.id())).thenReturn(dto);

        ResponseEntity<?> response = controller.getRecipeById(dto.id());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(dto, response.getBody());
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
        when(recipeService.search(any(), any(Pageable.class))).thenReturn(page);
        when(recipeService.getRecipesByCategory(any(), any(Pageable.class))).thenReturn(page);
    }
}
