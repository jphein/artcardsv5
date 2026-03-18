import type { InstantRules } from "@instantdb/react";
import type schema from "./src/db";

const rules: InstantRules<typeof schema> = {
  decks: {
    bind: ["isOwner", "auth.id != null && auth.id == data.owner.id"],
    allow: {
      view: "isOwner",
      create: "auth.id != null",
      update: "isOwner",
      delete: "isOwner",
    },
  },
};

export default rules;
