import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

interface UpdateStatus {
  checking: boolean;
  downloading: boolean;
  available: boolean;
  progress: number;
}

export function useOtaUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({
    checking: false,
    downloading: false,
    available: false,
    progress: 0,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let updater: typeof import("@capgo/capacitor-updater").CapacitorUpdater;

    const initUpdater = async () => {
      try {
        const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
        updater = CapacitorUpdater;

        // Notify the plugin that the app is ready
        await updater.notifyAppReady();

        // Listen for update events
        updater.addListener("updateAvailable", async (info) => {
          console.log("Update available:", info);
          setStatus((prev) => ({ ...prev, available: true }));
          toast.info("New update available! Downloading...");
        });

        updater.addListener("downloadComplete", async (info) => {
          console.log("Download complete:", info);
          setStatus((prev) => ({ ...prev, downloading: false, progress: 100 }));
          toast.success("Update downloaded! Restarting app...", {
            duration: 2000,
          });
          
          // Apply the update after a brief delay
          setTimeout(async () => {
            try {
              await updater.set(info.bundle);
            } catch (e) {
              console.error("Failed to apply update:", e);
            }
          }, 2000);
        });

        updater.addListener("downloadFailed", (info) => {
          console.error("Download failed:", info);
          setStatus((prev) => ({ ...prev, downloading: false }));
          toast.error("Update download failed. Will retry later.");
        });

        updater.addListener("updateFailed", (info) => {
          console.error("Update failed:", info);
          toast.error("Update failed to apply.");
        });

        // Check for updates on app start
        checkForUpdates(updater);
      } catch (error) {
        console.error("Failed to initialize OTA updater:", error);
      }
    };

    const checkForUpdates = async (
      updaterInstance: typeof import("@capgo/capacitor-updater").CapacitorUpdater
    ) => {
      try {
        setStatus((prev) => ({ ...prev, checking: true }));
        
        // The plugin automatically checks for updates when configured
        // This is a manual trigger for immediate check
        const latest = await updaterInstance.getLatest();
        
        if (latest && latest.url) {
          setStatus((prev) => ({ ...prev, checking: false, downloading: true }));
          await updaterInstance.download({
            url: latest.url,
            version: latest.version || "1.0.0",
          });
        } else {
          setStatus((prev) => ({ ...prev, checking: false }));
          console.log("App is up to date");
        }
      } catch (error) {
        console.error("Failed to check for updates:", error);
        setStatus((prev) => ({ ...prev, checking: false }));
      }
    };

    initUpdater();

    return () => {
      if (updater) {
        updater.removeAllListeners();
      }
    };
  }, []);

  return status;
}
