package com.mendix.recipes.domain;

public class RecipeNameAlreadyExistsException extends RuntimeException {
    public RecipeNameAlreadyExistsException(String name) {
        super("A recipe with name " + name + " already exists");
    }
}
