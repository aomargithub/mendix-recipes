/**
 * Sample responses of the recipes API, used as the JSON snippets of the JSON structures.
 *
 * These are shaped exactly like the live responses of `com.mendix.recipes`, with two deliberate
 * choices: `quantity` carries a fractional value and `preparationTimeInMinutes` a small whole
 * number, because Studio Pro infers the primitive type of an element from the sample value and
 * the app must be able to import both a `0.5` and a `1` quantity.
 */

/** `GET /v1/categories` */
export const CATEGORIES_SAMPLE = ["cake mixes", "cakes", "chili"];

/** `GET /v1/recipes` and `GET /v1/categories/{category}/recipes` (Spring `PagedModel` envelope). */
export const RECIPES_SAMPLE = {
    content: [
        {
            id: "205d4bc2-8f38-4a1e-9a1a-2c0f5a2d5f11",
            name: "30 Minute Chili",
            descriptionPrefix: "Makes 6 servings",
            preparationTimeInMinutes: 30
        }
    ],
    page: {
        size: 20,
        number: 0,
        totalElements: 3,
        totalPages: 1
    }
};

/** `GET /v1/recipes/{id}` */
export const RECIPE_SAMPLE = {
    id: "205d4bc2-8f38-4a1e-9a1a-2c0f5a2d5f11",
    name: "30 Minute Chili",
    description: "Makes 6 servings. A quick chili that is ready in half an hour.",
    steps: ["Brown the ground beef in a large pot.", "Add the remaining ingredients and simmer for 20 minutes."],
    ingredients: [
        {
            name: "ground beef",
            quantity: 1.5,
            unit: "POUND"
        }
    ],
    author: "Unknown",
    postedAt: "2026-09-10T20:34:28.084Z",
    postedTo: "seed data",
    preparationTimeInMinutes: 30,
    categories: ["chili", "main dish"]
};

/**
 * The body of `POST /v1/recipes` (`CreateRecipeRequestDto`). Close to `RECIPE_SAMPLE` but not the
 * same: the request carries no `id`, and every field in it is mandatory.
 */
export const CREATE_RECIPE_SAMPLE = {
    name: "30 Minute Chili",
    description: "A quick chili that is ready in half an hour.",
    steps: ["Brown the ground beef in a large pot."],
    ingredients: [
        {
            name: "ground beef",
            quantity: 1.5,
            unit: "POUND"
        }
    ],
    author: "Unknown",
    postedAt: "2026-09-10T20:34:28.084Z",
    postedTo: "Mendix app",
    preparationTimeInMinutes: 30,
    categories: ["chili"]
};
