package com.mendix.recipes.infrastructure.memstore;

import com.mendix.recipes.application.RecipeQueryPort;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.BiPredicate;


@Repository
public class MemoryRecipesRepository implements RecipesRepository, RecipeQueryPort {
    private final Map<String, List<Recipe>> categories =
            new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    private final List<Recipe> recipes = new ArrayList<>();
    private final Map<String, Recipe> recipeByName = new HashMap<>();
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    private final Map<String, BiPredicate<Recipe, String>> filters = Map.of(
            "name", (recipe, value) ->
                    recipe.name().toLowerCase().contains(value.toLowerCase()),

            "category", (recipe, value) ->
                    recipe.categories().stream().map(String::toLowerCase)
                            .anyMatch(categoryName -> categoryName.toLowerCase().contains(value.toLowerCase())),

            "author", (recipe, value) ->
                    recipe.author().toLowerCase().contains(value.toLowerCase()));

    public MemoryRecipesRepository() {
        List<String> unimplemented = RecipeQueryPort.SUPPORTED_FILTERS.stream()
                .filter(key -> !filters.containsKey(key))
                .toList();
        if (!unimplemented.isEmpty()) {
            throw new IllegalStateException(
                    "MemoryRecipesRepository does not implement filters: " + unimplemented);
        }
    }

    @Override
    public List<String> getAllCategories() {
        lock.readLock().lock();
        try {
            return new ArrayList<>(categories.keySet());
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable) {
        lock.readLock().lock();
        try {
            List<Recipe> categoryRecipes = categories.get(category);
            return categoryRecipes == null ? null : getPage(categoryRecipes, pageable);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public Page<RecipeSummaryDto> findRecipesBy(Map<String, String> criteria, Pageable pageable) {
        lock.readLock().lock();
        try {
            return getPage(filter(recipes, criteria), pageable);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public boolean addRecipe(Recipe recipe) {
        lock.writeLock().lock();
        try {
            if (recipeByName.containsKey(recipe.name().toLowerCase())) {
                return false;
            }

            recipeByName.put(recipe.name().toLowerCase(), recipe);
            insertRecipeInto(recipe, recipes);

            recipe.categories()
                    .stream().map(String::toLowerCase)
                    .forEach(
                    category -> {
                        List<Recipe> categoryRecipes = categories.computeIfAbsent(category, k -> new ArrayList<>());
                        insertRecipeInto(recipe, categoryRecipes);
                    }
            );
            return true;
        } finally {
            lock.writeLock().unlock();
        }
    }

    @Override
    public Recipe getRecipeByName(String name) {
        lock.readLock().lock();
        try {
            return recipeByName.get(name.toLowerCase());
        } finally {
            lock.readLock().unlock();
        }
    }

    private void insertRecipeInto(Recipe recipe, List<Recipe> recipes) {
        Comparator<Recipe> comparator =
                Comparator.comparing(Recipe::postedAt)
                        .thenComparing(Recipe::name);

        int index = Collections.binarySearch(recipes, recipe, comparator);

        if (index < 0) {
            index = -index - 1;
        }
        recipes.add(index, recipe);
    }

    private List<Recipe> filter(
            List<Recipe> recipes,
            Map<String, String> criteria
    ) {
        return criteria.isEmpty()? recipes: recipes.stream()
                .filter(recipe ->
                        criteria.entrySet().stream()
                                .allMatch(entry -> {
                                    BiPredicate<Recipe, String> predicate =
                                            filters.get(entry.getKey());
                                    return predicate.test(recipe, entry.getValue());
                                })
                )
                .toList();
    }

    private Page<RecipeSummaryDto> getPage(List<Recipe> recipes, Pageable pageable) {
        if (recipes == null || recipes.isEmpty()) {
            return Page.empty();
        }
        if (pageable == null) {
            pageable = Pageable.unpaged();
        }
        if (pageable.isUnpaged()) {
            return new PageImpl<>(toDto(recipes), pageable, recipes.size());
        }
        int fromIndex = pageable.getPageNumber() * pageable.getPageSize();
        int toIndex = Math.min(fromIndex + pageable.getPageSize(), recipes.size());

        if (fromIndex >= recipes.size()) {
            return new PageImpl<>(List.of(), pageable, recipes.size());
        }

        return new PageImpl<>(toDto(recipes.subList(fromIndex, toIndex)), pageable, recipes.size());
    }

    private List<RecipeSummaryDto> toDto(List<Recipe> recipes) {
        return recipes.stream().map(RecipeSummaryDto::from).toList();
    }
}
