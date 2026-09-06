package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.domain.RecipeNameAlreadyExistsException;
import com.mendix.recipes.domain.ResourceNotFoundException;
import com.mendix.recipes.domain.SortNotSupportedException;
import com.mendix.recipes.domain.UnknownMeasurementUnitException;
import com.mendix.recipes.domain.UnknownParameterException;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ApiExceptionHandlerTests {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void resourceNotFoundMapsTo404() {
        ProblemDetail problem = handler.handleResourceNotFound(
                new ResourceNotFoundException("Recipe", UUID.randomUUID()));

        assertEquals(HttpStatus.NOT_FOUND.value(), problem.getStatus());
        assertEquals("Resource not found", problem.getTitle());
    }

    @Test
    void noResourceFoundMapsTo404() {
        ProblemDetail problem = handler.handleNoResourceFound(
                new NoResourceFoundException(HttpMethod.GET, "/unknown", "Path not found"));

        assertEquals(HttpStatus.NOT_FOUND.value(), problem.getStatus());
        assertEquals("Not found", problem.getTitle());
        assertEquals("The requested path does not exist", problem.getDetail());
    }

    @Test
    void methodNotSupportedMapsTo405() {
        ProblemDetail problem = handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("DELETE", Set.of("GET")));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED.value(), problem.getStatus());
        assertEquals("Method not allowed", problem.getTitle());
        assertEquals("Request method 'DELETE' is not supported. Supported methods: [GET]",
                problem.getDetail());
    }

    @Test
    void methodNotSupportedWithoutKnownMethodsMapsTo405() {
        ProblemDetail problem = handler.handleMethodNotSupported(
                new HttpRequestMethodNotSupportedException("PATCH"));

        assertEquals(HttpStatus.METHOD_NOT_ALLOWED.value(), problem.getStatus());
        assertEquals("Method not allowed", problem.getTitle());
        assertEquals("Request method 'PATCH' is not supported", problem.getDetail());
    }

    @Test
    void mediaTypeNotSupportedMapsTo415() {
        ProblemDetail problem = handler.handleMediaTypeNotSupported(
                new HttpMediaTypeNotSupportedException(
                        MediaType.TEXT_PLAIN, List.of(MediaType.APPLICATION_JSON)));

        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(), problem.getStatus());
        assertEquals("Unsupported media type", problem.getTitle());
        assertEquals("Content-Type 'text/plain' is not supported", problem.getDetail());
    }

    @Test
    void mediaTypeNotAcceptableMapsTo406() {
        ProblemDetail problem = handler.handleMediaTypeNotAcceptable(
                new HttpMediaTypeNotAcceptableException("Could not find acceptable representation"));

        assertEquals(HttpStatus.NOT_ACCEPTABLE.value(), problem.getStatus());
        assertEquals("Not acceptable", problem.getTitle());
        assertEquals("Could not find acceptable representation for the requested Accept header",
                problem.getDetail());
    }

    @Test
    void duplicateRecipeNameMapsTo409() {
        ProblemDetail problem = handler.handleDuplicateName(
                new RecipeNameAlreadyExistsException("Pasta"));

        assertEquals(HttpStatus.CONFLICT.value(), problem.getStatus());
        assertEquals("Recipe already exists", problem.getTitle());
        assertEquals("A recipe with name Pasta already exists", problem.getDetail());
    }

    @Test
    void unknownParameterMapsTo400() {
        ProblemDetail problem = handler.handleUnknownParameter(
                new UnknownParameterException(Set.of("cuisine"), Set.of("q", "page", "size")));

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Unknown parameter", problem.getTitle());
    }

    @Test
    void sortNotSupportedMapsTo400() {
        ProblemDetail problem = handler.handleSortNotSupported(new SortNotSupportedException());

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Sorting not supported", problem.getTitle());
    }

    @Test
    void unknownMeasurementUnitMapsTo400() {
        ProblemDetail problem = handler.handleUnknownMeasurementUnit(
                new UnknownMeasurementUnitException("GALLON", com.mendix.recipes.domain.MeasurementUnit.values()));

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Unknown measurement unit", problem.getTitle());
    }

    @Test
    void malformedBodyWithInvalidInputRootCauseMapsTo400() {
        HttpMessageNotReadableException ex = new HttpMessageNotReadableException(
                "wrapped", new IllegalArgumentException("Recipe name must not be blank"), requestBody());

        ProblemDetail problem = handler.handleMalformedBody(ex);

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Invalid input", problem.getTitle());
        assertEquals("Recipe name must not be blank", problem.getDetail());
    }

    @Test
    void malformedBodyWithOtherRootCauseMapsTo400() {
        ProblemDetail problem = handler.handleMalformedBody(
                new HttpMessageNotReadableException("bad json", requestBody()));

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Malformed request body", problem.getTitle());
        assertEquals("Request body is not valid for the expected format: bad json", problem.getDetail());
    }

    private static HttpInputMessage requestBody() {
        return new MockHttpInputMessage("{}".getBytes());
    }

    @Test
    void typeMismatchMapsTo400() throws Exception {
        MethodParameter parameter = new MethodParameter(
                RecipeController.class.getDeclaredMethod("getRecipeById", UUID.class), 0);
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "not-a-uuid", UUID.class, "id", parameter, null);

        ProblemDetail problem = handler.handleTypeMismatch(ex);

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Invalid request parameter", problem.getTitle());
        assertEquals("Parameter 'id' has an invalid value", problem.getDetail());
    }

    @Test
    void illegalArgumentMapsTo400() {
        ProblemDetail problem = handler.handleInvalidInput(
                new IllegalArgumentException("Recipe name must not be blank"));

        assertEquals(HttpStatus.BAD_REQUEST.value(), problem.getStatus());
        assertEquals("Invalid input", problem.getTitle());
        assertEquals("Recipe name must not be blank", problem.getDetail());
    }

    @Test
    void unexpectedExceptionMapsTo500() {
        ProblemDetail problem = handler.handleUnexpected(new RuntimeException("boom"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), problem.getStatus());
        assertEquals("Internal server error", problem.getTitle());
        assertEquals("An unexpected error occurred", problem.getDetail());
    }
}
