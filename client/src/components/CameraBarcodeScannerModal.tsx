import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { playScanBeep, playErrorBoop } from '../utils/audio';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Barcode Kamera HP / Laptop',
}) => {
  const [scannerError, setScannerError] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'pos-camera-barcode-reader';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setScannerError('');
      setIsScanning(true);

      // Check camera permission and devices
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('Tidak ada perangkat kamera yang terdeteksi di perangkat Anda');
      }

      // Prioritize back camera on mobile phones
      const backCamera = devices.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('belakang')
      ) || devices[devices.length - 1];

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        backCamera.id,
        {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          // Success callback
          playScanBeep();
          setLastScanned(decodedText);
          onScanSuccess(decodedText);
          // Optional short vibration on mobile
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(80);
          }
        },
        (_errorMessage) => {
          // Frame by frame scan without match - ignore silent errors
        }
      );
    } catch (err: any) {
      console.error('Camera Scanner Error:', err);
      playErrorBoop();
      setScannerError(err.message || 'Gagal mengakses kamera. Pastikan izin kamera telah diizinkan di browser.');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        })
        .catch((e) => console.debug('Stop scanner error:', e));
    }
    setIsScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">{title}</h3>
              <p className="text-[11px] text-slate-500">
                Arahkan kamera ke barcode kemasan barang atau kode QR
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-4 bg-slate-900 flex flex-col items-center justify-center relative min-h-[280px]">
          {scannerError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs text-center space-y-2 max-w-xs">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="font-bold">Kamera Tidak Dapat Diakses</div>
              <p className="text-[11px] leading-relaxed">{scannerError}</p>
              <button
                onClick={startScanner}
                className="mt-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          ) : (
            <div className="w-full relative overflow-hidden rounded-2xl bg-black">
              {/* Target Aim Box overlay */}
              <div
                id={readerElementId}
                className="w-full overflow-hidden rounded-2xl"
                style={{ minHeight: '240px' }}
              />

              {/* Aiming guidelines */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-2xl relative shadow-lg shadow-emerald-500/20 animate-pulse">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Last scanned feedback banner */}
        {lastScanned && (
          <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Barcode Terdeteksi:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-200">
                {lastScanned}
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Tersimpan</span>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Mendukung Barcode 1D (EAN/UPC/Code128) & QR Code</span>
          </span>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
