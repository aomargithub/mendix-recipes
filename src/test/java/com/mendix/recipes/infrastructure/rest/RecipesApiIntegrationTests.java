package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.domain.RecipesRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;

import static com.mendix.recipes.TestRecipes.recipe;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class RecipesApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RecipesRepository recipesRepository;

    @Test
    void createdRecipeIsAccessibleViaLocationHeader() throws Exception {
        MvcResult result = mockMvc.perform(post("/v1/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Location Carbonara",
                                  "description": "A tasty integration dish",
                                  "steps": ["Boil the pasta", "Serve"],
                                  "ingredients": [{"name": "spaghetti", "quantity": 200, "unit": "GRAM"}],
                                  "author": "Chef",
                                  "postedAt": 1757000000000,
                                  "postedTo": "website",
                                  "preparationTimeInMinutes": 15,
                                  "categories": ["italian"]
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/v1/recipes/")))
                .andReturn();

        String location = result.getResponse().getHeader("Location");

        mockMvc.perform(get(location))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Location Carbonara"))
                .andExpect(jsonPath("$.steps.length()").value(2))
                .andExpect(jsonPath("$.ingredients[0].name").value("spaghetti"))
                .andExpect(jsonPath("$.categories[0]").value("italian"));
    }

    @Test
    void duplicateRecipeNameIsRejected() throws Exception {
        String body = """
                {
                  "name": "Twin Recipe",
                  "description": "First of two",
                  "steps": ["Single step"],
                  "ingredients": [{"name": "flour", "quantity": 500, "unit": "GRAM"}],
                  "author": "Chef",
                  "postedAt": 1757000000000,
                  "postedTo": "website",
                  "preparationTimeInMinutes": 10,
                  "categories": ["italian"]
                }
                """;
        mockMvc.perform(post("/v1/recipes").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        String sameNameDifferentCase = body.replace("Twin Recipe", "twin recipe");
        mockMvc.perform(post("/v1/recipes").contentType(MediaType.APPLICATION_JSON)
                        .content(sameNameDifferentCase))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Recipe already exists"))
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    void unknownMeasurementUnitIsRejected() throws Exception {
        mockMvc.perform(post("/v1/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Gallon Soup",
                                  "description": "Too much soup",
                                  "steps": ["Boil"],
                                  "ingredients": [{"name": "water", "quantity": 1, "unit": "GALLON"}],
                                  "author": "Chef",
                                  "postedAt": 1757000000000,
                                  "postedTo": "website",
                                  "preparationTimeInMinutes": 10,
                                  "categories": ["italian"]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unknown measurement unit"));
    }

    @Test
    void blankRecipeNameIsRejected() throws Exception {
        mockMvc.perform(post("/v1/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "   ",
                                  "description": "Nameless dish",
                                  "steps": ["Single step"],
                                  "ingredients": [{"name": "flour", "quantity": 500, "unit": "GRAM"}],
                                  "author": "Chef",
                                  "postedAt": 1757000000000,
                                  "postedTo": "website",
                                  "preparationTimeInMinutes": 10,
                                  "categories": ["italian"]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid input"))
                .andExpect(jsonPath("$.detail").value("Recipe name must not be blank"));
    }

    @Test
    void malformedJsonIsRejected() throws Exception {
        mockMvc.perform(post("/v1/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Broken"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Malformed request body"));
    }

    @Test
    void unknownRecipeIdReturnsNotFound() throws Exception {
        mockMvc.perform(get("/v1/recipes/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"))
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void invalidUuidInPathReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/v1/recipes/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid request parameter"));
    }

    @Test
    void invalidQueryParamsAreRejected() throws Exception {
        mockMvc.perform(get("/v1/recipes").param("sort", "name"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Sorting not supported"));

        mockMvc.perform(get("/v1/recipes").param("foo", "bar"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Unknown filter"));
    }

    @Test
    void pagingSlicesAreReturnedEndToEnd() throws Exception {
        for (int i = 0; i < 15; i++) {
            assertTrue(recipesRepository.addRecipe(recipe("Paging Alpha %02d".formatted(i))));
        }

        mockMvc.perform(get("/v1/recipes")
                        .param("name", "Paging Alpha")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(10))
                .andExpect(jsonPath("$.content[0].name").value("Paging Alpha 00"))
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(15))
                .andExpect(jsonPath("$.page.totalPages").value(2));

        mockMvc.perform(get("/v1/recipes")
                        .param("name", "Paging Alpha")
                        .param("page", "1")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].name").value("Paging Alpha 10"))
                .andExpect(jsonPath("$.page.totalElements").value(15));
    }

    @Test
    void newCategoryIsExposedAndUnknownCategoryIsRejected() throws Exception {
        mockMvc.perform(post("/v1/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Side Dish Special",
                                  "description": "A side dish",
                                  "steps": ["Prepare"],
                                  "ingredients": [{"name": "rice", "quantity": 2, "unit": "CUP"}],
                                  "author": "Chef",
                                  "postedAt": 1757000000000,
                                  "postedTo": "website",
                                  "preparationTimeInMinutes": 20,
                                  "categories": ["sidedish"]
                                }
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItem("sidedish")));

        mockMvc.perform(get("/v1/categories/doesnotexist/recipes"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Resource not found"));
    }
}
