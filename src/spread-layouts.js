const SPREAD_LAYOUTS = {
  single: {
    name: "Single Card",
    count: 1,
    description: "One card, one answer",
    positions: [
      {
        label: "The Focus",
        sublabel: "Your central question or theme",
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
    ],
  },

  three: {
    name: "Three Card Spread",
    count: 3,
    description: "Past, present, and future",
    positions: [
      {
        label: "Past",
        sublabel: "What has led to this moment",
        rotation: -8,
        offsetX: -30,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Present",
        sublabel: "Where you are now",
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Future",
        sublabel: "What lies ahead",
        rotation: 8,
        offsetX: 30,
        offsetY: 0,
        scale: 1,
      },
    ],
  },

  four: {
    name: "Four Elements",
    count: 4,
    description: "Earth, air, fire, and water",
    positions: [
      {
        label: "Earth",
        sublabel: "Physical & material",
        rotation: 0,
        offsetX: 0,
        offsetY: 30,
        scale: 1,
      },
      {
        label: "Air",
        sublabel: "Thoughts & intellect",
        rotation: -5,
        offsetX: -30,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Fire",
        sublabel: "Passion & energy",
        rotation: 5,
        offsetX: 30,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Water",
        sublabel: "Emotions & intuition",
        rotation: 0,
        offsetX: 0,
        offsetY: -30,
        scale: 1,
      },
    ],
  },

  five: {
    name: "Five Card Cross",
    count: 5,
    description: "A cross of insight and clarity",
    positions: [
      {
        label: "Present",
        sublabel: "Current situation",
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1.1,
      },
      {
        label: "Past",
        sublabel: "Recent influences",
        rotation: -5,
        offsetX: -30,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Future",
        sublabel: "What's coming",
        rotation: 5,
        offsetX: 30,
        offsetY: 0,
        scale: 1,
      },
      {
        label: "Above",
        sublabel: "Best possible outcome",
        rotation: 0,
        offsetX: 0,
        offsetY: -30,
        scale: 1,
      },
      {
        label: "Below",
        sublabel: "Foundation beneath",
        rotation: 0,
        offsetX: 0,
        offsetY: 30,
        scale: 1,
      },
    ],
  },

  freeform: {
    name: "Free Form",
    count: Infinity,
    description: "Arrange freely — drag to reorder",
    positions: [],
  },
};

export default SPREAD_LAYOUTS;

export const SPREAD_TYPES = Object.keys(SPREAD_LAYOUTS);
