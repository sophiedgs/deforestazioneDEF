import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";
import type { BoundsPayload } from "./Utils";

interface MapBoundsLoaderProps {
  onChange: (bounds: BoundsPayload) => void;
}

function MapBoundsLoader({ onChange }: MapBoundsLoaderProps) {
  const map = useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();
      onChange({ minLng: bounds.getWest(), minLat: bounds.getSouth(),
         maxLng: bounds.getEast(), maxLat: bounds.getNorth(), zoom: map.getZoom(), });
    },

    zoomend: () => {
      const bounds = map.getBounds();
      onChange({ minLng: bounds.getWest(), minLat: bounds.getSouth(),
        maxLng: bounds.getEast(), maxLat: bounds.getNorth(), zoom: map.getZoom(),
      });
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    onChange({ minLng: bounds.getWest(), minLat: bounds.getSouth(),
      maxLng: bounds.getEast(), maxLat: bounds.getNorth(), zoom: map.getZoom(),
    });
  }, [map, onChange]);

  return null;
}

export default MapBoundsLoader;