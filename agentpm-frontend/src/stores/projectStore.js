import { create } from 'zustand';

export const useProjectStore = create((set) => ({
  projects: [],
  selectedProject: null,
  members: [],

  setProjects: (projects) => set({ projects }),
  setSelectedProject: (project) => set({ selectedProject: project }),
  setMembers: (members) => set({ members }),
}));