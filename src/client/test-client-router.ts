import { findMatch, type Route } from './client-router.js';

// Mock components for testing (since we don't have actual React components)
const MockPage = () => null;
const MockLayout = () => null;

// Simplified router definition based on generated-router.txt
const root: Route = {
  page: MockPage,
  layout: MockLayout,
  head: {title:"apa"},
  guard: () => true,
  children: [
    {
      path: "about",
      page: MockPage,
      children: [
        {
          path: "skip",
          children: [
            {
              path: "folders",
              page: MockPage,
            },
          ],
        },
      ],
    },
    {
      path: "goals",
      page: MockPage,
    },
    {
      path: "skills",
      page: MockPage,
      head: {title:"skills"},
      guard: () => true, // Stackable: auth check for skills section
      children: [
        {
          path: "summary",
          page: MockPage,
        },
        {
          path: "assessments",
          page: MockPage,
          guard: () => true, // Stackable: additional auth for assessments
          children: [
            {
              param: "employeeId",
              page: MockPage,
              middleware: () => true, // Non-stackable: validate employee ID
            },
          ],
        },
      ],
    },
    {
      path: "meetings",
      page: MockPage,
      children: [
        {
          param: "id",
          children: [
            {
              path: "run",
              page: MockPage,
            },
            {
              path: "view",
              page: MockPage,
            },
          ],
        },
      ],
    },
    {
      path: "customers",
      page: MockPage,
      children: [
        {
          param: "id",
          page: MockPage,
          middleware: () => true, // Non-stackable: validates customer ID format
        },
        {
          path: "statistics",
          page: MockPage,
          middleware: () => true, // Non-stackable: checks permissions for statistics
        }
      ],
    },
    // Test case: both path and param routes in same children list
    // The path route "specific" should be matched before the param route "catchall"
    {
      path: "test",
      children: [
        {
          path: "specific",
          page: MockPage,
        },
        {
          param: "catchall",
          page: MockPage,
        },
      ],
    },
  ],
};

// Test cases
const testCases = [
  "/",
  "/about",
  "/about/skip/folders",
  "/about/skip",
  "/goals",
  "/skills",
  "/skills/summary",
  "/skills/assessments",
  "/skills/assessments/123",
  "/meetings",
  "/meetings/456/run",
  "/meetings/456/view",
  "/customers",
  "/customers/789",
  "/customers/statistics",
  // Test cases for path vs param priority
  "/test/specific",  // Should match the path route, not the param route
  "/test/anything",  // Should match the param route since "anything" != "specific"
  "/nonexistent",
  "/about/nonexistent",
];

console.log("Testing findMatch function:\n");

testCases.forEach(path => {
  const result = findMatch(root, path);
  console.log(`Path: ${path}`);
  if (result) {
    console.log(`  Pattern: ${result.pattern}`);
    console.log(`  Params: ${JSON.stringify(result.params)}`);
    console.log(`  Layouts: ${result.layouts.length}`);
    console.log(`  Guards: ${result.guards.length}`);
    console.log(`  Middleware: ${result.middleware.length}`);
    console.log(`  Heads: ${result.heads.length}`);
  } else {
    console.log("  No match found");
  }
  console.log("");
});