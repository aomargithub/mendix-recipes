package com.mendix.recipes.domain;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException (String type, Object name) {
        super(type + " with id " + name + " couldn't be found");
    }
}
