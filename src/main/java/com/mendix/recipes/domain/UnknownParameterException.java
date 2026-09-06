package com.mendix.recipes.domain;

import java.util.Set;

public class UnknownParameterException extends RuntimeException {
    public UnknownParameterException(Set<String> unknown, Set<String> supported) {
        super("Unknown parameters: " + unknown + ", supported parameters: " + supported);
    }
}
