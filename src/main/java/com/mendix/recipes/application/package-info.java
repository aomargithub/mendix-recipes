/**
 * Application core: orchestration service and ports.
 *
 * <p>{@link com.mendix.recipes.domain.RecipesRepository} is the persistence contract of the
 * {@link com.mendix.recipes.domain.Recipe} aggregate (create, look up by id) and is
 * deliberately free of framework and DTO types. {@link RecipeQueryPort} is the read side for
 * the web layer: paged {@link com.mendix.recipes.application.dto.RecipeSummaryDto} projections
 * and the category catalog.
 *
 * <p>Both ports are implemented by a single in-memory adapter guarded by one read/write lock,
 * so the write and read views cannot diverge (CQRS-lite on a single store). The split keeps
 * paging and DTO concerns out of the domain and leaves a seam for swapping the adapter without
 * touching the service or REST layer.
 */
package com.mendix.recipes.application;
