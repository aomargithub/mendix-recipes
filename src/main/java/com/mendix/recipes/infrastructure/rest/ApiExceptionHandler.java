package com.mendix.recipes.infrastructure.rest;

import com.mendix.recipes.domain.RecipeNameAlreadyExistsException;
import com.mendix.recipes.domain.ResourceNotFoundException;
import com.mendix.recipes.domain.SortNotSupportedException;
import com.mendix.recipes.domain.UnknownFilterException;
import com.mendix.recipes.domain.UnknownMeasurementUnitException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "Resource not found", ex.getMessage());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ProblemDetail handleNoResourceFound(NoResourceFoundException ex) {
        return problem(HttpStatus.NOT_FOUND, "Not found", "The requested path does not exist");
    }

    @ExceptionHandler(RecipeNameAlreadyExistsException.class)
    public ProblemDetail handleDuplicateName(RecipeNameAlreadyExistsException ex) {
        return problem(HttpStatus.CONFLICT, "Recipe already exists", ex.getMessage());
    }

    @ExceptionHandler(UnknownFilterException.class)
    public ProblemDetail handleUnknownFilter(UnknownFilterException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Unknown filter", ex.getMessage());
    }

    @ExceptionHandler(SortNotSupportedException.class)
    public ProblemDetail handleSortNotSupported(SortNotSupportedException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Sorting not supported", ex.getMessage());
    }



    @ExceptionHandler(UnknownMeasurementUnitException.class)
    public ProblemDetail handleUnknownMeasurementUnit(UnknownMeasurementUnitException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Unknown measurement unit", ex.getMessage());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleMalformedBody(HttpMessageNotReadableException ex) {
        Throwable root = rootCause(ex);
        if (root instanceof IllegalArgumentException invalid) {
            return problem(HttpStatus.BAD_REQUEST, "Invalid input", invalid.getMessage());
        }
        return problem(HttpStatus.BAD_REQUEST, "Malformed request body",
                "Request body is not valid for the expected format: " + message(root));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid request parameter",
                "Parameter '" + ex.getName() + "' has an invalid value");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleInvalidInput(IllegalArgumentException ex) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid input", ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error",
                "An unexpected error occurred");
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }

    private static Throwable rootCause(Throwable throwable) {
        Throwable cause = throwable;
        while (cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause;
    }

    private static String message(Throwable throwable) {
        return throwable.getMessage() != null ? throwable.getMessage() : throwable.getClass().getSimpleName();
    }
}
