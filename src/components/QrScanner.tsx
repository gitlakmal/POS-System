"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Modal } from "./ui";

interface Detector {
  detect(src: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type DetectorCtor = new (opts?: { formats: string[] }) => Detector;

/** Camera QR scan using the browser's BarcodeDetector (Chrome/Android/Edge). USB scanners just type into the search box. */
export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const { L } = useStore();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setError(L("මේ බ්‍රවුසරයේ කැමරා ස්කෑන් නැත. ID අංකය ටයිප් කරන්න, නැත්නම් USB ස්කෑනරයක් භාවිතා කරන්න.", "Camera scan is not supported here. Type the ID or use a USB scanner."));
      return;
    }
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const detector = new Ctor({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        void v.play();
        timer = setInterval(async () => {
          try {
            const found = await detector.detect(v);
            if (found[0]) onResult(found[0].rawValue);
          } catch {
            /* keep trying */
          }
        }, 300);
      })
      .catch(() => setError(L("කැමරාව භාවිතා කළ නොහැක", "Camera not available")));
    return () => {
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [L, onResult]);

  return (
    <Modal title={L("QR කාඩ්පත ස්කෑන් කරන්න", "Scan QR card")} onClose={onClose}>
      {error ? (
        <p className="text-slate-600">{error}</p>
      ) : (
        <video ref={video} muted playsInline className="aspect-square w-full rounded-2xl bg-black object-cover" />
      )}
    </Modal>
  );
}
