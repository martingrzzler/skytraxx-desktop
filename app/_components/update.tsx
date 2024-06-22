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
  const [showSuccess, setShowSuccess] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<number | null>(null);

  async function fetchWithProgress() {
    const { appWindow } = await import("@tauri-apps/api/window");
    appWindow.listen(
      "DOWNLOAD_PROGRESS",
      ({ payload }: { payload: DownloadProgress }) => {
        console.log("Download progress", payload);
        setFetchProgress((payload.downloaded / payload.total) * 100);
      },
    );

    invoke("download_archive", {
      url: "http://127.0.0.1:8080/archive.tar",
      fileName: "skytraxx_update.tar",
    });
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
        isDisabled={loading || showSuccess}
        onClick={async () => {
          setError(null);
          setLoading(true);

          // @ts-ignore
          const deviceInfoRes = (await invoke(
            "get_skytraxx_device",
          )) as BackendResponse<DeviceInfo>;
          if (deviceInfoRes.error) {
            setError(
              "Skytraxx Vario konnte nicht gefunden werden. Ist es angeschlossen?",
            );
            setLoading(false);
            return;
          }

          console.log(deviceInfoRes.result);
          // depending on the device info, we can now download the correct tar file
          try {
            await fetchWithProgress();
          } catch (error) {
            console.log("Download error", error);
            setError(
              "Fehler beim Herunterladen der Datei. Bist du mit dem Internet verbunden?",
            );
            setLoading(false);
            return;
          }

          const res: BackendResponse<void> = await invoke("update_device", {
            tarPath: "skytraxx_update.tar",
            softwareVersion: "deadbeef",
          });

          if (res.error) {
            console.error(res.error);
            setError(res.error);
            setLoading(false);
            return;
          }

          setLoading(false);
          setShowSuccess(true);
        }}
        className="px-2 rounded py-1 ring-1 ring-gray-400 mt-8"
      >
        Vario aktualisieren
      </Button>
      {showSuccess && (
        <Text ringColor="green">
          Vario wurde erfolgreich aktualisiert! Du kannst die App jetzt
          schließen.
        </Text>
      )}
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
