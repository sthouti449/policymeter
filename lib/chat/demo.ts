// Shared by the browser and the server, so no server-only imports here.

export const DEMO_OFF_TOPIC =
  "I only cover this demo and the builder's background. For policy questions, try the Policy Assistant.";

export const DEMO_STARTERS = [
  "How is cost calculated?",
  "Why Azure OpenAI first?",
  "How do you prevent hallucinations?",
  "What's Suresh's relevant experience?",
  "How would this scale to 60+ agencies?",
];

export interface DemoReply {
  answer: string;
  refused: boolean;
  sources: string[]; // titles of the notes the answer drew on
  cost: import("./types").CostInfo;
}
