import { init, id, i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    decks: i.entity({
      name: i.string(),
      spreadType: i.string(),
      cards: i.json(),
      userId: i.string(),
      createdAt: i.number(),
    }),
  },
});

const db = init({
  appId: process.env.REACT_APP_INSTANTDB_ID,
  schema,
});

export { db, id, schema };
