"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Map, { Marker, Source, MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

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

type ViewMode = "streetview" | "map";

export default function OSINTDashboard() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<GeomatchResponse | null>(null);
  const [selectedResult, setSelectedResult] = useState<GeomatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<ViewMode>("streetview");
  const mapRef = useRef<MapRef>(null);

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
        const errData = await response.json();
        throw new Error(errData.detail || `Error: ${response.status}`);
      }

      const data: GeomatchResponse = await response.json();
      setApiResponse(data);
      setSelectedResult(data.results[0]);
    } catch (error) {
      console.error(error);
      setErrorMsg(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "map" && selectedResult && mapRef.current) {
      mapRef.current.flyTo({
        center: [selectedResult.longitude, selectedResult.latitude],
        zoom: 18,
        pitch: 30,
        bearing: 0,
        duration: 2000,
      });
    }
  }, [selectedResult, viewMode]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-black text-white font-mono flex flex-col text-sm selection:bg-white selection:text-black">
      
      {/* HEADER */}
      <header className="flex justify-between items-center p-2 border-b border-neutral-800 shrink-0 uppercase text-xs tracking-widest">
        <div>GEOMATCH // TERMINAL</div>
        <div className={isLoading ? "animate-pulse text-white" : "text-neutral-500"}>
          STATUS: {isLoading ? "LOCATING..." : "IDLE"}
        </div>
      </header>

      {/* MAIN DIV */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        
        {/* LEFT PANE: DYNAMIC VIEW */}
        <div className="flex-1 min-h-[45vh] md:min-h-0 relative border-b md:border-b-0 md:border-r border-neutral-800 bg-neutral-950">
           
           {/* VIEW TOGGLE OVERLAY */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex bg-black/80 backdrop-blur-md border border-neutral-700 rounded-sm overflow-hidden text-[10px] md:text-xs shadow-2xl">
             <button 
               onClick={() => setViewMode("streetview")}
               className={`px-4 py-1.5 md:py-2 transition-colors ${viewMode === "streetview" ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white hover:bg-neutral-900"}`}
             >
               STREETVIEW
             </button>
             <button 
               onClick={() => setViewMode("map")}
               className={`px-4 py-1.5 md:py-2 transition-colors ${viewMode === "map" ? "bg-white text-black font-bold" : "text-neutral-400 hover:text-white hover:bg-neutral-900"}`}
             >
               3D MAP
             </button>
           </div>

           {/* Fallbacks if no data */}
           {!selectedResult && (
             <div className="absolute inset-0 z-10 flex items-center justify-center text-neutral-700 pointer-events-none text-xs md:text-sm text-center px-4">
                AWAITING TARGET COORDINATES
             </div>
           )}

           {/* STREETVIEW RENDER */}
           {viewMode === "streetview" && selectedResult && (
             !process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? (
                <div className="p-4 text-red-500 z-10 absolute text-xs md:text-sm">ERROR: MISSING GOOGLE MAPS KEY</div>
             ) : (
                <iframe
                  className="absolute inset-0 w-full h-full border-0 invert-[0.1]"
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/streetview?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&pano=${formatPanoId(selectedResult.id)}`}
                />
             )
           )}

           {/* MAPBOX RENDER */}
           {viewMode === "map" && (
             <div className={`absolute inset-0 w-full h-full ${!selectedResult && 'opacity-20 grayscale'}`}>
               <Map
                 ref={mapRef}
                 mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                 initialViewState={{
                   longitude: selectedResult?.longitude || 0,
                   latitude: selectedResult?.latitude || 0,
                   zoom: selectedResult ? 18 : 1,
                   pitch: selectedResult ? 30 : 0,
                 }}
                 mapStyle="mapbox://styles/mapbox/standard"
                 terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
               >
                 <Source
                   id="mapbox-dem"
                   type="raster-dem"
                   url="mapbox://mapbox.mapbox-terrain-dem-v1"
                   tileSize={512}
                   maxzoom={14}
                 />

                 {apiResponse?.results.map((result) => (
                   <Marker
                     key={result.id}
                     longitude={result.longitude}
                     latitude={result.latitude}
                     onClick={(e) => {
                       e.originalEvent.stopPropagation();
                       setSelectedResult(result);
                     }}
                     className="cursor-pointer"
                   >
                     <div className={`transition-all duration-300 ${
                         selectedResult?.id === result.id 
                           ? 'w-4 h-4 bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-black z-40' 
                           : 'w-2 h-2 bg-red-600 border border-black opacity-60 hover:opacity-100 hover:scale-150'
                       } rounded-full`} 
                     />
                   </Marker>
                 ))}
               </Map>
             </div>
           )}
        </div>

        {/* RIGHT: CONTROL PANEL */}
        <div className="h-[55vh] md:h-auto w-full md:w-[320px] lg:w-[400px] flex flex-col shrink-0 bg-black">
          
          {/* UPLOAD & EXECUTE */}
          <div className="p-3 border-b border-neutral-800 shrink-0 flex flex-col gap-2 md:gap-3">
            <label className="relative border border-neutral-800 hover:border-neutral-500 transition-colors h-20 md:h-32 flex items-center justify-center cursor-pointer group bg-neutral-950">
              {previewUrl ? (
                <Image src={previewUrl} alt="Target" fill className="object-contain p-1" />
              ) : (
                <span className="text-neutral-600 group-hover:text-white transition-colors text-xs md:text-sm">UPLOAD_TARGET.JPG</span>
              )}
              <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageChange} />
            </label>

            <button 
              onClick={handleSubmit} 
              disabled={isLoading || !selectedImage}
              className="w-full bg-white text-black py-1.5 md:py-2 font-bold disabled:bg-neutral-800 disabled:text-neutral-500 hover:bg-neutral-200 transition-colors uppercase text-xs md:text-sm"
            >
              Locate
            </button>

            {errorMsg && <div className="text-red-500 text-xs">{errorMsg}</div>}
          </div>

          {/* RESULTS LIST */}
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {!apiResponse ? (
              <div className="text-neutral-700 text-xs p-1 text-center md:text-left">NO DATA</div>
            ) : (
              <div className="flex flex-col gap-1">
                {apiResponse.results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className={`w-full text-left flex justify-between px-2 py-2 md:py-1.5 transition-colors text-xs
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