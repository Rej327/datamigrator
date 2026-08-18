import React, { useState, useEffect } from 'react';
import { Layout } from './components/ui/Layout';
import { ProjectSetup } from './components/ProjectSetup';
import { ImportProfile } from './components/ImportProfile';
import { TargetSchema } from './components/TargetSchema';
import { ColumnMappingUI } from './components/ColumnMapping';
import { Transformations } from './components/Transformations';
import { GenerateSQL } from './components/GenerateSQL';
import { PasswordGate } from './components/PasswordGate';
import { useStore } from './store';

export default function App() {
  const [activeTab, setActiveTab] = useState('project');
  const theme = useStore(state => state.theme);
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const initDatabase = useStore(state => state.initDatabase);

  useEffect(() => {
    initDatabase();
  }, [initDatabase]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Entrance Password Gate
  if (!isAuthenticated) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <PasswordGate />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'project':
        return <ProjectSetup onNext={() => setActiveTab('import')} />;
      case 'import':
        return <ImportProfile onNext={() => setActiveTab('schema')} />;
      case 'schema':
        return <TargetSchema onNext={() => setActiveTab('mapping')} />;
      case 'mapping':
        return <ColumnMappingUI onNext={() => setActiveTab('transform')} />;
      case 'transform':
        return <Transformations onNext={() => setActiveTab('generate')} />;
      case 'generate':
        return <GenerateSQL />;
      default:
        return <ProjectSetup onNext={() => setActiveTab('import')} />;
    }
  };

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} h-full w-full`}>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </div>
  );
}

