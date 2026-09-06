package com.mendix.recipes.infrastructure.memstore;

import com.mendix.recipes.application.RecipeQueryPort;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.Recipe;
import com.mendix.recipes.domain.RecipesRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;


@Repository
public class MemoryRecipesRepository implements RecipesRepository, RecipeQueryPort {
    private final Map<String, List<Recipe>> categories =
            new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    private final List<Recipe> recipes = new ArrayList<>();
    private final Map<UUID, Recipe> recipeById = new HashMap<>();
    private final Set<String> recipeNames = new HashSet<>();
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

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
    public Page<RecipeSummaryDto> search(String searchKey, Pageable pageable) {
        lock.readLock().lock();
        try {
            return getPage(filter(recipes, searchKey), pageable);
        } finally {
            lock.readLock().unlock();
        }
    }

    @Override
    public boolean addRecipe(Recipe recipe) {
        lock.writeLock().lock();
        try {
            if (recipeNames.contains(recipe.name().toLowerCase())) {
                return false;
            }
            recipeById.put(recipe.id(), recipe);
            recipeNames.add(recipe.name().toLowerCase());
            insertRecipeInto(recipe, recipes);

            recipe.categories()
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
    public Recipe getRecipeById(UUID id) {
        lock.readLock().lock();
        try {
            return recipeById.get(id);
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

    private List<Recipe> filter(List<Recipe> recipes, String searchKey) {
        if (searchKey == null || searchKey.isBlank()) {
            return recipes;
        }
        String key = searchKey.toLowerCase();
        return recipes.stream()
                .filter(recipe -> recipe.name().toLowerCase().contains(key)
                        || recipe.author().toLowerCase().contains(key)
                        || recipe.categories().stream().anyMatch(category -> category.contains(key)))
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
