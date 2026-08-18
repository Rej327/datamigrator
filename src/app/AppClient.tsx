"use client";

import React, { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { Layout } from '../components/ui/Layout';
import { ProjectSetup } from '../components/ProjectSetup';
import { ImportProfile } from '../components/ImportProfile';
import { TargetSchema } from '../components/TargetSchema';
import { ColumnMappingUI } from '../components/ColumnMapping';
import { Transformations } from '../components/Transformations';
import { GenerateSQL } from '../components/GenerateSQL';
import { PasswordGate } from '../components/PasswordGate';
import { useStore } from '../store';

export default function AppClient() {
  const [activeTab, setActiveTab] = useState('project');
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const theme = useStore((state) => state.theme);
  const initDatabase = useStore((state) => state.initDatabase);

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

  // If not authenticated, render Password Gate immediately
  if (!isAuthenticated) {
    return (
      <div className={theme === 'dark' ? 'dark' : ''}>
        <Toaster position="top-right" richColors />
        <PasswordGate />
      </div>
    );
  }

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''} h-full w-full`}>
      <Toaster position="top-right" richColors />
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'project' && <ProjectSetup onNext={() => setActiveTab('import')} />}
        {activeTab === 'import' && <ImportProfile onNext={() => setActiveTab('schema')} />}
        {activeTab === 'schema' && <TargetSchema onNext={() => setActiveTab('mapping')} />}
        {activeTab === 'mapping' && <ColumnMappingUI onNext={() => setActiveTab('transform')} />}
        {activeTab === 'transform' && <Transformations onNext={() => setActiveTab('generate')} />}
        {activeTab === 'generate' && <GenerateSQL />}
      </Layout>
    </div>
  );
}
