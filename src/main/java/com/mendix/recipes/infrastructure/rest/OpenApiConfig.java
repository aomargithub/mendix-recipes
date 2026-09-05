package com.mendix.recipes.infrastructure.rest;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI recipesOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Recipes API")
                        .version("v1")
                        .description("REST back-end for the recipe website. Serves recipe listings, categories and recipe creation."));
    }
}
