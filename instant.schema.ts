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
      imagePath: i.string(),
      userId: i.string().optional(),
      createdAt: i.number(),
    }),
    creations: i.entity({
      imagePath: i.string(),
      type: i.string(),
      prompt: i.string(),
      userId: i.string(),
      createdAt: i.number(),
      model: i.string(),
      style: i.string(),
      cardName: i.string(),
      cardDescription: i.string(),
      cardKeywords: i.json(),
      aspectRatio: i.string(),
    }),
  },
});

export default schema;
