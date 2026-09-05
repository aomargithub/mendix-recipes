package com.mendix.recipes.infrastructure.memstore;

import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.RecipesRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.IntFunction;

import static com.mendix.recipes.TestRecipes.AUTHOR;
import static com.mendix.recipes.TestRecipes.recipe;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MemoryRecipesRepositoryTests {

    @Test
    void concurrentDuplicateAddsAllowExactlyOneWinner() throws Exception {
        RecipesRepository repository = new MemoryRecipesRepository();
        Recipe recipe = recipe("Pasta");

        long winners = runConcurrently(16, i -> () -> repository.addRecipe(recipe));

        assertEquals(1, winners);
    }

    @Test
    void concurrentDuplicateAddsAreCaseInsensitive() throws Exception {
        RecipesRepository repository = new MemoryRecipesRepository();

        long winners = runConcurrently(16, i -> () -> repository.addRecipe(
                recipe(i % 2 == 0 ? "Pasta" : "pasta")));

        assertEquals(1, winners);
    }

    @Test
    void concurrentDistinctAddsAllSucceed() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        List<Recipe> recipes = new ArrayList<>();
        for (int i = 0; i < 32; i++) {
            recipes.add(recipe("Recipe " + i));
        }

        long winners = runConcurrently(32, i -> () -> repository.addRecipe(recipes.get(i)));

        assertEquals(32, winners);
        for (Recipe added : recipes) {
            assertNotNull(repository.getRecipeById(added.id()));
        }
    }

    @Test
    @Timeout(60)
    void readsDuringWritesNeverThrow() throws Exception {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        UUID fifthRecipeId = null;
        for (int i = 0; i < 50; i++) {
            Recipe seeded = recipe("Recipe " + i);
            repository.addRecipe(seeded);
            if (i == 5) {
                fifthRecipeId = seeded.id();
            }
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
            repository.getRecipeById(fifthRecipeId);
            repository.getRecipesByCategory("italian", Pageable.unpaged());
        }
        writer.join();

        assertEquals(10_000, repository.findRecipesBy(Map.of(), PageRequest.of(0, 1)).getTotalElements());
    }

    @Test
    void caseInsensitiveDuplicateAddReturnsFalse() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta"));

        assertFalse(repository.addRecipe(recipe("PASTA")));
        assertEquals(1, repository.findRecipesBy(Map.of(), Pageable.unpaged()).getTotalElements());
    }

    @Test
    void unknownCategoryReturnsNull() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta"));

        assertNull(repository.getRecipesByCategory("mexican", Pageable.unpaged()));
        assertEquals(1, repository.getRecipesByCategory("ITALIAN", Pageable.unpaged()).getTotalElements());
    }

    @Test
    void unknownRecipeIdReturnsNull() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();

        assertNull(repository.getRecipeById(UUID.randomUUID()));
    }

    @Test
    void filtersByNameCaseInsensitively() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta Carbonara"));
        repository.addRecipe(recipe("Pizza"));

        assertEquals(1, repository.findRecipesBy(Map.of("name", "carbonara"), Pageable.unpaged())
                .getTotalElements());
        assertEquals(1, repository.findRecipesBy(Map.of("name", "PIZZA"), Pageable.unpaged())
                .getTotalElements());
    }

    @Test
    void filtersByAuthorAndCategory() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta", AUTHOR, Set.of("italian"), new Date()));
        repository.addRecipe(recipe("Tacos", "Baker", Set.of("mexican"), new Date()));

        assertEquals(1, repository.findRecipesBy(Map.of("author", "baker"), Pageable.unpaged())
                .getTotalElements());
        assertEquals(1, repository.findRecipesBy(Map.of("category", "mex"), Pageable.unpaged())
                .getTotalElements());
    }

    @Test
    void multipleCriteriaAreAnded() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta", AUTHOR, Set.of("italian"), new Date()));
        repository.addRecipe(recipe("Tacos", "Baker", Set.of("mexican"), new Date()));

        assertEquals(1, repository.findRecipesBy(
                Map.of("author", "baker", "category", "mexican"), Pageable.unpaged())
                .getTotalElements());
        assertEquals(0, repository.findRecipesBy(
                Map.of("author", "chef", "category", "mexican"), Pageable.unpaged())
                .getTotalElements());
    }

    @Test
    void partialLastPageIsReturned() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        for (int i = 0; i < 25; i++) {
            repository.addRecipe(recipe("Recipe " + i));
        }

        Page<RecipeSummaryDto> page = repository.findRecipesBy(Map.of(), PageRequest.of(2, 10));

        assertEquals(5, page.getContent().size());
        assertEquals(25, page.getTotalElements());
        assertEquals(3, page.getTotalPages());
    }

    @Test
    void pageBeyondEndIsEmpty() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        for (int i = 0; i < 25; i++) {
            repository.addRecipe(recipe("Recipe " + i));
        }

        Page<RecipeSummaryDto> page = repository.findRecipesBy(Map.of(), PageRequest.of(5, 10));

        assertTrue(page.getContent().isEmpty());
        assertEquals(25, page.getTotalElements());
    }

    @Test
    void recipesAreSortedByPostedAtThenName() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        long now = System.currentTimeMillis();
        repository.addRecipe(recipe("Latest", AUTHOR, Set.of("italian"), new Date(now + 5_000)));
        repository.addRecipe(recipe("Oldest", AUTHOR, Set.of("italian"), new Date(now - 5_000)));
        repository.addRecipe(recipe("Middle", AUTHOR, Set.of("italian"), new Date(now)));

        Page<RecipeSummaryDto> page = repository.findRecipesBy(Map.of(), Pageable.unpaged());

        assertEquals(List.of("Oldest", "Middle", "Latest"),
                page.getContent().stream().map(RecipeSummaryDto::name).toList());
    }

    @Test
    void categoriesAreListedCaseInsensitivelySorted() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Tacos", AUTHOR, Set.of("mexican"), new Date()));
        repository.addRecipe(recipe("Pasta", AUTHOR, Set.of("Italian"), new Date()));
        repository.addRecipe(recipe("Couscous", AUTHOR, Set.of("african"), new Date()));

        assertEquals(List.of("african", "italian", "mexican"), repository.getAllCategories());
    }

    @Test
    void getAllCategoriesReturnsDefensiveCopy() {
        MemoryRecipesRepository repository = new MemoryRecipesRepository();
        repository.addRecipe(recipe("Pasta"));

        repository.getAllCategories().add("hacker");

        assertEquals(List.of("italian"), repository.getAllCategories());
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
}
