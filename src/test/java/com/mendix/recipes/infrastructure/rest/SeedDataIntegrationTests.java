package com.mendix.recipes.infrastructure.rest;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SeedDataIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void seededRecipesAreServedByTheApi() throws Exception {
        mockMvc.perform(get("/v1/recipes").param("name", "30 Minute Chili"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].name").value("30 Minute Chili"));
    }

    @Test
    void seededCategoriesAreServedByTheApi() throws Exception {
        mockMvc.perform(get("/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasItem("main dish")))
                .andExpect(jsonPath("$", hasItem("chili")));
    }
}
