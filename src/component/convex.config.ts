import { defineComponent } from "convex/server";

/** Component definition. Mount it with `app.use(memberships)` in `convex/convex.config.ts`. */
const component = defineComponent("memberships");

// Nest official child components here, e.g.:
// import sharded from "@convex-dev/sharded-counter/convex.config";
// component.use(sharded);

export default component;
