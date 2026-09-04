Mendix Developer Assignment

# Assignment

## Java

You are a developer for a website collecting and publishing recipes. The task assigned to you is to create the back-end REST services which can be consumed by the web designers.

Because Java is the common language in the company we'll expect a Java solution; the tools, library and build system are your choice as you are the Java expert. The recipe web site will be created using the Mendix Platform and consume your back-end service.

Below you'll find the user stories the product owner defined to create the first version of the Recipe web site.

### Story 1 - As a web designer I would like to retrieve recipes from the back-end system so I can display them in my app

Requirements:
- Without any additional query parameters, should return all recipes known to the back-end service
- Support filtering based on recipe category
- Support search strings, with the service then trying to match these in relevant fields (for example name and category)

### Story 2 - As a web designer I would like to retrieve the available recipe categories so I can do more focused requests for specific recipe types

Requirements: 
- Operation returns all recipe categories

### Story 3 - As a web designer I want to be able to add new recipes, so I can expand the recipe database with new, tasty and inspiring recipes

Requirements:
- When given valid input, creates a new recipe in the backend which can then be retrieved by the service's clients
- Make sure the provided input is valid
- Do not allow multiple recipes with the same name (so people don't get confused)

## Mendix

Unfortunately the web designer called in sick today and your product owner really wants to show of the new web site in the board of directors. She asks you to start creating the new web site using Mendix. 

### Story 4 - As a home cook I would like to visit a web site listing recipes, so I can get inspiration for what I want to cook tonight

Requirements:
- When navigating to the application, end up on the homepage which shows a recipe overview
- This homepage in split in two sections: 
    - On the left all available categories are shown 
	- The main panel on the page shows a list of recipes, with enough information (title, time needed) to know what the recipe is about 
- If you select a category, the main panel only shows the recipes from that category 
- Recipes are retrieved from the previously developed back end system 

### Story 5 - As a home cook I want to see the recipe details so I can cook the recipe I picked

Requirements:
- Either by double clicking on the selected recipe or clicking a button, a details page is opened which shows all the details of the selected recipe


# Restrictions, requirements and expectations:
- We expect your work to be delivered either as a public repository or as an archive in email attachment, including the git folder/history so we can follow your progress. We also expect instructions in a README.md file on how to run your application and its tests. For the Mendix portion of the assignment, please invite us to your project so we can also look into your model.
- You are free to use any framework or 3rd party library you deem useful for this assignment. We do expect you to be able to explain/defend your choices however.
- You are free in the design of the REST interface. We will review your design on aspects such as paths, request and response bodies, HTTP response codes, etc. 
- Use the Mendix Desktop Modeler for the Mendix portion of the assignment. The Web Modeler does not yet support consumption of REST services.
- While we do not expect any automated tests for the Mendix portion of the assignment, we do expect unit tests to cover the back-end functionality you built in stories 1-3. 
- The recipes in the backend should be stored in memory. The recipes with which the app will initially launch are included as XML files with the assignment. 

# Evaluation criteria
We will evaluate your assignment using the following criteria:

- The extent to which your work meets the requirements as specified above.
- The design of the API (e.g. Proper error responses, HTTP verbs, HTTP status codes).
- The level of maturity in your explanation of your architecture and design decisions.

For your assessment interview, the result of this assignment will be the starting point of the discussion. We will also discuss the design choices you made, as well as test your general software engineering and language knowledge. 

