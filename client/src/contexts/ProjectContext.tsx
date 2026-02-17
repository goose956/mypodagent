import { createContext, useContext, useState, ReactNode } from 'react';
import type { Project, ProductListing, VideoProject } from '@shared/schema';

interface ProjectContextType {
  selectedProject: Project | null;
  selectedProduct: ProductListing | null;
  currentVideoProject: VideoProject | null;
  setSelectedProject: (project: Project | null) => void;
  setSelectedProduct: (product: ProductListing | null) => void;
  setCurrentVideoProject: (videoProject: VideoProject | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

export const ProjectProvider = ({ children }: ProjectProviderProps) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductListing | null>(null);
  const [currentVideoProject, setCurrentVideoProject] = useState<VideoProject | null>(null);

  const handleSetSelectedProject = (project: Project | null) => {
    // Reset product selection when project changes
    if (project?.id !== selectedProject?.id) {
      setSelectedProduct(null);
    }
    setSelectedProject(project);
  };

  const value = {
    selectedProject,
    selectedProduct,
    currentVideoProject,
    setSelectedProject: handleSetSelectedProject,
    setSelectedProduct,
    setCurrentVideoProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};