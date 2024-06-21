"use client";
import { Button } from "@nextui-org/button";
import { cn } from "@nextui-org/theme";
import { BaseDirectory } from "@tauri-apps/api/fs";
import { useState } from "react";

type BackendResponse<T> = {
  error?: string;
  result?: T;
};

type DeviceInfo = {
  deviceName: string;
  softwareVersion: string;
};

export default function Update() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  async function fetchTar() {
    const res = await fetch("http://localhost:8888/archive.tar");
    if (!res.ok) {
      throw new Error("Failed to fetch update");
    }

    // @ts-ignore
    await window.__TAURI__.fs.writeBinaryFile(
      "skytraxx_update.tar",
      await res.arrayBuffer(),
      {
        dir: BaseDirectory.Download,
      },
    );
  }

  return (
    <div className="m-10">
      <h1 className="text-2xl font-skytraxx">Skytraxx</h1>
      <Text ringColor="gray">
        Stelle sicher dass dein SKYTRAXX Vario an deinen Computer angesclossen
        ist. Wir machen den Rest!
      </Text>
      {error && <Text ringColor="red">{error}</Text>}
      <Button
        isLoading={loading}
        isDisabled={loading || showSuccess}
        onClick={async () => {
          setError(null);
          setLoading(true);

          // @ts-ignore
          const deviceInfoRes = (await window.__TAURI__.tauri.invoke(
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
            await fetchTar();
          } catch (error) {
            setError(
              "Fehler beim Herunterladen der Datei. Bist du mit dem Internet verbunden?",
            );
            setLoading(false);
            return;
          }

          // @ts-ignore
          const res: BackendResponse = await window.__TAURI__.tauri.invoke(
            "update_device",
            { tarPath: "skytraxx_update.tar", softwareVersion: "4.0.0" },
          );

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
