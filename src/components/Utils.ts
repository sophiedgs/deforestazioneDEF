import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";





export type ItaliaMapProps = {
  ricercaMappa: RicercaMappa | null;
  ricercaParticella: RicercaParticella | null;
  resetMappaCount: number;
  resetParticellaCount: number;
  menuRicercaVisibile: boolean;
  onChiudiMenuRicerca?: () => void;
  onApriMenuRicerca?: () => void;
};


export type ProvinciaItem = {
  provincia: string;
  sigla_provincia: string;
};

export type ComuneItem = {
  comune: string;
  provincia: string;
  sigla_provincia: string;
};

export type CatastoMenuProps = {
  onSearchMappa?: (payload: RicercaMappa) => void;
  onSearchParticella?: (payload: RicercaParticella) => void;
  onResetMappa?: () => void;
  onResetParticella?: () => void;
};



export type DrawFiguresProps = {
  onShapeCreated: (geojson: Feature, layer: L.Layer) => void;
};

export type GeoJsonLayer = L.Layer & {
      toGeoJSON: () => Feature;
    };

export type PMCreateEvent = {
      layer: L.Layer;
      shape: string;
    };

export type RicercaMappa = {
  provincia: string;
  comune: string;
  identificatore: string;
};

export type RicercaParticella = {
  provincia: string;
  comune: string;
  particella: string;
};
export interface GeoJsonProprieta {
  [x: string]: any;
  nome?: string;
  regione?: string;
  id?: number;
  label?: string;
}

export interface GeoJsonData extends FeatureCollection<Geometry> {
  features: Array<{
    type: "Feature";
    geometry: Geometry;
    properties: GeoJsonProprieta;
  }>;
}

// longitudine latitudine zoom per la visualizzazione delle particelle del catasto
export type BoundsPayload = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
};

// posizione iniziale della mappa
export const position: [number, number] = [45.65, 11.85];

// stile confini Veneto
export const venetoStyle = {
  color: "#1d4ed8",
  weight: 4,
  fill: false,
  opacity: 1,
};

// stile dati mappa catastale
export const mappaStyle = {
  color: "#dc269c",
  weight: 1,
  fillColor: "#f78aea",
  fillOpacity: 0.15,
  opacity: 1,
};

// stile dati particelle catastale
export const particelleStyle = {
  color: "#16a34a",
  weight: 1,
  fillColor: "#22c55e",
  fillOpacity: 0.2,
  opacity: 0.9,
};

export const evidenziaMappaStyle: L.PathOptions = {
  color: "#d81b60",
  weight: 1,
  fillColor: "#f06292",
  fillOpacity: 0.4,
};

export const evidenziaParticellaStyle: L.PathOptions = {
  color: "#1b5e20",
  weight: 1,
  fillColor: "#2e7d32",
  fillOpacity: 0.35,
};

export function buildParams(bounds: BoundsPayload): URLSearchParams {
  return new URLSearchParams({
    minLng: String(bounds.minLng), minLat: String(bounds.minLat),
    maxLng: String(bounds.maxLng), maxLat: String(bounds.maxLat),
    zoom: String(bounds.zoom),
  });
}


