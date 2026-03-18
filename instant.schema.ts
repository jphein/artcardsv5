import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    decks: i.entity({
      name: i.string(),
      spreadType: i.string(),
      cards: i.json(),
      userId: i.string(),
      createdAt: i.number(),
    }),
    cards: i.entity({
      name: i.string(),
      description: i.string(),
      keywords: i.json(),
      sourceType: i.string(),
      sourceName: i.string(),
      imageUrl: i.string(),
      createdAt: i.number(),
    }),
  },
});

export default schema;
