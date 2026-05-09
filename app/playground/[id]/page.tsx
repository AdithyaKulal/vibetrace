"use client";
import React from 'react'
import { useParams } from 'next/navigation';
import { usePlayground } from '@/modules/playground/hooks/usePlayground';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { TemplateFileTree } from '@/modules/playground/components/playground-explorer';


const MainPlaygroundPage = () => {
    const {id} = useParams<{ id: string }>();

    const { playgroundData, templateData, isLoading, error, saveTemplateData } = usePlayground(id)
    
    console.log("template data:", templateData);
    console.log("playgrounddata",playgroundData)


    const activeFile = "sample.txt"
    
  return (
    <TooltipProvider>
      <>
        <TemplateFileTree 
          data={templateData!}
          onFileSelect={() => { }}
          selectedFile={activeFile}
          title="File Explorer"
          onAddFile={() => { }}
          onAddFolder={() => { }}
          onDeleteFile={() => { }}
          onDeleteFolder={() => { }}
          onRenameFolder={() => { }}
          />
        <SidebarInset>
          <header className='flex h-16 shrink-0 items-center gap-2 border-b px-4'>
            <SidebarTrigger className='-ml-1'/>

          </header>
          <div className='flex flex-1 items-center gap-2'>
            <div className='flex flex-col flex-1'>
              <h1 className='text-sm font-medium '>
                {
                  playgroundData?.title || "Code playground"
                }
              </h1>
            </div>
         </div>

        </SidebarInset>
      </>

      </TooltipProvider>
  )
}

export default MainPlaygroundPage