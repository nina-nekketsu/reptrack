// src/data/models.js

// Define the data models for the app

export const Exercise = {
  id: null,
  name: '',
  muscleGroup: '',
  type: '', // e.g., strength, cardio, flexibility
};

export const Set = {
  id: null,
  weight: 0,
  reps: 0,
};

export const Workout = {
  id: null,
  date: null,
  exercises: [], // Array of Exercise IDs
};

export const User = {
  id: null,
  name: '',
  bodyweight: 0,
};
