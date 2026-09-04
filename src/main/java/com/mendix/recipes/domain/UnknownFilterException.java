package com.mendix.recipes.domain;

import java.util.Set;

public class UnknownFilterException  extends RuntimeException {
    public UnknownFilterException(Set<String> unknown, Set<String> supported) {
        super("Unknown filters: " + unknown + ", currently supported filters: " + supported);
    }
}
