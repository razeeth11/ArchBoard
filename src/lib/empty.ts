// Stand-in for Node built-ins (`fs`, `path`) that emscripten glue references behind
// `ENVIRONMENT_IS_NODE` checks. Never executed in the browser.
const empty = {};
export default empty;
