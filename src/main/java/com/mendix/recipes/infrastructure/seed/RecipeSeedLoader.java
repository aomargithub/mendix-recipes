package com.mendix.recipes.infrastructure.seed;

import com.mendix.recipes.application.RecipeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;
import tools.jackson.dataformat.xml.XmlMapper;

import java.io.IOException;
import java.io.InputStream;

@Component
public class RecipeSeedLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RecipeSeedLoader.class);
    private static final String SEED_LOCATION = "classpath*:init/*.xml";

    private final RecipeService recipeService;
    private final XmlMapper xmlMapper = XmlMapper.builder().build();

    public RecipeSeedLoader(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        Resource[] resources = new PathMatchingResourcePatternResolver().getResources(SEED_LOCATION);
        if (resources.length == 0) {
            log.info("No recipe seed files found at {}", SEED_LOCATION);
            return;
        }
        int loaded = 0;
        for (Resource resource : resources) {
            loaded += load(resource);
        }
        log.info("Seeded {} recipes from {} files", loaded, resources.length);
    }

    private int load(Resource resource) throws IOException {
        try (InputStream in = resource.getInputStream()) {
            RecipeMlXml seed = xmlMapper.readValue(in, RecipeMlXml.class);
            recipeService.addRecipe(seed.toDto());
            return 1;
        } catch (IOException | RuntimeException e) {
            throw new IllegalStateException("Failed to load seed file: " + resource.getFilename(), e);
        }
    }
}
