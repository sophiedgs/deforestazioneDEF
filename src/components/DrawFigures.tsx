import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { Feature } from "geojson";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import type { PMCreateEvent, GeoJsonLayer, DrawFiguresProps} from "./Utils";


function DrawFigures({ onShapeCreated }: DrawFiguresProps) {
  const map = useMap();
  const drawnLayerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!map) return;

    map.pm.setPathOptions({
      color: "#9600ff",
      fillColor: "#9600ff",
      fillOpacity: 0.3,
      weight: 2,
    });

    map.pm.addControls({
      position: "topleft",
      drawPolygon: true,
      drawRectangle: true,
      drawCircle: true,
      drawCircleMarker: false,
      drawPolyline: false,
      drawMarker: false,
      editMode: false,
      dragMode: false,
      removalMode: true,
      cutPolygon: false,
      drawText: false,
      rotateMode: false,
    });

    map.pm.setGlobalOptions({
      allowSelfIntersection: false,
    });

    function circleToPolygon(layer: L.Circle, steps = 96): Feature {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      const coords: [number, number][] = [];
      const earthRadius = 6378137;

      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;

        const lat1 = (center.lat * Math.PI) / 180;
        const lng1 = (center.lng * Math.PI) / 180;

        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(radius / earthRadius) +
            Math.cos(lat1) * Math.sin(radius / earthRadius) * Math.cos(angle)
        );

        const lng2 = lng1 + Math.atan2(
           Math.sin(angle) * Math.sin(radius / earthRadius) * Math.cos(lat1),
            Math.cos(radius / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
          );

        coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
      }

      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [coords],
        },
        properties: {
          shapeType: "Circle",
          radius,
        },
      };
    }

    

    const handleCreate = (e: PMCreateEvent) => {
      const { layer, shape } = e;

      if (drawnLayerRef.current) {
        drawnLayerRef.current.remove();
      }

      drawnLayerRef.current = layer;

      let feature: Feature;

      if (shape === "Circle" && layer instanceof L.Circle) {
        feature = circleToPolygon(layer);
      } else {
        const data = (layer as GeoJsonLayer).toGeoJSON();

        feature = {
          ...data,
          properties: {
            ...data.properties,
            shapeType: shape,
          },
        };
      }

      console.log("Dati della forma:", feature);

      onShapeCreated(feature, layer);
    };

    map.on("pm:create", handleCreate);

    return () => {
      if (drawnLayerRef.current) {
        drawnLayerRef.current.remove();
        drawnLayerRef.current = null;
      }

      map.pm.removeControls();
      map.off("pm:create", handleCreate);
    };
  }, [map, onShapeCreated]);

  return null;
}

export default DrawFigures;