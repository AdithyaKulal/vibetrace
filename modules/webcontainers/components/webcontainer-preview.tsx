"use client";

import React, { useEffect, useState, useRef } from "react";
import { transformToWebContainerFormat } from "../hooks/transformer";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { WebContainer } from "@webcontainer/api";
import { TemplateFolder } from "@/modules/playground/lib/path-to-json";
import TerminalComponent from "./terminal";

interface WebContainerPreviewProps {
  templateData: TemplateFolder;
  serverUrl: string;
  isLoading: boolean;
  error: string | null;
  instance: WebContainer | null;
  writeFileSync: (path: string, content: string) => Promise<void>;
  forceResetup?: boolean;
}

const WebContainerPreview = ({
  templateData,
  error,
  instance,
  isLoading,
  serverUrl,
  writeFileSync,
  forceResetup = false,
}: WebContainerPreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loadingState, setLoadingState] = useState({
    transforming: false,
    mounting: false,
    installing: false,
    starting: false,
    ready: false,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const totalSteps = 4;
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isSetupInProgress, setIsSetupInProgress] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);

  const terminalRef = useRef<any>(null);
  // Store stream log cache for playback if terminal mounts late
  const streamLogCache = useRef<string[]>([]);

  // Safe wrapper helper to write terminal streams even during late mount cycles
  const logToTerminal = (data: string) => {
    if (terminalRef.current?.writeToTerminal) {
      terminalRef.current.writeToTerminal(data);
    } else {
      streamLogCache.current.push(data);
    }
  };

  // Playback cached strings once the terminal reports ready status
  useEffect(() => {
    if (
      isTerminalReady &&
      terminalRef.current?.writeToTerminal &&
      streamLogCache.current.length > 0
    ) {
      streamLogCache.current.forEach((log) =>
        terminalRef.current.writeToTerminal(log),
      );
      streamLogCache.current = [];
    }
  }, [isTerminalReady]);

  useEffect(() => {
    if (forceResetup) {
      setIsSetupComplete(false);
      setIsSetupInProgress(false);
      setPreviewUrl("");
      setCurrentStep(0);
      streamLogCache.current = [];
      setLoadingState({
        transforming: false,
        mounting: false,
        installing: false,
        starting: false,
        ready: false,
      });
    }
  }, [forceResetup]);

  useEffect(() => {
    async function setupContainer() {
      if (!instance || isSetupComplete || isSetupInProgress) return;

      try {
        setIsSetupInProgress(true);
        setSetupError(null);

        try {
          const packageJsonExists = await instance.fs.readFile(
            "package.json",
            "utf8",
          );

          if (packageJsonExists) {
            logToTerminal(
              "🔄 Reconnecting to existing WebContainer session...\r\n",
            );

            instance.on("server-ready", (port: number, url: string) => {
              logToTerminal(`🌐 Reconnected to server at ${url}\r\n`);
              setPreviewUrl(url);
              setLoadingState((prev) => ({
                ...prev,
                starting: false,
                ready: true,
              }));
            });

            setCurrentStep(4);
            setLoadingState((prev) => ({ ...prev, starting: true }));
            return;
          }
        } catch (error) {}

        // Step 1: Transform Data
        setLoadingState((prev) => ({ ...prev, transforming: true }));
        setCurrentStep(1);
        logToTerminal("🔄 Transforming template data...\r\n");

        // @ts-ignore
        const files = transformToWebContainerFormat(templateData);
        setLoadingState((prev) => ({
          ...prev,
          transforming: false,
          mounting: true,
        }));
        setCurrentStep(2);

        // Step 2: Mount Files
        logToTerminal("📁 Mounting files to WebContainer...\r\n");
        await instance.mount(files);
        logToTerminal("✅ Files mounted successfully\r\n");

        setLoadingState((prev) => ({
          ...prev,
          mounting: false,
          installing: true,
        }));
        setCurrentStep(3);

        // Step 3: Install Dependencies with Safeguard Flags
        logToTerminal("📦 Installing dependencies (npm install)...\r\n");

        const installProcess = await instance.spawn("npm", [
          "install",
          "--legacy-peer-deps",
          "--no-audit",
          "--no-shrinkwrap",
          "--prefer-online"
        ]);

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              logToTerminal(data);
            },
          }),
        );

        const installExitCode = await installProcess.exit;

      if (installExitCode !== 0) {
        logToTerminal(
          "⚠️ Initial install flagged. Running forced resolution fallback...\r\n",
        );
        const fallbackProcess = await instance.spawn("npm", [
          "install",
          "ajv@8",
          "ajv-keywords@5",
          "--force",
        ]);
        fallbackProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              logToTerminal(data);
            },
          }),
        );
        await fallbackProcess.exit;
      } else {
        logToTerminal("✅ Dependencies installed successfully\r\n");
      }

        setLoadingState((prev) => ({
          ...prev,
          installing: false,
          starting: true,
        }));
        setCurrentStep(4);

        // Step 4: Start The Server
        logToTerminal("🚀 Starting development server...\r\n");

        // Check package.json scripts to determine the proper trigger command (start vs dev)
        let startScript = "start";
        try {
          const pkgRaw = await instance.fs.readFile("package.json", "utf8");
          const pkg = JSON.parse(pkgRaw);
          if (pkg.scripts?.dev && !pkg.scripts?.start) {
            startScript = "dev";
          }
        } catch (e) {}

        const startProcess = await instance.spawn("npm", ["run", startScript]);

        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              logToTerminal(data);
            },
          }),
        );

        instance.on("server-ready", (port: number, url: string) => {
          logToTerminal(`🌐 Server ready at ${url}\r\n`);
          setPreviewUrl(url);
          setLoadingState((prev) => ({
            ...prev,
            starting: false,
            ready: true,
          }));
          setIsSetupComplete(true);
          setIsSetupInProgress(false);
        });
      } catch (err) {
        console.error("Error setting up container:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        logToTerminal(`❌ Error: ${errorMessage}\r\n`);
        setSetupError(errorMessage);
        setIsSetupInProgress(false);
        setLoadingState({
          transforming: false,
          mounting: false,
          installing: false,
          starting: false,
          ready: false,
        });
      }
    }

    setupContainer();
  }, [instance, templateData, isSetupComplete, isSetupInProgress]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6 rounded-lg bg-gray-50 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <h3 className="text-lg font-medium">Initializing WebContainer</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Setting up the environment for your project...
          </p>
        </div>
      </div>
    );
  }

  if (error || setupError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-lg max-w-md">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5" />
            <h3 className="font-semibold">Error</h3>
          </div>
          <p className="text-sm">{error || setupError}</p>
        </div>
      </div>
    );
  }

  const getStepIcon = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (stepIndex === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    } else {
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepText = (stepIndex: number, label: string) => {
    const isActive = stepIndex === currentStep;
    const isComplete = stepIndex < currentStep;

    return (
      <span
        className={`text-sm font-medium ${
          isComplete
            ? "text-green-600"
            : isActive
              ? "text-blue-600"
              : "text-gray-500"
        }`}
      >
        {label}
      </span>
    );
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-zinc-950">
      {!previewUrl ? (
        <div className="h-full w-full flex flex-col min-h-0 p-4 gap-4 flex-1">
          {/* Progress Card Component */}
          <div className="w-full max-w-md p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-800 shadow-sm mx-auto shrink-0">
            <Progress
              value={(currentStep / totalSteps) * 100}
              className="h-2 mb-6"
            />

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getStepIcon(1)}
                {getStepText(1, "Transforming template data")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(2)}
                {getStepText(2, "Mounting files")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(3)}
                {getStepText(3, "Installing dependencies")}
              </div>
              <div className="flex items-center gap-3">
                {getStepIcon(4)}
                {getStepText(4, "Starting development server")}
              </div>
            </div>
          </div>

          {/* Core Interactive Terminal Frame Container */}
          <div className="flex-1 min-h-0 w-full rounded-md border border-zinc-800 bg-black relative flex flex-col">
            <div className="flex-1 h-full w-full min-h-0 relative">
              <TerminalComponent
                ref={(el) => {
                  terminalRef.current = el;
                  if (el && !isTerminalReady) {
                    setIsTerminalReady(true);
                  }
                }}
                webContainerInstance={instance}
                theme="dark"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex flex-col min-h-0">
          <div className="flex-1 min-h-0 bg-white">
            <iframe
              src={previewUrl}
              className="w-full h-full border-none"
              title="WebContainer Preview"
            />
          </div>

          <div className="h-64 border-t border-zinc-800 bg-black flex flex-col shrink-0 overflow-hidden">
            <div className="flex-1 min-h-0 w-full relative">
              <TerminalComponent
                ref={terminalRef}
                webContainerInstance={instance}
                theme="dark"
                className="absolute inset-0 h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebContainerPreview;
