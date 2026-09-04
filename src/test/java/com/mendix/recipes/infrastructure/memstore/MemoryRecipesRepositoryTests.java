package com.mendix.recipes.infrastructure.memstore;

import com.mendix.recipes.domain.Ingredient;
import com.mendix.recipes.domain.MeasurementUnit;
import com.mendix.recipes.domain.Recipe;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.data.domain.PageRequest;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.IntFunction;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class MemoryRecipesRepositoryTests {

    @Test
    void concurrentDuplicateAddsAllowExactlyOneWinner() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        Recipe recipe = recipe("Pasta");

        long winners = runConcurrently(16, i -> () -> repository.addRecipe(recipe));

        assertEquals(1, winners);
    }

    @Test
    void concurrentDuplicateAddsAreCaseInsensitive() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();

        long winners = runConcurrently(16, i -> () -> repository.addRecipe(
                recipe(i % 2 == 0 ? "Pasta" : "pasta")));

        assertEquals(1, winners);
    }

    @Test
    void concurrentDistinctAddsAllSucceed() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();

        long winners = runConcurrently(32, i -> () -> repository.addRecipe(recipe("Recipe " + i)));

        assertEquals(32, winners);
        for (int i = 0; i < 32; i++) {
            assertNotNull(repository.getRecipeByName("recipe " + i));
        }
    }

    @Test
    @Timeout(60)
    void readsDuringWritesNeverThrow() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        for (int i = 0; i < 50; i++) {
            repository.addRecipe(recipe("Recipe " + i));
        }

        Thread writer = new Thread(() -> {
            for (int i = 50; i < 10_000; i++) {
                repository.addRecipe(recipe("Recipe " + i));
            }
        });
        writer.start();
        while (writer.isAlive()) {
            repository.getRecipesByCategory("italian", PageRequest.of(0, 10));
            repository.findRecipesBy(Map.of("name", "Recipe"), PageRequest.of(0, 10));
            repository.getAllCategories();
            repository.getRecipeByName("Recipe 5");
            repository.doesCategoryExist("italian");
        }
        writer.join();

        assertEquals(10_000, repository.findRecipesBy(Map.of(), PageRequest.of(0, 1)).getTotalElements());
    }

    private long runConcurrently(int threads, IntFunction<Callable<Boolean>> taskFactory) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                results.add(executor.submit(taskFactory.apply(i)));
            }
            long winners = 0;
            for (Future<Boolean> result : results) {
                if (result.get()) {
                    winners++;
                }
            }
            return winners;
        } finally {
            executor.shutdownNow();
        }
    }

    private Recipe recipe(String name) {
        return new Recipe(
                name,
                "A tasty dish with a description long enough to matter",
                List.of("Step one", "Step two"),
                Set.of(new Ingredient("spaghetti", 200, MeasurementUnit.GRAM)),
                "Chef",
                new Date(),
                "website",
                Set.of("italian"));
    }
}
