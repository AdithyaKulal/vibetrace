"use client";

import { Separator } from "@/components/ui/separator";
import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { usePlayground } from "@/modules/playground/hooks/usePlayground";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { TemplateFileTree } from "@/modules/playground/components/playground-explorer";
import { useFileExplorer } from "@/modules/playground/hooks/useFileExplorer";
import type { TemplateFile } from "@/modules/playground/lib/path-to-json";

const MainPlaygroundPage = () => {
  const { id } = useParams<{ id: string }>();

  const { playgroundData, templateData, isLoading, error, saveTemplateData } =
    usePlayground(id);
   
  const {
    setTemplateData,
    setActiveFileId,
    setPlaygroundId,
    setOpenFiles,
    activeFileId,
    closeAllFiles,
    closeFile,
    openFile,
    openFiles,
  } = useFileExplorer();

  useEffect(() => { setPlaygroundId(id) }, [id, setPlaygroundId]);

  useEffect(() => { 

    if (templateData && !openFiles.length) {
      setTemplateData(templateData);
    }


  }, [templateData, setTemplateData, openFiles.length])
  
  const activeFile = openFiles.find((file) => file.id === activeFileId)
  const hasUnsavedChanges = openFiles.some((file) => file.hasUnsavedChanges);

  const handleFileSelect = (file: TemplateFile) => {
    openFile(file)
  };

  return (
    <TooltipProvider>
      <>
        <TemplateFileTree
          data={templateData!}
          onFileSelect={handleFileSelect}
          selectedFile={activeFile}
          title="File Explorer"
          onAddFile={() => {}}
          onAddFolder={() => {}}
          onDeleteFile={() => {}}
          onDeleteFolder={() => {}}
          onRenameFolder={() => {}}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex flex-col flex-1">
              <h1 className="text-sm font-medium ">
                {playgroundData?.title || "Code playground"}
              </h1>
            </div>
          </div>
        </SidebarInset>
      </>
    </TooltipProvider>
  );
};

export default MainPlaygroundPage;
