package com.mendix.recipes.domain;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException (String type, String name) {
        super(type + " with name " + name + " couldn't be found");
    }
}
