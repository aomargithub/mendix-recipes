package com.mendix.recipes.infrastructure.memstore;

import com.mendix.recipes.application.RecipeQueryPort;
import com.mendix.recipes.application.dto.RecipeSummaryDto;
import com.mendix.recipes.domain.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.function.BiPredicate;


@Repository
public class MemoryRecipesRepository implements RecipesRepository, RecipeQueryPort {
    private final Map<String, List<Recipe>> categories =
            new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    private final List<Recipe> recipes = new ArrayList<>();
    private final Map<String, Recipe> recipeByName = new HashMap<>(); //performant checking for duplication

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
        return new ArrayList<>(categories.keySet());
    }

    @Override
    public Page<RecipeSummaryDto> getRecipesByCategory(String category, Pageable pageable) {
        return getPage(categories.get(category), pageable);
    }

    @Override
    public Page<RecipeSummaryDto> findRecipesBy(Map<String, String> criteria, Pageable pageable) {
        return getPage(filter(recipes, criteria), pageable);
    }

    @Override
    public synchronized boolean addRecipe(Recipe recipe) {
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
    }

    @Override
    public Recipe getRecipeByName(String name) {
        return recipeByName.get(name);
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
        if (recipes ==  null || recipes.isEmpty()) {
            return Page.empty();
        }
        if (pageable == null) {
            return  new PageImpl<>(toDto(recipes));
        }
        int fromIndex = pageable.getPageNumber() * pageable.getPageSize();
        int toIndex = Math.min(fromIndex + pageable.getPageSize(), recipes.size());

        if (fromIndex >= recipes.size()) {
            return Page.empty();
        }

        return new PageImpl<>(toDto(recipes.subList(fromIndex, toIndex)), pageable, recipes.size());
    }

    private List<RecipeSummaryDto> toDto(List<Recipe> recipes) {
        return recipes.stream().map(RecipeSummaryDto::from).toList();
    }
}
