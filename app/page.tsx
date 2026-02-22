"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

interface GeomatchResult {
  id: string;
  initial_rank: number;
  vector_distance: number;
  refined_rank: number;
  matches: number;
  latitude: number;
  longitude: number;
  elevation: number;
  date: string;
}

interface GeomatchResponse {
  count: number;
  results: GeomatchResult[];
}

export default function OSINTDashboard() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<GeomatchResponse | null>(null);
  const [selectedResult, setSelectedResult] = useState<GeomatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  // Use the API URL from the environment variable, fallback to localhost for safety

  const formatPanoId = (rawId: string) => {
    return rawId.replace(/_[0-9]$/, "");
  };

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setApiResponse(null);
      setSelectedResult(null);
      setErrorMsg(null);
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setErrorMsg(null);
    const formData = new FormData();
    formData.append("image_file", selectedImage);

    try {
      const response = await fetch(`/api/v1/query?top_k=30`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // If the VPS crashes, our bridge passes the error text down to here
        const errData = await response.json();
        throw new Error(errData.detail || `Error: ${response.status}`);
      }

      const data: GeomatchResponse = await response.json();
      setApiResponse(data);
      
      if (data.results.length > 0) {
        setSelectedResult(data.results[0]);
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white font-mono flex flex-col text-sm selection:bg-white selection:text-black">
      
      {/* MINIMAL HEADER */}
      <header className="flex justify-between items-center p-2 border-b border-neutral-800 shrink-0 uppercase text-xs tracking-widest">
        <div>GEOMATCH // TERMINAL</div>
        <div className={isLoading ? "animate-pulse" : "text-neutral-500"}>
          STATUS: {isLoading ? "SCANNING..." : "IDLE"}
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT: STREET VIEW */}
        <div className="flex-1 relative border-r border-neutral-800 bg-neutral-950">
           {!GOOGLE_MAPS_KEY ? (
             <div className="p-4 text-red-500">ERROR: MISSING GOOGLE MAPS KEY</div>
           ) : !selectedResult ? (
             <div className="absolute inset-0 flex items-center justify-center text-neutral-700">
                AWAITING TARGET COORDINATES
             </div>
           ) : (
             <iframe
               className="absolute inset-0 w-full h-full border-0 invert-[0.1]" // slight filter for aesthetics
               loading="lazy"
               allowFullScreen
               referrerPolicy="no-referrer-when-downgrade"
               src={`https://www.google.com/maps/embed/v1/streetview?key=${GOOGLE_MAPS_KEY}&pano=${formatPanoId(selectedResult.id)}`}
             />
           )}
        </div>

        {/* RIGHT: CONTROL PANEL */}
        <div className="w-[320px] lg:w-[400px] flex flex-col shrink-0 bg-black">
          
          {/* UPLOAD & EXECUTE */}
          <div className="p-3 border-b border-neutral-800 shrink-0 flex flex-col gap-3">
            <label className="relative border border-neutral-800 hover:border-neutral-500 transition-colors h-32 flex items-center justify-center cursor-pointer group bg-neutral-950">
              {previewUrl ? (
                <Image src={previewUrl} alt="Target" fill className="object-contain p-1" />
              ) : (
                <span className="text-neutral-600 group-hover:text-white transition-colors">UPLOAD_TARGET.JPG</span>
              )}
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageChange} />
            </label>

            <button 
              onClick={handleSubmit} 
              disabled={isLoading || !selectedImage}
              className="w-full bg-white text-black py-2 font-bold disabled:bg-neutral-800 disabled:text-neutral-500 hover:bg-neutral-200 transition-colors uppercase"
            >
              Execute
            </button>

            {errorMsg && <div className="text-red-500 text-xs">{errorMsg}</div>}
          </div>

          {/* RESULTS LIST */}
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {!apiResponse ? (
              <div className="text-neutral-700 text-xs p-1">NO DATA</div>
            ) : (
              <div className="flex flex-col gap-1">
                {apiResponse.results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className={`w-full text-left flex justify-between px-2 py-1.5 transition-colors text-xs
                      ${selectedResult?.id === result.id 
                        ? 'bg-white text-black font-bold' 
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}
                    `}
                  >
                    <span>#{result.refined_rank}</span>
                    <span>{result.latitude.toFixed(6)}, {result.longitude.toFixed(6)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}