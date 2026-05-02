import { useEffect, useMemo, useState } from "react";
import "../styles/veneto.css";
import "../styles/home.css";

import type { ProvinciaItem, ComuneItem, CatastoMenuProps, } from "./Utils";


function CatastoMenu({ onSearchMappa, onSearchParticella, onResetMappa, onResetParticella,}: Readonly<CatastoMenuProps>) {
  const [provinceMappe, setProvinceMappe] = useState<ProvinciaItem[]>([]);
  const [provinceParticelle, setProvinceParticelle] = useState<ProvinciaItem[]>([]);

  const [comuniMappe, setComuniMappe] = useState<ComuneItem[]>([]);
  const [comuniParticelle, setComuniParticelle] = useState<ComuneItem[]>([]);

  const [provinciaMappa, setProvinciaMappa] = useState("");
  const [comuneMappa, setComuneMappa] = useState("");
  const [identificatoreMappa, setIdentificatoreMappa] = useState("");

  const [provinciaParticella, setProvinciaParticella] = useState("");
  const [comuneParticella, setComuneParticella] = useState("");
  const [particella, setParticella] = useState("");

  const [showProvinceMappe, setShowProvinceMappe] = useState(false);
  const [showComuniMappe, setShowComuniMappe] = useState(false);
  const [showProvinceParticelle, setShowProvinceParticelle] = useState(false);
  const [showComuniParticelle, setShowComuniParticelle] = useState(false);
  
const [identificatoriMappeFiltrati, setIdentificatoriMappeFiltrati] = useState<
  { codice_catastale: string; comune?: string; provincia?: string; sigla_provincia?: string }[]
>([]);

const [identificatoriParticelleFiltrati, setIdentificatoriParticelleFiltrati] = useState<
  { nome_particella: string; comune?: string; provincia?: string; sigla_provincia?: string }[]
>([]);


  useEffect(() => {
    const caricaProvince = async () => {
      try {
        const [mappe, particelle] = await Promise.all([
          fetch("http://localhost:3001/api/province_mappe_veneto"),
          fetch("http://localhost:3001/api/province_particelle_veneto"),
        ]);

        if (!mappe.ok || !particelle.ok) {
          throw new Error("Errore nel caricamento delle province");
        }

        const jsonMappe: ProvinciaItem[] = await mappe.json();
        const jsonParticelle: ProvinciaItem[] = await particelle.json();

        setProvinceMappe(jsonMappe);
        setProvinceParticelle(jsonParticelle);
      } catch (error) {
        console.error("Errore province:", error);
      }
    };

    caricaProvince();
  }, []);

  useEffect(() => {
    const caricaComuniMappe = async () => {
      if (!provinciaMappa.trim()) {
        setComuniMappe([]);
        setComuneMappa("");
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/api/comuni_mappe_veneto?provincia=${encodeURIComponent(provinciaMappa)}` );
        if (!response.ok) { throw new Error("Errore nel caricamento dei comuni mappe"); }

        const data: ComuneItem[] = await response.json();
        setComuniMappe(data);
      } catch (error) {
        console.error("Errore comuni mappe:", error);
      }
    };

    caricaComuniMappe();
  }, [provinciaMappa]);

  useEffect(() => {
    const caricaComuniParticelle = async () => {
      if (!provinciaParticella.trim()) {
        setComuniParticelle([]);
        setComuneParticella("");
        return;
      }

      try {
        const response = await fetch(`http://localhost:3001/api/comuni_particelle_veneto?provincia=${encodeURIComponent(provinciaParticella)}`);

        if (!response.ok) { throw new Error("Errore nel caricamento dei comuni particelle"); }

        const data: ComuneItem[] = await response.json();
        setComuniParticelle(data);
      } catch (error) {
        console.error("Errore comuni particelle:", error);
      }
    };

    caricaComuniParticelle();
  }, [provinciaParticella]);


useEffect(() => {
  const fetchIdentificatori = async () => {
    try {
      const params = new URLSearchParams();

      if (provinciaMappa.trim()) params.append("provincia", provinciaMappa);
      if (comuneMappa.trim()) params.append("comune", comuneMappa);

      const res = await fetch(`http://localhost:3001/api/identificatori_mappe_veneto?${params.toString()}`);

      if (!res.ok) return;

      const data = await res.json();
      setIdentificatoriMappeFiltrati(data);
    } catch (err) {
      console.error("Errore identificatori:", err);
    }
  };

  fetchIdentificatori();
}, [provinciaMappa, comuneMappa]);



useEffect(() => {
  const fetchIdentificatoriParticelle = async () => {
    try {
      const params = new URLSearchParams();

      if (provinciaParticella.trim()) {
        params.append("provincia", provinciaParticella);
      }

      if (comuneParticella.trim()) {
        params.append("comune", comuneParticella);
      }

      const res = await fetch(`http://localhost:3001/api/identificatori_particelle_veneto?${params.toString()}`);

      if (!res.ok) return;

      const data = await res.json();
      setIdentificatoriParticelleFiltrati(data);
    } catch (err) {
      console.error("Errore identificatori particelle:", err);
    }
  };

  fetchIdentificatoriParticelle();
}, [provinciaParticella, comuneParticella]);


  const provinceMappeFiltrate = useMemo(() => {
    return provinceMappe.filter(
      (item) => item.provincia && item.provincia.toLowerCase().includes(provinciaMappa.toLowerCase())
    );
  }, [provinceMappe, provinciaMappa]);

  const provinceParticelleFiltrate = useMemo(() => {
    return provinceParticelle.filter(
      (item) => item.provincia && item.provincia.toLowerCase().includes(provinciaParticella.toLowerCase())
    );
  }, [provinceParticelle, provinciaParticella]);


  const comuniMappeFiltrati = useMemo(() => {
    return comuniMappe.filter(
      (item) => item.comune && item.comune.toLowerCase().includes(comuneMappa.toLowerCase())
    );
  }, [comuniMappe, comuneMappa]);

  const comuniParticelleFiltrati = useMemo(() => {
    return comuniParticelle.filter(
      (item) => item.comune && item.comune.toLowerCase().includes(comuneParticella.toLowerCase())
    );
  }, [comuniParticelle, comuneParticella]);

  const handleCercaMappa = () => {
    onSearchMappa?.({
      provincia: provinciaMappa.trim(),
      comune: comuneMappa.trim(),
      identificatore: identificatoreMappa.trim(),
    });
  };

  const handleCercaParticella = () => {
    onSearchParticella?.({
      provincia: provinciaParticella.trim(),
      comune: comuneParticella.trim(),
      particella: particella.trim(),
    });
  };

  const handleResetMappa = () => {
    setProvinciaMappa("");
    setComuneMappa("");
    setIdentificatoreMappa("");
    setComuniMappe([]);
    setShowProvinceMappe(false);
    setShowComuniMappe(false);
    onResetMappa?.();
  };


  const handleResetParticella = () => {
    setProvinciaParticella("");
    setComuneParticella("");
    setParticella("");
    setComuniParticelle([]);
    setShowProvinceParticelle(false);
    setShowComuniParticelle(false);
    onResetParticella?.();
  };

  return (
    <nav className="sideMenu" aria-label="Ricerca catastale">
      <section className="menuSection">
        <h2 className="menuSectionTitle">Ricerca mappe catastali</h2>

        <label className="menuLabel" htmlFor="provincia-mappa">
          Provincia
        </label>
        <div className="menuAutocomplete">
          <input id="provincia-mappa" className="menuInput" placeholder="Seleziona o scrivi una provincia"
            value={provinciaMappa}
            onChange={(e) => {
              setProvinciaMappa(e.target.value);
              setComuneMappa("");
              setShowProvinceMappe(true);
            }}
            onFocus={() => setShowProvinceMappe(true)}
          />
          {showProvinceMappe && provinceMappeFiltrate.length > 0 && (
            <div className="menuDropdown">
            {provinceMappeFiltrate?.map((item) => (
              <button key={item.provincia} type="button"className="menuDropdownItem"
                onMouseDown={() => {
                  setProvinciaMappa(item.provincia);
                  setComuneMappa("");
                  setShowProvinceMappe(false);
                }}
              >
                {item.provincia} ({item.sigla_provincia})
              </button>
            ))}
            </div>
          )}
        </div>

        <label className="menuLabel" htmlFor="comune-mappa">
          Comune
        </label>
        <div className="menuAutocomplete">
          <input id="comune-mappa" className="menuInput"
            placeholder={ provinciaMappa ? "Seleziona o scrivi un comune" : "Seleziona prima una provincia"}
            value={comuneMappa}
            onChange={(e) => {
              setComuneMappa(e.target.value);
              setShowComuniMappe(true);
            }}
            onFocus={() => {if (provinciaMappa.trim()) setShowComuniMappe(true); }}
            disabled={!provinciaMappa.trim()}
          />
          {showComuniMappe && comuniMappeFiltrati.length > 0 && (
            <div className="menuDropdown">
            {comuniMappeFiltrati?.map((item) => (
              <button  key={`${item.provincia}-${item.comune}`} type="button" className="menuDropdownItem"
                onMouseDown={() => {
                  setComuneMappa(item.comune);
                  setShowComuniMappe(false);
                }}
              >
                {item.comune}
              </button>
            ))}
            </div>
          )}
        </div>

        <label className="menuLabel" htmlFor="identificatore-mappa">
          Identificatore mappa
        </label>

        <input id="identificatore-mappa" className="menuInput" type="text"
          list="identificatori-mappa-list" value={identificatoreMappa}
          onChange={(e) => setIdentificatoreMappa(e.target.value)}
          placeholder="Seleziona o scrivi un identificatore" disabled={!provinciaMappa.trim()}
        />

        <datalist id="identificatori-mappa-list">
          {identificatoriMappeFiltrati.map((item) => (
            <option key={item.codice_catastale} value={item.codice_catastale} />
          ))}
        </datalist>
         <div className="menuButtonRow">
          <button type="button" className="cercaCancella_selezione" onClick={handleCercaMappa} disabled={!provinciaMappa.trim()}>
            Cerca mappa
          </button>

          <button type="button" className="cercaCancella_selezione" onClick={handleResetMappa} >
            Cancella
          </button>
        </div>
      </section>


      <section className="menuSection">
        <h2 className="menuSectionTitle">Ricerca particelle catastali</h2>
        <label className="menuLabel" htmlFor="provincia-particella">
          Provincia
        </label>
        <div className="menuAutocomplete">
          <input id="provincia-particella" className="menuInput"
            placeholder="Seleziona o scrivi una provincia"  value={provinciaParticella}
            onChange={(e) => {
              setProvinciaParticella(e.target.value);
              setComuneParticella("");
              setShowProvinceParticelle(true);
            }}
            onFocus={() => setShowProvinceParticelle(true)}
          />
          {showProvinceParticelle && provinceParticelleFiltrate.length > 0 && (
            <div className="menuDropdown">
              {provinceParticelleFiltrate.map((item) => (
                <button key={item.provincia} type="button" className="menuDropdownItem"
                  onMouseDown={() => {
                    setProvinciaParticella(item.provincia);
                    setComuneParticella("");
                    setShowProvinceParticelle(false);
                  }}
                >
                  {item.provincia} ({item.sigla_provincia})
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="menuLabel" htmlFor="comune-particella">
          Comune
        </label>
        <div className="menuAutocomplete">
          <input id="comune-particella" className="menuInput"
            placeholder={ provinciaParticella ? "Seleziona o scrivi un comune" : "Seleziona prima una provincia" }
            value={comuneParticella}
            onChange={(e) => {
              setComuneParticella(e.target.value);
              setShowComuniParticelle(true);
            }}
            onFocus={() => { if (provinciaParticella.trim()) setShowComuniParticelle(true); }}
            disabled={!provinciaParticella.trim()}
          />
          {showComuniParticelle && comuniParticelleFiltrati.length > 0 && (
            <div className="menuDropdown">
              {comuniParticelleFiltrati.map((item) => (
                <button key={`${item.provincia}-${item.comune}`} type="button" className="menuDropdownItem"
                  onMouseDown={() => {
                    setComuneParticella(item.comune);
                    setShowComuniParticelle(false);
                  }}
                >
                  {item.comune}
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="menuLabel" htmlFor="particella">
          Particella
        </label>

        <input id="particella" className="menuInput" type="text" list="identificatori-particelle-list"
          placeholder={provinciaParticella.trim() ? comuneParticella.trim()
                ? "Seleziona o scrivi una particella" : "Puoi già selezionare una particella della provincia" : "Seleziona prima una provincia"
          }
          value={particella} onChange={(e) => setParticella(e.target.value)} disabled={!provinciaParticella.trim()}
        />

        <datalist id="identificatori-particelle-list">
          {identificatoriParticelleFiltrati.map((item) => (
            <option key={item.nome_particella} value={item.nome_particella} />
          ))}
        </datalist>

        <div className="menuButtonRow">
          <button type="button" className="cercaCancella_selezione"
            onClick={handleCercaParticella} disabled={!provinciaParticella.trim()} >
            Cerca particella
          </button>

          <button type="button" className="cercaCancella_selezione" onClick={handleResetParticella} >
            Cancella
          </button>
        </div>
      </section>
    </nav>
  );
}

export default CatastoMenu;