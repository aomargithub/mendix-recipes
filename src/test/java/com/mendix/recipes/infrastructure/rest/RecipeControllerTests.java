package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.application.RecipeQueryPort;
import com.mendix.recipes.domain.Ingredient;
import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.RecipesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RecipeControllerTests {

    private static final int RECIPE_COUNT = 25;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecipesRepository recipesRepository;

    @Autowired
    private RecipeQueryPort recipeQueryPort;

    @BeforeEach
    void seedRecipes() {
        if (recipeQueryPort.findRecipesBy(Map.of(), PageRequest.of(0, 1)).getTotalElements() == 0) {
            for (int i = 0; i < RECIPE_COUNT; i++) {
                recipesRepository.addRecipe(recipe("Recipe %02d".formatted(i)));
            }
        }
    }

    @Test
    void getRecipesWithoutPagingParamsReturnsAllRecipes() throws Exception {
        mockMvc.perform(get("/v1/recipes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(RECIPE_COUNT))
                .andExpect(jsonPath("$.page.totalElements").value(RECIPE_COUNT))
                .andExpect(jsonPath("$.page.totalPages").value(1));
    }

    @Test
    void getRecipesWithPagingParamsReturnsRequestedSlice() throws Exception {
        mockMvc.perform(get("/v1/recipes")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].name").value("Recipe 10"))
                .andExpect(jsonPath("$.content[9].name").value("Recipe 19"))
                .andExpect(jsonPath("$.page.number").value(1))
                .andExpect(jsonPath("$.page.size").value(10))
                .andExpect(jsonPath("$.page.totalElements").value(RECIPE_COUNT))
                .andExpect(jsonPath("$.page.totalPages").value(3));
    }

    @Test
    void searchWithoutPagingParamsReturnsAllMatches() throws Exception {
        mockMvc.perform(get("/v1/recipes").param("name", "Recipe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(RECIPE_COUNT))
                .andExpect(jsonPath("$.page.totalElements").value(RECIPE_COUNT));
    }

    @Test
    void searchWithPagingParamsReturnsRequestedSliceOfMatches() throws Exception {
        mockMvc.perform(get("/v1/recipes")
                        .param("name", "Recipe")
                        .param("page", "2")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].name").value("Recipe 20"))
                .andExpect(jsonPath("$.page.totalElements").value(RECIPE_COUNT));
    }

    @Test
    void getRecipesByCategoryWithoutPagingParamsReturnsAllInCategory() throws Exception {
        mockMvc.perform(get("/v1/categories/italian/recipes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(RECIPE_COUNT))
                .andExpect(jsonPath("$.page.totalElements").value(RECIPE_COUNT));
    }

    @Test
    void sortWithoutPagingParamsDoesNotTruncateResults() throws Exception {
        mockMvc.perform(get("/v1/recipes").param("sort", "name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(RECIPE_COUNT));
    }

    @Test
    void searchWithoutMatchReturnsEmptyPage() throws Exception {
        mockMvc.perform(get("/v1/recipes").param("name", "no such recipe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(0));
    }

    private Recipe recipe(String name) {
        return Recipe.of(
                name,
                "A tasty dish with a description long enough to matter",
                List.of("Step one", "Step two"),
                Set.of(new Ingredient("spaghetti", 200, MeasurementUnit.GRAM)),
                "Chef",
                new Date(),
                "website",
                Duration.ofMinutes(5),
                Set.of("italian"));
    }
}
