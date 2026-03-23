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
      create: "auth.id == data.userId",
      delete: "auth.id == data.userId",
    },
  },
  $files: {
    allow: {
      view: "true",
      create: "auth.id != null",
    },
  },
};

export default rules;
