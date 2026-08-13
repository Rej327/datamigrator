"use client";

import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { Layout } from '../components/ui/Layout';
import { ProjectSetup } from '../components/ProjectSetup';
import { ImportProfile } from '../components/ImportProfile';
import { TargetSchema } from '../components/TargetSchema';
import { ColumnMappingUI } from '../components/ColumnMapping';
import { Transformations } from '../components/Transformations';
import { GenerateSQL } from '../components/GenerateSQL';

export default function AppClient() {
  const [activeTab, setActiveTab] = useState('project');

  return (
    <>
      <Toaster position="top-right" richColors />
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'project' && <ProjectSetup onNext={() => setActiveTab('import')} />}
        {activeTab === 'import' && <ImportProfile onNext={() => setActiveTab('schema')} />}
        {activeTab === 'schema' && <TargetSchema onNext={() => setActiveTab('mapping')} />}
        {activeTab === 'mapping' && <ColumnMappingUI onNext={() => setActiveTab('transform')} />}
        {activeTab === 'transform' && <Transformations onNext={() => setActiveTab('generate')} />}
        {activeTab === 'generate' && <GenerateSQL />}
      </Layout>
    </>
  );
}
