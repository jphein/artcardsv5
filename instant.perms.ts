const rules = {
  decks: {
    bind: ["isOwner", "auth.id != null && auth.id == data.userId"],
    allow: {
      view: "isOwner",
      create: "auth.id != null",
      update: "isOwner",
      delete: "isOwner",
    },
  },
  cards: {
    allow: {
      view: "true",
    },
  },
  creations: {
    allow: {
      view: "true",
    },
  },
  $files: {
    allow: {
      view: "true",
    },
  },
};

export default rules;
