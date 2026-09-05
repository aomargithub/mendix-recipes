package com.mendix.recipes.domain;

public class SortNotSupportedException extends RuntimeException {
    public SortNotSupportedException() {
        super("Sorting is not supported: the 'sort' parameter is not accepted");
    }
}
