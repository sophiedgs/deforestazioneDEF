import {MapContainer,TileLayer,WMSTileLayer,GeoJSON,LayersControl,LayerGroup,} from "react-leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { Feature } from "geojson";
import "leaflet/dist/leaflet.css";
import "../styles/veneto.css";
import DrawFigures from "./DrawFigures";
import MapBoundsLoader from "./ZoomControl";

import type { GeoJsonData, BoundsPayload } from "./Utils";
import {position, venetoStyle, mappaStyle, particelleStyle, buildParams,} from "./Utils";
import type { RicercaMappa, RicercaParticella } from "../pages/Home";

type ItaliaMapProps = {
  ricercaMappa: RicercaMappa | null;
  ricercaParticella: RicercaParticella | null;
  resetMappaCount: number;
  resetParticellaCount: number;
  menuRicercaVisibile: boolean;
  onChiudiMenuRicerca?: () => void;
  onApriMenuRicerca?: () => void;
};

function ItaliaMap({ricercaMappa, ricercaParticella, resetMappaCount, resetParticellaCount, menuRicercaVisibile,
  onChiudiMenuRicerca, onApriMenuRicerca,}: Readonly<ItaliaMapProps>) {
  const [datiVeneto, setDatiVeneto] = useState<GeoJsonData | null>(null);
  const [mappeVeneto, setMappeVeneto] = useState<GeoJsonData | null>(null);
  const [particelleVeneto, setParticelleVeneto] = useState<GeoJsonData | null>(null);
  const [featureMappaRicercata, setFeatureMappaRicercata] = useState<GeoJsonData | null>(null);
  const [featureParticellaRicercata, setFeatureParticellaRicercata] = useState<GeoJsonData | null>(null);
  const [particelleDisegno, setParticelleDisegno] = useState<GeoJsonData | null>(null);
  const [puntiParticella, setPuntiParticella] = useState<GeoJsonData | null>(null);

  const [selezioneMappa, setSelezioneMappa] = useState<{
    origine: "mappa" | "particella" | "poligono";
    tipo: "provincia" | "comune" | "particella" | "mappa" | "poligono";
    dati: Record<string, unknown>;
  } | null>(null);

  const [mostraDettagliParticella, setMostraDettagliParticella] = useState(false);
  const [puntoSelezionato, setPuntoSelezionato] = useState<Record<string, unknown> | null>(null);
  const [rilevazioniPunto, setRilevazioniPunto] = useState<Array<Record<string, unknown>>>([]);

  const [indiceFotoGalleria, setIndiceFotoGalleria] = useState(0);

  const immaginiPunti = import.meta.glob("../images/punti/*.{jpg,jpeg,png}", {
    eager: true,
    query: "?url",
    import: "default",
  }) as Record<string, string>;

  const normalizzaNomeFile = (path: unknown) => {
    return String(path ?? "").split("/").pop() ?? "";
  };

  const getImageSrc = (path: unknown) => {
    const nomeFile = normalizzaNomeFile(path);
    const match = Object.entries(immaginiPunti).find(([key]) => key.endsWith(`/${nomeFile}`));
    return match?.[1] ?? "";
  };

  const fotoGalleria = rilevazioniPunto.filter((r) => getImageSrc(r.image_path));
  const fotoCorrente = fotoGalleria[indiceFotoGalleria] ?? null;




  const [error, setError] = useState<string | null>(null);
  const [errorePoligono, setErrorePoligono] = useState<string | null>(null);
  const [layerPoligonoNonValido, setLayerPoligonoNonValido] = useState<L.Layer | null>(null);
  const [layerPoligonoDisegnato, setLayerPoligonoDisegnato] = useState<L.Layer | null>(null);
  const [, setPoligonoDisegnatoGeoJson] = useState<Feature | null>(null);

  const requestIdRef = useRef(0);
  const mapRef = useRef<L.Map | null>(null);
  const layerMappaSelezionatoRef = useRef<L.Path | null>(null);
  const layerParticellaSelezionatoRef = useRef<L.Path | null>(null);
  const venetoBoundsRef = useRef<L.LatLngBounds | null>(null);
  const ultimoResetMappaRef = useRef(resetMappaCount);
  const ultimoResetParticellaRef = useRef(resetParticellaCount);

  const evidenziaMappaStyle: L.PathOptions = {
    color: "#d81b60",
    weight: 1,
    fillColor: "#f06292",
    fillOpacity: 0.4,
  };

  const evidenziaParticellaStyle: L.PathOptions = {
    color: "#1b5e20",
    weight: 1,
    fillColor: "#2e7d32",
    fillOpacity: 0.35,
  };

  const resetDatiPunto = useCallback(() => {
    setMostraDettagliParticella(false);
    setPuntiParticella(null);
    setPuntoSelezionato(null);
    setRilevazioniPunto([]);
  }, []);

  useEffect(() => {
    const scaricaConfini = async () => {
      try {
        setError(null);
        const response = await fetch("http://localhost:3001/api/confini_veneto");
        if (!response.ok) throw new Error("Errore nel caricamento dei confini");

        const data: GeoJsonData = await response.json();
        setDatiVeneto(data);

        const layer = L.geoJSON(data);
        const bounds = layer.getBounds();
        if (bounds.isValid()) venetoBoundsRef.current = bounds;
      } catch (e) {
        console.error("Errore confini:", e);
        setError("Errore nel caricamento dei confini del Veneto");
      }
    };

    scaricaConfini();
  }, []);

  const aggiornaDatiMappa = useCallback(async (bounds: BoundsPayload) => {
    const currentRequestId = ++requestIdRef.current;
    const params = buildParams(bounds);

    try {
      const [loadMappe, loadParticelle] = await Promise.all([
        fetch(`http://localhost:3001/api/mappe_veneto_official?${params}`),
        fetch(`http://localhost:3001/api/particelle_veneto_official?${params}`),
      ]);

      if (!loadMappe.ok) throw new Error("Errore caricamento mappe catastali");
      if (!loadParticelle.ok) throw new Error("Errore caricamento particelle catastali");

      const datiMappe = await loadMappe.json();
      const datiParticelle = await loadParticelle.json();

      if (currentRequestId !== requestIdRef.current) return;

      setMappeVeneto(datiMappe);
      setParticelleVeneto(datiParticelle);
    } catch (e) {
      console.error("Errore aggiornamento mappa:", e);
    }
  }, []);

  const analizzaPoligono = useCallback(async (feature: Feature, layer: L.Layer) => {
    try {
      setErrorePoligono(null);
      setLayerPoligonoNonValido(null);
      resetDatiPunto();

      const response = await fetch("http://localhost:3001/api/analizza_poligono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geojson: feature }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          setLayerPoligonoNonValido(layer);
          setErrorePoligono(result.error || "Ridisegna il poligono entro i confini del Veneto.");
          return;
        }

        throw new Error(result.error || "Errore nell'analisi del poligono");
      }

      setPoligonoDisegnatoGeoJson(feature);
      setLayerPoligonoDisegnato(layer);

      if (result.particelleIntersecate) {
        setParticelleDisegno(result.particelleIntersecate);

        const features = result.particelleIntersecate.features ?? [];
        if (features.length > 0) {
          setSelezioneMappa({
            origine: "poligono",
            tipo: "poligono",
            dati: result.riepilogoPoligono,
          });
        }
      }
    } catch (err) {
      console.error("Errore analizzaPoligono:", err);
      setErrorePoligono(err instanceof Error ? err.message : "Errore nell'analisi del poligono.");
    }
  }, [resetDatiPunto]);

  const chiudiErrorePoligono = useCallback(() => {
    if (layerPoligonoNonValido) layerPoligonoNonValido.remove();
    setLayerPoligonoNonValido(null);
    setErrorePoligono(null);
  }, [layerPoligonoNonValido]);

  const evidenziaFeatureRicercata = useCallback(
    (geojson: GeoJsonData | null, tipo: "mappa" | "particella") => {
      if (!mapRef.current || !geojson?.features?.length) return;

      const feature: Feature = geojson.features[0];
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      }

      if (layerMappaSelezionatoRef.current) {
        layerMappaSelezionatoRef.current.setStyle(mappaStyle);
        layerMappaSelezionatoRef.current = null;
      }

      if (layerParticellaSelezionatoRef.current) {
        layerParticellaSelezionatoRef.current.setStyle(particelleStyle);
        layerParticellaSelezionatoRef.current = null;
      }

      if (tipo === "mappa") {
        setFeatureMappaRicercata(geojson);
      } else {
        setFeatureParticellaRicercata(geojson);
      }

      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const tipoRisultato =
        properties.tipo === "provincia" ||
        properties.tipo === "comune" ||
        properties.tipo === "mappa" ||
        properties.tipo === "particella"
          ? properties.tipo
          : tipo;

      setSelezioneMappa({
        origine: tipo,
        tipo: tipoRisultato,
        dati: properties,
      });

      resetDatiPunto();
    },
    [resetDatiPunto]
  );

  const resetSoloMappa = useCallback(() => {
    if (layerMappaSelezionatoRef.current) {
      layerMappaSelezionatoRef.current.setStyle(mappaStyle);
      layerMappaSelezionatoRef.current = null;
    }

    setFeatureMappaRicercata(null);

    setSelezioneMappa((prev) => {
      if (prev?.origine === "mappa") return null;
      return prev;
    });

    if (!featureParticellaRicercata && mapRef.current && venetoBoundsRef.current) {
      mapRef.current.fitBounds(venetoBoundsRef.current, { padding: [20, 20] });
    }
  }, [featureParticellaRicercata]);

  const resetSoloParticella = useCallback(() => {
    if (layerParticellaSelezionatoRef.current) {
      layerParticellaSelezionatoRef.current.setStyle(particelleStyle);
      layerParticellaSelezionatoRef.current = null;
    }

    setFeatureParticellaRicercata(null);
    setPoligonoDisegnatoGeoJson(null);
    resetDatiPunto();

    setSelezioneMappa((prev) => {
      if (prev?.origine === "particella") return null;
      return prev;
    });

    if (!featureMappaRicercata && mapRef.current && venetoBoundsRef.current) {
      mapRef.current.fitBounds(venetoBoundsRef.current, { padding: [20, 20] });
    }
  }, [featureMappaRicercata, resetDatiPunto]);

  useEffect(() => {
    if (resetMappaCount === ultimoResetMappaRef.current) return;
    ultimoResetMappaRef.current = resetMappaCount;
    resetSoloMappa();
  }, [resetMappaCount, resetSoloMappa]);

  useEffect(() => {
    if (resetParticellaCount === ultimoResetParticellaRef.current) return;
    ultimoResetParticellaRef.current = resetParticellaCount;
    resetSoloParticella();
  }, [resetParticellaCount, resetSoloParticella]);

  useEffect(() => {
    if (!ricercaMappa) return;

    const cercaMappa = async () => {
      const params = new URLSearchParams();
      if (ricercaMappa.provincia) params.append("provincia", ricercaMappa.provincia);
      if (ricercaMappa.comune) params.append("comune", ricercaMappa.comune);
      if (ricercaMappa.identificatore) params.append("identificatore", ricercaMappa.identificatore);

      const response = await fetch(`http://localhost:3001/api/ricerca_mappa?${params.toString()}`);
      if (!response.ok) return;

      const data: GeoJsonData = await response.json();
      evidenziaFeatureRicercata(data, "mappa");
    };

    cercaMappa();
  }, [ricercaMappa, evidenziaFeatureRicercata]);

  useEffect(() => {
    if (!ricercaParticella) return;

    const cercaParticella = async () => {
      const params = new URLSearchParams();
      if (ricercaParticella.provincia) params.append("provincia", ricercaParticella.provincia);
      if (ricercaParticella.comune) params.append("comune", ricercaParticella.comune);
      if (ricercaParticella.particella) params.append("particella", ricercaParticella.particella);

      const response = await fetch(`http://localhost:3001/api/ricerca_particella?${params.toString()}`);
      if (!response.ok) return;

      const data: GeoJsonData = await response.json();
      evidenziaFeatureRicercata(data, "particella");
    };

    cercaParticella();
  }, [ricercaParticella, evidenziaFeatureRicercata]);

  const selezionaParticellaDaPopup = useCallback(async (p: Record<string, unknown>) => {
    const params = new URLSearchParams();
    params.append("provincia", String(p.provincia ?? ""));
    params.append("comune", String(p.comune ?? ""));
    params.append("particella", String(p.nome_particella ?? ""));

    const response = await fetch(`http://localhost:3001/api/ricerca_particella?${params.toString()}`);
    if (!response.ok) return;

    const data: GeoJsonData = await response.json();
    evidenziaFeatureRicercata(data, "particella");
  }, [evidenziaFeatureRicercata]);



