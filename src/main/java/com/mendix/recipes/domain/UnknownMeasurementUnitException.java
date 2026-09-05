package com.mendix.recipes.domain;

import java.util.Arrays;
import java.util.Set;

public class UnknownMeasurementUnitException extends RuntimeException {
    public UnknownMeasurementUnitException(String unknown, MeasurementUnit[] supported) {
        super("Unknown Unit: " + unknown + ", currently supported units: " + Arrays.toString(supported));
    }
}
