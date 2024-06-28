"use client";

import { Button } from "@nextui-org/button";
import { Progress } from "@nextui-org/progress";
import { cn } from "@nextui-org/theme";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

type BackendResponse<T> = {
  error?: string;
  result?: T;
};

type DeviceInfo = {
  deviceName: string;
  softwareVersion: string;
};

type DownloadProgress = {
  total: number;
  downloaded: number;
};

export default function Update() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<number | null>(null);

  async function fetchWithProgress() {
    const { appWindow } = await import("@tauri-apps/api/window");
    appWindow.listen(
      "DOWNLOAD_PROGRESS",
      ({ payload }: { payload: DownloadProgress }) => {
        setFetchProgress((payload.downloaded / payload.total) * 100);
      },
    );

    await invoke("download_archive", {
      url: "https://www.skytraxx.org/skytraxx5mini/skytraxx5mini-essentials.tar",
      fileName: "skytraxx_update.tar",
    });
  }

  async function success(msg: string) {
    try {
      await invoke("clean_device", {
        tarPath: "skytraxx_update.tar",
      });
    } catch (e) {
      console.error("Error cleaning device", e);
    }

    setSuccessMessage(msg);
    setLoading(false);
  }

  function failed(msg: string, err?: any) {
    console.log("[ERROR]", err);
    setError(msg);
    setLoading(false);
  }

  return (
    <div className="m-10">
      <h1 className="text-2xl font-skytraxx">Skytraxx</h1>
      <Text ringColor="gray">
        Stelle sicher dass dein SKYTRAXX Vario an deinen Computer angesclossen
        ist. Wir machen den Rest!
      </Text>
      {error && <Text ringColor="red">{error}</Text>}
      {fetchProgress !== null && (
        <Progress className="mt-8 w-1/2" value={fetchProgress} />
      )}
      <Button
        isLoading={loading}
        isDisabled={loading || !!successMessage}
        onClick={async () => {
          setError(null);
          setLoading(true);
          setFetchProgress(null);
          setSuccessMessage(null);

          const deviceInfoRes = (await invoke(
            "get_skytraxx_device",
          )) as BackendResponse<DeviceInfo>;
          if (deviceInfoRes.error) {
            return failed(
              "Skytraxx Vario konnte nicht gefunden werden. Ist es angeschlossen?",
              deviceInfoRes.error,
            );
          }

          if (deviceInfoRes.result?.deviceName !== "5mini") {
            return failed(
              "Im Moment können nur Skytraxx 5 Mini Geräte aktualisiert werden.",
            );
          }

          try {
            await fetchWithProgress();
          } catch (error) {
            return failed(
              "Fehler beim Herunterladen der Datei. Bist du mit dem Internet verbunden?",
              error,
            );
          }

          const extractRes: BackendResponse<string> = await invoke("extract", {
            tarPath: "skytraxx_update.tar",
          });

          if (extractRes.error) {
            return failed("Fehler beim Entpacken der Datei.", extractRes.error);
          }

          const updateSoftwareVersion = parseInt(extractRes.result!);
          console.log(
            "[DEBUG]",
            "update sw",
            updateSoftwareVersion,
            "device sw",
            deviceInfoRes.result!.softwareVersion,
          );
          if (
            updateSoftwareVersion <=
            parseInt(deviceInfoRes.result!.softwareVersion)
          ) {
            return success(
              "Dein Skytraxx Vario ist bereits auf dem neuesten Stand! Du kannst die App jetzt schließen.",
            );
          }

          // update device

          success(
            "Dein Vario wurde erfolgreich aktualisiert! Du kannst die App jetzt schließen.",
          );
        }}
        className="px-2 rounded py-1 ring-1 ring-gray-400 mt-8"
      >
        Vario aktualisieren
      </Button>
      {!!successMessage && <Text ringColor="green">{successMessage}</Text>}
    </div>
  );
}

function Text({
  children,
  ringColor = "gray",
}: {
  children: string;
  ringColor: "red" | "green" | "gray";
}) {
  return (
    <p
      className={cn("text-sm mt-4 rounded p-2 ring-1 ring-gray-300 max-w-fit", {
        "ring-red-300": ringColor === "red",
        "ring-gray-300": ringColor === "gray",
        "ring-green-300": ringColor === "green",
      })}
    >
      {children}
    </p>
  );
}