const caricaDatiParticella = useCallback(async () => {
  const particellaId =
    selezioneMappa?.dati.id ??
    selezioneMappa?.dati.id_db ??
    selezioneMappa?.dati.particella_id;

  if (!particellaId) {
    console.warn("ID particella mancante", selezioneMappa);
    return;
  }

  setMostraDettagliParticella(true);
  setPuntoSelezionato(null);
  setRilevazioniPunto([]);
  setPuntiParticella(null);
  onChiudiMenuRicerca?.();

  try {
    const response = await fetch(
      `http://localhost:3001/api/dati_particella/${encodeURIComponent(String(particellaId))}`
    );

    console.log("response dati particella:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("Errore backend:", text);
      return;
    }

    const data: GeoJsonData = await response.json();
    console.log("punti ricevuti:", data);

    setPuntiParticella(data);
  } catch (err) {
    console.error("Errore caricaDatiParticella:", err);
  }
}, [selezioneMappa, onChiudiMenuRicerca]);


 const selezionaPunto = useCallback(async (punto: Record<string, unknown>) => {
    const puntoId = punto.punto_id;
    if (!puntoId) return;

    const response = await fetch(
      `http://localhost:3001/api/rilevazioni_punto/${encodeURIComponent(String(puntoId))}`
    );

    if (!response.ok) return;

    const data = await response.json();

    setPuntoSelezionato(punto);
    setRilevazioniPunto(data);
    setIndiceFotoGalleria(0);
    onChiudiMenuRicerca?.();
  }, [onChiudiMenuRicerca]);

  const puntiDaMostrare =
    puntoSelezionato && puntiParticella
      ? {
          ...puntiParticella,
          features: puntiParticella.features.filter(
            (f) => f.properties?.punto_id === puntoSelezionato.punto_id
          ),
        }
      : puntiParticella;

  return (
    <div className="mappaContenitore">
      <h2>Mappa del Veneto, Italia</h2>

      {errorePoligono && (
        <div className="banner-errore-poligono">
          <div className="banner-errore-contenuto">
            <span>{errorePoligono}</span>
            <div className="banner-errore-azioni">
              <button type="button" onClick={chiudiErrorePoligono} className="banner-ok-btn">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`layout-mappa-dettagli ${ selezioneMappa ? "layout-con-dettagli" : "layout-senza-dettagli"
        } ${menuRicercaVisibile ? "" : "layout-dettagli-esteso"}`}
      >
        <div className="contenitore-mappa">
          {!error && (
            <MapContainer
              center={position}
              zoom={8}
              scrollWheelZoom={true}
              style={{ height: "700px", width: "100%" }}
              ref={mapRef}
            >
              <DrawFigures onShapeCreated={analizzaPoligono} />
              <MapBoundsLoader onChange={aggiornaDatiMappa} />

              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Mappa Stradale">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap contributors"
                  />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="Mappa Satellitare">
                  <WMSTileLayer
                    url="https://idt2-geoserver.regione.veneto.it/geoserver/ows"
                    params={{
                      layers: "rv:ortofoto_agea_2024",
                      format: "image/png",
                      transparent: true,
                      version: "1.3.0",
                    }}
                    attribution="&copy; Regione del Veneto"
                  />
                </LayersControl.BaseLayer>

                <LayersControl.Overlay checked name="Confini Veneto">
                  <LayerGroup>
                    {datiVeneto && (
                      <GeoJSON
                        key={`veneto-${datiVeneto.features.length}`}
                        data={datiVeneto}
                        style={venetoStyle}
                      />
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>

                <LayersControl.Overlay checked name="Mappe Veneto">
                  <LayerGroup>
                    {mappeVeneto && mappeVeneto.features.length > 0 && (
                      <GeoJSON
                        key={`mappe-${mappeVeneto.features.length}`}
                        data={mappeVeneto}
                        style={mappaStyle}
                        onEachFeature={(feature, layer) => {
                          layer.on("click", () => {
                            const pathLayer = layer as L.Path;

                            if (layerParticellaSelezionatoRef.current) {
                              layerParticellaSelezionatoRef.current.setStyle(particelleStyle);
                              layerParticellaSelezionatoRef.current = null;
                            }

                            if (layerMappaSelezionatoRef.current) {
                              layerMappaSelezionatoRef.current.setStyle(mappaStyle);
                            }

                            pathLayer.setStyle(evidenziaMappaStyle);
                            layerMappaSelezionatoRef.current = pathLayer;

                            resetDatiPunto();

                            setSelezioneMappa({
                              origine: "mappa",
                              tipo: "mappa",
                              dati: (feature.properties ?? {}) as Record<string, unknown>,
                            });
                          });
                        }}
                      />
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>

                <LayersControl.Overlay checked name="Particelle Veneto">
                  <LayerGroup>
                    {particelleVeneto && particelleVeneto.features.length > 0 && (
                      <GeoJSON
                        key={`particelle-${particelleVeneto.features.length}`}
                        data={particelleVeneto}
                        style={particelleStyle}
                        onEachFeature={(feature, layer) => {
                          layer.on("click", () => {
                            const pathLayer = layer as L.Path;

                            if (layerMappaSelezionatoRef.current) {
                              layerMappaSelezionatoRef.current.setStyle(mappaStyle);
                              layerMappaSelezionatoRef.current = null;
                            }

                            if (layerParticellaSelezionatoRef.current) {
                              layerParticellaSelezionatoRef.current.setStyle(particelleStyle);
                            }

                            pathLayer.setStyle(evidenziaParticellaStyle);
                            layerParticellaSelezionatoRef.current = pathLayer;

                            resetDatiPunto();

                            setSelezioneMappa({
                              origine: "particella",
                              tipo: "particella",
                              dati: (feature.properties ?? {}) as Record<string, unknown>,
                            });
                          });
                        }}
                      />
                    )}
                  </LayerGroup>
                </LayersControl.Overlay>

                {particelleDisegno && particelleDisegno.features.length > 0 && (
                  <GeoJSON
                    key={`particelle-disegno-${JSON.stringify(
                      particelleDisegno.features.map((f) => f.properties?.id)
                    )}`}
                    data={particelleDisegno}
                    style={evidenziaParticellaStyle}
                    onEachFeature={(feature, layer) => {
                      layer.on("click", () => {
                        resetDatiPunto();

                        setSelezioneMappa({
                          origine: "particella",
                          tipo: "particella",
                          dati: (feature.properties ?? {}) as Record<string, unknown>,
                        });
                      });
                    }}
                  />
                )}

                {featureMappaRicercata && (
                  <GeoJSON
                    key={`feature-mappa-${JSON.stringify(featureMappaRicercata.features[0]?.properties ?? {})}`}
                    data={featureMappaRicercata}
                    style={evidenziaMappaStyle}
                  />
                )}

                {featureParticellaRicercata && (
                  <GeoJSON
                    key={`feature-particella-${JSON.stringify(featureParticellaRicercata.features[0]?.properties ?? {})}`}
                    data={featureParticellaRicercata}
                    style={evidenziaParticellaStyle}
                  />
                )}

                {puntiDaMostrare && puntiDaMostrare.features.length > 0 && (
                  <GeoJSON
                    key={`punti-particella-${JSON.stringify(
                      puntiParticella?.features.map((f) => f.properties?.punto_id) ?? []
                    )}-selected-${puntoSelezionato?.punto_id ?? "none"}`}
                    data={puntiDaMostrare}
                    pointToLayer={(feature, latlng) => {
                      const puntoId = feature.properties?.punto_id;
                      const isSelezionato = puntoSelezionato?.punto_id === puntoId;

                      return L.circleMarker(latlng, {
                        radius: isSelezionato ? 8 : 6,
                        weight: 1,
                        color: isSelezionato ? "#b71c1c" : "#1565c0",
                        fillColor: isSelezionato ? "#e53935" : "#1e88e5",
                        fillOpacity: 0.9,
                      });
                    }}
                    onEachFeature={(feature, layer) => {
                      layer.on("click", () => {
                        const props = (feature.properties ?? {}) as Record<string, unknown>;
                        selezionaPunto(props);
                      });
                    }}
                  />
                )}
              </LayersControl>
            </MapContainer>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        {selezioneMappa && (
          <div className="pannello-dettagli-destro">
            <button
              type="button"
              onClick={() => {
                if (layerMappaSelezionatoRef.current) {
                  layerMappaSelezionatoRef.current.setStyle(mappaStyle);
                  layerMappaSelezionatoRef.current = null;
                }

                if (layerParticellaSelezionatoRef.current) {
                  layerParticellaSelezionatoRef.current.setStyle(particelleStyle);
                  layerParticellaSelezionatoRef.current = null;
                }

                if (layerPoligonoDisegnato) {
                  layerPoligonoDisegnato.remove();
                  setLayerPoligonoDisegnato(null);
                }

                setParticelleDisegno(null);
                setFeatureMappaRicercata(null);
                setFeatureParticellaRicercata(null);
                setSelezioneMappa(null);
                resetDatiPunto();
                onApriMenuRicerca?.();
              }}
              className="chiudi-pannello-btn"
            >
              ×
            </button>

            {selezioneMappa.tipo === "provincia" && (
              <div>
                <h3>Dati provincia</h3>
                <p>
                  <strong>Provincia:</strong>{" "}
                  {String(selezioneMappa.dati.provincia ?? "")} (
                  {String(selezioneMappa.dati.sigla_provincia ?? "")})
                </p>
              </div>
            )}

            {selezioneMappa.tipo === "comune" && (
              <div>
                <h3>Dati comune</h3>
                <p><strong>Comune:</strong> {String(selezioneMappa.dati.comune ?? "")}</p>
                <p>
                  <strong>Provincia:</strong>{" "}
                  {String(selezioneMappa.dati.provincia ?? "")} (
                  {String(selezioneMappa.dati.sigla_provincia ?? "")})
                </p>
              </div>
            )}

            {selezioneMappa.tipo === "particella" && (
              <div>
                <h3>Dati particella</h3>

                <p><strong>ID particella:</strong> {String(selezioneMappa.dati.id ?? "")}</p>
                <p><strong>Nome particella:</strong> {String(selezioneMappa.dati.label ?? "")}</p>
                <p><strong>Identificatore mappa:</strong> {String(selezioneMappa.dati.nome_mappa ?? "")}</p>
                <p><strong>Comune:</strong> {String(selezioneMappa.dati.comune ?? "")}</p>
                <p>
                  <strong>Provincia:</strong>{" "}
                  {String(selezioneMappa.dati.provincia ?? "")} (
                  {String(selezioneMappa.dati.sigla_provincia ?? "")})
                </p>
                <p><strong>Codice catastale:</strong> {String(selezioneMappa.dati.codice_catastale ?? "")}</p>

                {typeof selezioneMappa.dati.numero_particelle_intersecate === "number" && (
                  <p>
                    <strong>Particelle intersecate:</strong>{" "}
                    {String(selezioneMappa.dati.numero_particelle_intersecate)}
                  </p>
                )}

                {!mostraDettagliParticella && (
                  <button
                    type="button"
                    className="cercaCancella_selezione"
                    onClick={caricaDatiParticella}
                  >
                    Visualizza dati
                  </button>
                )}

                {mostraDettagliParticella && (
                  <div className="pannello-dettagli-particella">
                    <h3>Dettagli particella</h3>

                    {!puntoSelezionato && (
                      <>
                        <button
                          type="button"
                          className="cercaCancella_selezione"
                          onClick={() => {
                            resetDatiPunto();
                            onApriMenuRicerca?.();
                            setPuntoSelezionato(null);
                            setRilevazioniPunto([]);
                            setIndiceFotoGalleria(0);
                          }}
                        >
                          Indietro
                        </button>

                        <p><strong>Punti generati:</strong> {puntiParticella?.features.length ?? 0}</p>

                        <div className="elenco-particelle-orizzontale">
                          {puntiParticella?.features.map((feature, index) => {
                            const props = (feature.properties ?? {}) as Record<string, unknown>;

                            return (
                              <button
                                key={`${String(props.punto_id)}-${index}`}
                                type="button"
                                className="badge-particella badge-particella-btn"
                                onClick={() => selezionaPunto(props)}
                              >
                                {String(props.punto_id)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {puntoSelezionato && (
                      <div className="pannello-rilevazioni-punto">
                        <button
                          type="button"
                          className="cercaCancella_selezione"
                          onClick={() => {
                            setPuntoSelezionato(null);
                            setRilevazioniPunto([]);
                            setIndiceFotoGalleria(0);
                          }}
                        >
                          Indietro
                        </button>

                        <div className="testata-punto-galleria">
                          <h4>Punto {String(puntoSelezionato.punto_id)}</h4>

                          <div className="galleria-punto">
                            {fotoCorrente ? (
                              <>
                                <img
                                  src={getImageSrc(fotoCorrente.image_path)}
                                  alt={`Foto punto ${String(puntoSelezionato.punto_id)}`}
                                  className="galleria-punto-img"
                                />

                                <div className="galleria-timestamp">
                                  {String(fotoCorrente.rilevato_at)}
                                </div>

                                <div className="galleria-controlli">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setIndiceFotoGalleria((prev) =>
                                        prev === 0 ? fotoGalleria.length - 1 : prev - 1
                                      )
                                    }
                                    disabled={fotoGalleria.length <= 1}
                                  >
                                    ‹
                                  </button>

                                  <span>
                                    {indiceFotoGalleria + 1}/{fotoGalleria.length}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setIndiceFotoGalleria((prev) =>
                                        prev === fotoGalleria.length - 1 ? 0 : prev + 1
                                      )
                                    }
                                    disabled={fotoGalleria.length <= 1}
                                  >
                                    ›
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="galleria-vuota">Nessuna foto</div>
                            )}
                          </div>
                        </div>

                        {rilevazioniPunto.map((r, index) => (
                          <div key={String(r.rilevazione_id)} className="rilevazione-card">
                            <p><strong>Timestamp:</strong> {String(r.rilevato_at)}</p>
                            <p><strong>Temperatura:</strong> {String(r.temperatura)} °C</p>
                            <p>
                              <strong>Immagine:</strong>{" "}
                              <button
                                type="button"
                                className="link-visualizza-foto"
                                onClick={() => setIndiceFotoGalleria(index)}
                              >
                                visualizza foto
                              </button>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* {puntoSelezionato && (
                      <div className="pannello-rilevazioni-punto">
                        <button
                          type="button"
                          className="cercaCancella_selezione"
                          onClick={() => {
                            setPuntoSelezionato(null);
                            setRilevazioniPunto([]);
                          }}
                        >
                          Indietro
                        </button>

                        <h4>Punto {String(puntoSelezionato.punto_id)}</h4>

                        {rilevazioniPunto.map((r) => (
                          <div key={String(r.rilevazione_id)} className="rilevazione-card">
                            <p><strong>Timestamp:</strong> {String(r.rilevato_at)}</p>
                            <p><strong>Temperatura:</strong> {String(r.temperatura)} °C</p>
                            <p><strong>Immagine:</strong> {String(r.image_path)}</p>
                          </div>
                        ))}
                      </div>
                    )} */}
                  </div>
                )}
              </div>
            )}

            {selezioneMappa.tipo === "poligono" && (
              <div>
                <h3>Dati poligono disegnato</h3>

                <p><strong>Comune:</strong> {String(selezioneMappa.dati.comune ?? "N/D")}</p>
                <p><strong>Provincia:</strong> {String(selezioneMappa.dati.provincia ?? "N/D")}</p>
                <p><strong>Area:</strong> {String(selezioneMappa.dati.area_poligono_mq ?? "N/D")} m²</p>
                <p>
                  <strong>N° particelle intersecate:</strong>{" "}
                  {String(selezioneMappa.dati.numero_particelle_intersecate ?? 0)}
                </p>

                {Array.isArray(selezioneMappa.dati.elenco_particelle) && (
                  <div>
                    <div className="elenco-particelle-orizzontale">
                      {(selezioneMappa.dati.elenco_particelle as Array<Record<string, unknown>>)
                        .slice(0, 80)
                        .map((p, index) => (
                          <button
                            key={`${String(p.nome_mappa)}-${String(p.nome_particella)}-${index}`}
                            type="button"
                            className="badge-particella badge-particella-btn"
                            onClick={() => selezionaParticellaDaPopup(p)}
                          >
                            {String(p.nome_particella ?? "N/D")}
                          </button>
                        ))}
                    </div>

                    {Number(selezioneMappa.dati.numero_particelle_intersecate ?? 0) > 100 && (
                      <p className="testo-muted">Mostrate le prime 100 particelle.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {selezioneMappa.tipo === "mappa" && (
              <div>
                <h3>Dati mappa</h3>
                <p><strong>Nome livello:</strong> {String(selezioneMappa.dati.nome_livello ?? "")}</p>
                <p>
                  <strong>Provincia:</strong>{" "}
                  {String(selezioneMappa.dati.provincia ?? "")} (
                  {String(selezioneMappa.dati.sigla_provincia ?? "")})
                </p>
                <p><strong>Comune:</strong> {String(selezioneMappa.dati.comune ?? "")}</p>
                <p><strong>Codice catastale:</strong> {String(selezioneMappa.dati.codice_catastale ?? "")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ItaliaMap;